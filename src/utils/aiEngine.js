// Dual-pass NLP engine for the Apex Estimate assistant.
//
// PASS 1 (Reason & Plan): the model reasons in natural language and decides
//   whether it has enough information to ACT or must CLARIFY. It performs NO
//   database writes — it only thinks and produces a plan.
// PASS 2 (Execute): only runs when the decision is ACT. It translates the
//   approved plan into strict, schema-correct action JSON.
// GATE (deterministic): before anything is dispatched, every proposed action is
//   validated against the live database context. Invalid actions are dropped so
//   they can never corrupt the local database.

const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';

const VALID_STATUSES = ['lead', 'quoting', 'scheduled', 'progress', 'completed'];
const VALID_VIEWS = ['dashboard', 'clients', 'quote-builder', 'project-detail', 'settings'];

const ACTION_SCHEMA = `Available Actions Schema:
- { "type": "CREATE_CLIENT", "payload": { "name": string, "company": string, "email": string, "phone": string, "address": string, "notes": string, "id": string (optional temporary id, see rules) } }
- { "type": "UPDATE_CLIENT", "payload": { "id": string, "name": string, "company": string, "email": string, "phone": string, "address": string, "notes": string } }
- { "type": "DELETE_CLIENT", "payload": { "id": string } }
- { "type": "CREATE_PROJECT", "payload": { "name": string, "clientId": string, "status": "lead"|"quoting"|"scheduled"|"progress"|"completed", "id": string (optional temporary id, see rules) } }
- { "type": "UPDATE_PROJECT_STATUS", "payload": { "id": string, "status": "lead"|"quoting"|"scheduled"|"progress"|"completed" } }
- { "type": "UPDATE_PROJECT", "payload": { "id": string, "name": string, "clientId": string, "status": "lead"|"quoting"|"scheduled"|"progress"|"completed", "startDate": string, "endDate": string, "laborRate": number|string, "markupPercent": number|string, "taxPercent": number|string } } — use to RE-LINK a project to a different client (clientId), rename it, or change its dates/rates. Only include the fields you are changing.
- { "type": "ADD_QUOTE_ITEM", "payload": { "projectId": string, "roomName": string, "name": string, "category": string, "quantity": number|string, "unit": string, "materialCost": number|string, "laborHours": number|string, "catalogId": string } } — catalogId is the id of a Price Catalog product; when set, the system fills the material unit price (and name/unit/category if omitted) from the catalog. ALWAYS set catalogId for any material that exists in the catalog.
- { "type": "UPDATE_QUOTE_ITEM", "payload": { "projectId": string, "itemId": string, "name": string, "category": string, "quantity": number|string, "unit": string, "materialCost": number|string, "laborHours": number|string, "catalogId": string } }
- { "type": "DELETE_QUOTE_ITEM", "payload": { "projectId": string, "itemId": string } }
- { "type": "ADD_CHECKLIST_ITEM", "payload": { "projectId": string, "text": string } }
- { "type": "TOGGLE_CHECKLIST_ITEM", "payload": { "projectId": string, "checklistItemId": string } }
- { "type": "CREATE_CHANGE_ORDER", "payload": { "projectId": string, "title": string, "description": string, "items": [ { "name": string, "category": string, "quantity": number|string, "unit": string, "materialCost": number|string, "laborHours": number|string, "catalogId": string } ] } } — each item's catalogId works the same as in ADD_QUOTE_ITEM.
- { "type": "APPROVE_CHANGE_ORDER", "payload": { "projectId": string, "changeOrderId": string } }
- { "type": "REJECT_CHANGE_ORDER", "payload": { "projectId": string, "changeOrderId": string } }
- { "type": "SWITCH_VIEW", "payload": { "view": "dashboard"|"clients"|"quote-builder"|"project-detail"|"settings", "projectId": string (optional) } }`;

// Build the compact DB snapshot the model reasons over. Mirrors the prior
// inline context-builder so the model sees the same shape it always has.
export function buildContext({ projects, clients, catalog, activeProjectId, currentView }) {
  const clientsCtx = clients.map(c => ({
    id: c.id,
    name: c.name,
    company: c.company || '',
    email: c.email || '',
    phone: c.phone || '',
    address: c.address || ''
  }));

  // Compact price catalog — the authoritative source for material unit prices.
  const catalogCtx = (catalog || []).map(i => ({
    id: i.id,
    name: i.name,
    category: i.category,
    unit: i.unit,
    price: i.price
  }));

  const projectsCtx = projects.map(p => {
    const summary = {
      id: p.id,
      name: p.name,
      clientId: p.clientId,
      status: p.status
    };
    // Full line-item detail only for the active project to keep the prompt small.
    if (p.id === activeProjectId) {
      summary.checklists = (p.checklists || []).map(c => ({ id: c.id, text: c.text, completed: c.completed }));
      summary.changeOrders = (p.changeOrders || []).map(co => ({ id: co.id, title: co.title, status: co.status }));
      summary.rooms = (p.rooms || []).map(r => ({
        name: r.name,
        items: r.items.map(item => ({ id: item.id, name: item.name, category: item.category, unit: item.unit, quantity: item.quantity, materialCost: item.materialCost, laborHours: item.laborHours }))
      }));
    }
    return summary;
  });

  const activeProjectName = projects.find(p => p.id === activeProjectId)?.name || 'None';

  return {
    currentDate: new Date().toISOString().slice(0, 10),
    currentTime: new Date().toLocaleTimeString(),
    currentView,
    activeProjectId: activeProjectId || 'None',
    activeProjectName,
    clients: clientsCtx,
    projects: projectsCtx,
    priceCatalog: catalogCtx
  };
}

// PASS 1 prompt — reasoning only, no execution.
function reasoningPrompt(context) {
  return `You are the reasoning core for Apex Estimate, a remodeling contractor job workspace assistant.
In THIS step your only job is to THINK. You do NOT execute anything and you do NOT touch the database.

This is an ongoing conversation. The prior messages are your memory of it — read them for context and never re-ask for something the contractor has already told you.

Current Application Context:
${JSON.stringify(context, null, 2)}

Reason carefully about the contractor's latest message:
- What are they actually trying to accomplish?
- What do you already know (from the context and the conversation) versus what is genuinely missing?
- For QUOTES especially, do NOT guess line items blindly. Decide whether you have enough scope to build a reliable estimate. The details that matter: which client/project it is for, the room/area and its rough dimensions or square footage, the scope of work (demolition, plumbing, electrical, framing, drywall, tile/flooring, cabinets/countertops, fixtures, paint), the materials/finish quality tier (budget, mid-range, high-end), and any specific fixtures the client wants.
- PRICING IS NOT GUESSWORK. Material/product unit prices MUST come from the priceCatalog in the context, or from a price the contractor explicitly stated. For each material in the scope, find the matching catalog product. If a needed product is NOT in the catalog and the contractor has not given you a price, you must CLARIFY — ask them to either add it to the Price Catalog or tell you the price. Never invent a material price.
- LABOR is the exception: you MAY estimate labor hours from your trade knowledge (and quantities/areas via the calculator). Only the hard material prices are off-limits to guessing.
- If important details OR any required material price are missing, you must CLARIFY (ask for them) rather than act.
- If you have enough to proceed, outline a concrete, ordered plan describing each database action to take.

Return a STRICT JSON object with exactly these fields:
{
  "reasoning": "your concise step-by-step analysis (a few sentences)",
  "decision": "ACT" or "CLARIFY",
  "plan": ["ordered, plain-language steps describing each action to take"],
  "clarifyingQuestion": "one or two focused questions for the contractor"
}
When decision is "CLARIFY": "plan" must be [] and put your question(s) in "clarifyingQuestion".
When decision is "ACT": "clarifyingQuestion" must be "" and "plan" must list the steps.
Ask for the most important missing details first — one or two questions, not a long interrogation.
Do not wrap the JSON in markdown code blocks.`;
}

// PASS 2 prompt — execute the approved plan into strict action JSON.
function executionPrompt(context, plan, reasoning) {
  const planText = (plan || []).map((s, i) => `${i + 1}. ${s}`).join('\n') || '(no explicit steps provided)';
  return `You are the execution core for Apex Estimate. A planning step has already reasoned about the contractor's request and approved a plan. Your job is to translate that plan into precise, schema-correct database actions plus a short spoken confirmation.

Current Application Context:
${JSON.stringify(context, null, 2)}

Planning notes:
${reasoning || '(none)'}

Approved plan to execute:
${planText}

Return a STRICT JSON object with exactly two fields:
1. "actions": Array of action objects matching the schema below.
2. "response": Natural language confirmation to display and speak to the contractor. Concise, friendly, professional. Do not use Markdown code blocks.

${ACTION_SCHEMA}

Rules:
- CRITICAL: You have access to a calculation engine. Never do math in your head. Instead, write the raw formula as a string in numeric payload fields (quantity, materialCost, laborHours, laborRate, markupPercent, taxPercent). For example: "quantity": "12 * 15 * 1.10" or "laborHours": "(180 / 50) * 1.5". The system solves them exactly.
- CRITICAL PRICING: Material unit prices are NOT yours to invent. For every material line item, find the matching product in priceCatalog and set its "catalogId" — the system then uses the catalog's authoritative unit price (you may omit materialCost when catalogId is set). If the contractor explicitly gave a price for an item not in the catalog, put that exact number in materialCost (no catalogId). Never write a materialCost you guessed; if you reach this step without a catalog match or a contractor-given price for a material, that item should not have been planned — omit it.
- LABOR may be estimated: set laborHours from reasonable trade knowledge (use the calculator for formulas). Catalog products do not carry labor, so you always supply laborHours yourself.
- Resolve "this project" / "active job" to activeProjectId (${context.activeProjectId}).
- Resolve named clients/projects to their existing IDs from the context.
- To create a NEW client and immediately a project (and/or quote items) for them in the SAME turn: assign a unique temporary id to the CREATE_CLIENT payload (e.g. "id": "c-tmp-1") and reuse that exact string as the project's clientId. Likewise assign a temporary id to CREATE_PROJECT (e.g. "id": "p-tmp-1") and reuse it as the projectId for that turn's quote items. Never reference an id that neither exists in the context nor is created earlier in this same actions array.
- Execute ONLY what the approved plan calls for. Do not invent extra actions.
- For SWITCH_VIEW, include projectId in the payload when relevant.
- Output ONLY the JSON object, with no markdown fences.`;
}

// Single OpenRouter chat call that returns the parsed JSON content object.
async function callOpenRouter({ systemPrompt, history, userMessage, settings }) {
  const requestBody = {
    model: settings.openRouterModel || 'openrouter/auto',
    messages: [
      { role: 'system', content: systemPrompt },
      ...(history || []),
      { role: 'user', content: userMessage }
    ],
    response_format: { type: 'json_object' }
  };

  const response = await fetch(OPENROUTER_URL, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${settings.openRouterKey}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': 'http://localhost:5173/',
      'X-Title': 'Apex Remodel Estimate Chat'
    },
    body: JSON.stringify(requestBody)
  });

  if (!response.ok) {
    const errData = await response.json().catch(() => ({}));
    throw new Error(errData.error?.message || `API Error: ${response.status}`);
  }

  const resData = await response.json();

  // OpenRouter can return HTTP 200 with an error payload (and no choices) — e.g.
  // when the auto-router lands on a model that rejects the request or rate-limits.
  if (resData.error) {
    throw new Error(resData.error.message || 'OpenRouter returned an error response.');
  }

  const contentText = resData.choices?.[0]?.message?.content;
  if (!contentText) {
    throw new Error('The model returned no content — it may not support JSON mode. Try pinning a specific model (e.g. Gemini 2.5 Flash or Claude 3.5 Sonnet) in System Settings instead of the auto-router.');
  }

  // Be tolerant of models that wrap JSON in markdown fences despite instructions.
  const cleaned = contentText.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '');
  try {
    return JSON.parse(cleaned);
  } catch {
    throw new Error('The model did not return valid JSON. Try a model with reliable structured output (e.g. Gemini 2.5 Flash or Claude 3.5 Sonnet) in System Settings.');
  }
}

// Reason why a single action is invalid, or null if it passes. `clientIds` and
// `projectIds` are mutable sets seeded with existing ids and extended with ids
// minted earlier in the same batch.
function actionRejectionReason(action, clientIds, projectIds, catalogIds) {
  if (!action || typeof action !== 'object') return 'malformed action';
  const { type, payload = {} } = action;
  const badCatalogRef = (cid) => cid !== undefined && cid !== '' && !catalogIds.has(cid);

  switch (type) {
    case 'CREATE_CLIENT':
      return payload.name ? null : 'CREATE_CLIENT missing name';
    case 'UPDATE_CLIENT':
      return clientIds.has(payload.id) ? null : `UPDATE_CLIENT references unknown client "${payload.id}"`;
    case 'DELETE_CLIENT':
      return clientIds.has(payload.id) ? null : `DELETE_CLIENT references unknown client "${payload.id}"`;
    case 'CREATE_PROJECT':
      if (!payload.name) return 'CREATE_PROJECT missing name';
      if (!clientIds.has(payload.clientId)) return `CREATE_PROJECT references unknown client "${payload.clientId}" — create the client first`;
      if (payload.status && !VALID_STATUSES.includes(payload.status)) return `CREATE_PROJECT has invalid status "${payload.status}"`;
      return null;
    case 'UPDATE_PROJECT_STATUS':
      if (!projectIds.has(payload.id)) return `UPDATE_PROJECT_STATUS references unknown project "${payload.id}"`;
      if (!VALID_STATUSES.includes(payload.status)) return `invalid status "${payload.status}"`;
      return null;
    case 'UPDATE_PROJECT':
      if (!projectIds.has(payload.id)) return `UPDATE_PROJECT references unknown project "${payload.id}"`;
      if (payload.clientId !== undefined && !clientIds.has(payload.clientId)) return `UPDATE_PROJECT references unknown client "${payload.clientId}"`;
      if (payload.status !== undefined && !VALID_STATUSES.includes(payload.status)) return `UPDATE_PROJECT has invalid status "${payload.status}"`;
      return null;
    case 'ADD_QUOTE_ITEM':
      if (!projectIds.has(payload.projectId)) return `ADD_QUOTE_ITEM references unknown project "${payload.projectId}"`;
      if (badCatalogRef(payload.catalogId)) return `ADD_QUOTE_ITEM references unknown catalog product "${payload.catalogId}"`;
      return payload.name ? null : 'ADD_QUOTE_ITEM missing name';
    case 'UPDATE_QUOTE_ITEM':
      if (!projectIds.has(payload.projectId)) return `UPDATE_QUOTE_ITEM references unknown project "${payload.projectId}"`;
      if (badCatalogRef(payload.catalogId)) return `UPDATE_QUOTE_ITEM references unknown catalog product "${payload.catalogId}"`;
      return payload.itemId ? null : 'UPDATE_QUOTE_ITEM missing itemId';
    case 'DELETE_QUOTE_ITEM':
      if (!projectIds.has(payload.projectId)) return `DELETE_QUOTE_ITEM references unknown project "${payload.projectId}"`;
      return payload.itemId ? null : 'DELETE_QUOTE_ITEM missing itemId';
    case 'ADD_CHECKLIST_ITEM':
      if (!projectIds.has(payload.projectId)) return `ADD_CHECKLIST_ITEM references unknown project "${payload.projectId}"`;
      return payload.text ? null : 'ADD_CHECKLIST_ITEM missing text';
    case 'TOGGLE_CHECKLIST_ITEM':
      if (!projectIds.has(payload.projectId)) return `TOGGLE_CHECKLIST_ITEM references unknown project "${payload.projectId}"`;
      return payload.checklistItemId ? null : 'TOGGLE_CHECKLIST_ITEM missing checklistItemId';
    case 'CREATE_CHANGE_ORDER': {
      if (!projectIds.has(payload.projectId)) return `CREATE_CHANGE_ORDER references unknown project "${payload.projectId}"`;
      if (!payload.title) return 'CREATE_CHANGE_ORDER missing title';
      const badItem = (payload.items || []).find(it => badCatalogRef(it.catalogId));
      if (badItem) return `CREATE_CHANGE_ORDER item references unknown catalog product "${badItem.catalogId}"`;
      return null;
    }
    case 'APPROVE_CHANGE_ORDER':
    case 'REJECT_CHANGE_ORDER':
      if (!projectIds.has(payload.projectId)) return `${type} references unknown project "${payload.projectId}"`;
      return payload.changeOrderId ? null : `${type} missing changeOrderId`;
    case 'SWITCH_VIEW':
      return VALID_VIEWS.includes(payload.view) ? null : `SWITCH_VIEW has invalid view "${payload.view}"`;
    default:
      return `unknown action type "${type}"`;
  }
}

// Deterministic gate: validate every proposed action against the DB context.
export function validateActions(actions, context) {
  const valid = [];
  const rejected = [];
  const clientIds = new Set(context.clients.map(c => c.id));
  const projectIds = new Set(context.projects.map(p => p.id));
  const catalogIds = new Set((context.priceCatalog || []).map(i => i.id));

  for (const action of actions) {
    const reason = actionRejectionReason(action, clientIds, projectIds, catalogIds);
    if (reason) {
      rejected.push({ action, reason });
      continue;
    }
    valid.push(action);
    // Register ids minted in this batch so later actions can reference them.
    if (action.type === 'CREATE_CLIENT' && action.payload?.id) clientIds.add(action.payload.id);
    if (action.type === 'CREATE_PROJECT' && action.payload?.id) projectIds.add(action.payload.id);
  }

  return { valid, rejected };
}

// Orchestrate the dual pass + validation gate.
//   onPhase('reasoning'|'executing') is an optional callback for staged UI.
// Returns { decision, reasoning, actions, response, rejected }.
export async function runAgent({ userMessage, history, context, settings, onPhase }) {
  // PASS 1 — reason & plan.
  onPhase?.('reasoning');
  const planning = await callOpenRouter({
    systemPrompt: reasoningPrompt(context),
    history,
    userMessage,
    settings
  });

  const decision = String(planning.decision || '').toUpperCase() === 'ACT' ? 'ACT' : 'CLARIFY';
  const reasoning = planning.reasoning || '';

  // CLARIFY short-circuits: no execution, no DB writes, conversation stays open.
  if (decision !== 'ACT') {
    return {
      decision: 'CLARIFY',
      reasoning,
      actions: [],
      rejected: [],
      response: planning.clarifyingQuestion || 'Could you give me a little more detail so I can set this up correctly?'
    };
  }

  // PASS 2 — execute the approved plan.
  onPhase?.('executing');
  const plan = Array.isArray(planning.plan) ? planning.plan : [];
  const execResult = await callOpenRouter({
    systemPrompt: executionPrompt(context, plan, reasoning),
    history,
    userMessage,
    settings
  });

  const proposedActions = Array.isArray(execResult.actions) ? execResult.actions : [];
  let response = execResult.response || 'Executed successfully.';

  // GATE — validate before anything is dispatched.
  const { valid, rejected } = validateActions(proposedActions, context);
  if (rejected.length > 0) {
    response += ` (Note: I held back ${rejected.length} step(s) that didn't pass validation: ${rejected.map(r => r.reason).join('; ')}.)`;
  }

  return { decision: 'ACT', reasoning, actions: valid, response, rejected };
}
