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

const OPENROUTER_URL = '/api/openrouter/api/v1/chat/completions';

const VALID_STATUSES = ['lead', 'quoting', 'scheduled', 'progress', 'completed'];
const VALID_VIEWS = ['dashboard', 'clients', 'quote-builder', 'project-detail', 'settings', 'calendar'];
const VALID_TASK_STATUSES = ['todo', 'in_progress', 'done'];

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
- { "type": "CREATE_CATALOG_ITEM", "payload": { "name": string, "category": string, "unit": string, "price": number|string, "store": string, "description": string, "id": string (optional temporary id, see rules) } } — add a reusable priced product/service/material to the Price Catalog. Use this when researching and building out the catalog. Set "price" only to a real figure (from web research or the user); the catalog price becomes authoritative for any quote item that references it.
- { "type": "UPDATE_CATALOG_ITEM", "payload": { "id": string, "name": string, "category": string, "unit": string, "price": number|string, "store": string, "description": string } } — only include the fields you are changing.
- { "type": "DELETE_CATALOG_ITEM", "payload": { "id": string } }
- { "type": "CREATE_TASK", "payload": { "title": string, "description": string, "projectId": string (optional), "clientId": string (optional), "assigneeName": string, "assigneeEmail": string, "date": "YYYY-MM-DD", "time": "HH:MM" (optional 24h), "status": "todo"|"in_progress"|"done", "customerOptIn": boolean, "reminderLeadDays": number|string } } — schedule a project/quote into an actionable, assignable calendar task. The host AUTONOMOUSLY emails the assignee (and the customer, only if customerOptIn is true and the client has an email) a reminder reminderLeadDays before the date, and again whenever the status changes. Link to a project/client by id so customer updates can be sent.
- { "type": "UPDATE_TASK", "payload": { "id": string, "title": string, "description": string, "assigneeName": string, "assigneeEmail": string, "date": "YYYY-MM-DD", "time": "HH:MM", "status": "todo"|"in_progress"|"done", "customerOptIn": boolean, "reminderLeadDays": number|string } } — include only the fields you are changing (e.g. just status).
- { "type": "DELETE_TASK", "payload": { "id": string } }
- { "type": "SWITCH_VIEW", "payload": { "view": "dashboard"|"clients"|"quote-builder"|"project-detail"|"settings"|"calendar", "projectId": string (optional) } }`;

// Build the compact DB snapshot the model reasons over. Mirrors the prior
// inline context-builder so the model sees the same shape it always has.
export function buildContext({ projects, clients, catalog, tasks = [], activeProjectId, currentView, settings = {} }) {
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

  // Compact task list so the assistant can schedule, update, and reference tasks.
  const tasksCtx = (tasks || []).map(t => ({
    id: t.id,
    title: t.title,
    projectId: t.projectId || '',
    clientId: t.clientId || '',
    assigneeName: t.assigneeName || '',
    date: t.date || '',
    time: t.time || '',
    status: t.status || 'todo',
    customerOptIn: Boolean(t.customerOptIn)
  }));

  const activeProjectName = projects.find(p => p.id === activeProjectId)?.name || 'None';

  return {
    businessProfile: {
      companyName: settings.companyName || 'My Business',
      businessType: settings.businessType || 'General products and services',
      businessDescription: settings.businessDescription || 'A flexible business that creates project quotes for clients.',
      personaStatement: settings.personaStatement || 'Be clear, practical, professional, and attentive to the user.'
    },
    currentDate: new Date().toISOString().slice(0, 10),
    currentTime: new Date().toLocaleTimeString(),
    currentView,
    activeProjectId: activeProjectId || 'None',
    activeProjectName,
    clients: clientsCtx,
    projects: projectsCtx,
    priceCatalog: catalogCtx,
    tasks: tasksCtx
  };
}

// Render any web research already gathered this turn so the model uses it
// instead of asking to search again.
function researchSection(research) {
  if (!research || research.length === 0) return '';
  const blocks = research.map(({ query, results, error }) => {
    if (error) return `Search "${query}": (failed — ${error})`;
    if (!results || results.length === 0) return `Search "${query}": (no results)`;
    const lines = results
      .slice(0, 5)
      .map((r, i) => `  ${i + 1}. ${r.title} — ${r.snippet} [${r.url}]`)
      .join('\n');
    return `Search "${query}":\n${lines}`;
  });
  return `\nWeb research already performed this turn (use these findings; do not repeat the same searches):\n${blocks.join('\n')}\n`;
}

// PASS 1 prompt — reasoning only, no execution.
function reasoningPrompt(context, research = []) {
  return `You are the reasoning core for QuoteFlow, a flexible quoting and project workspace for any line of business.
In THIS step your only job is to THINK. You do NOT execute anything and you do NOT touch the database.

Adapt your vocabulary, assumptions, and questions to the configured business profile. A project section may represent a phase, department, deliverable, package, location, room, event, campaign, workstream, or any other useful grouping.
Follow the personaStatement in the business profile for tone, behavior, and decision-making style, unless it conflicts with accuracy, safety, or these execution rules.

This is an ongoing conversation. The prior messages are your memory of it — read them for context and never re-ask for something the user has already told you.

Current Application Context:
${JSON.stringify(context, null, 2)}
${researchSection(research)}
Reason carefully about the user's latest message:
- What are they actually trying to accomplish?
- What do you already know (from the context and the conversation) versus what is genuinely missing?
- For QUOTES especially, do NOT guess line items blindly. Decide whether you have enough scope to build a reliable estimate. Relevant details depend on the configured business, but commonly include deliverables or products, quantities, project sections or phases, service time, quality tier, deadlines, exclusions, and special requirements.
- PRICING IS NOT GUESSWORK. A unit price MUST come from one of: the priceCatalog, a price the user stated, or current web research you actually performed. Never fabricate a price from memory. If you cannot obtain a reliable price for a needed item, CLARIFY.
- TIME is the exception: you MAY estimate labor or service hours from relevant domain knowledge when reasonable. If the business does not bill by time, use zero hours.
- WEB SEARCH & CATALOG RESEARCH: you may search the internet for current external information — product specs, building codes, vendor and retailer pricing, or materials/services related to this business. When the user wants you to price items or build out the catalog for an upcoming project, research real current prices, then plan to add each item to the Price Catalog (name, category, unit, the researched price, and the store/source). Once an item is in the catalog its price is authoritative for quotes. Do NOT search for things already known, and never record a price you did not actually find or were not given.
- If important details or any required unit price are missing, CLARIFY rather than act.
- If you have enough to proceed, outline a concrete, ordered plan describing each database action to take.

Return a STRICT JSON object with exactly these fields:
{
  "reasoning": "your concise step-by-step analysis (a few sentences)",
  "decision": "ACT" or "CLARIFY" or "SEARCH",
  "plan": ["ordered, plain-language steps describing each action to take"],
  "clarifyingQuestion": "one or two focused questions for the user",
  "searchQueries": ["1 to 3 concise web search queries"]
}
When decision is "SEARCH": "plan" must be [], "clarifyingQuestion" must be "", and "searchQueries" must list 1-3 queries. You will be given the results and asked to decide again.
When decision is "CLARIFY": "plan" must be [], "searchQueries" must be [], and put your question(s) in "clarifyingQuestion".
When decision is "ACT": "clarifyingQuestion" must be "", "searchQueries" must be [], and "plan" must list the steps.
Ask for the most important missing details first — one or two questions, not a long interrogation.
Do not wrap the JSON in markdown code blocks.`;
}

// PASS 2 prompt — execute the approved plan into strict action JSON.
function executionPrompt(context, plan, reasoning, research = []) {
  const planText = (plan || []).map((s, i) => `${i + 1}. ${s}`).join('\n') || '(no explicit steps provided)';
  return `You are the execution core for QuoteFlow. A planning step has already reasoned about the user's request and approved a plan. Your job is to translate that plan into precise, schema-correct database actions plus a short spoken confirmation.

Current Application Context:
${JSON.stringify(context, null, 2)}
${researchSection(research)}
Planning notes:
${reasoning || '(none)'}

Approved plan to execute:
${planText}

Return a STRICT JSON object with exactly two fields:
1. "actions": Array of action objects matching the schema below.
2. "response": Natural language confirmation to display and speak to the user. Concise, friendly, professional. Do not use Markdown code blocks.

${ACTION_SCHEMA}

Rules:
- CRITICAL: You have access to a calculation engine. Never do math in your head. Instead, write the raw formula as a string in numeric payload fields (quantity, materialCost, laborHours, laborRate, markupPercent, taxPercent). For example: "quantity": "12 * 15 * 1.10" or "laborHours": "(180 / 50) * 1.5". The system solves them exactly.
- CRITICAL PRICING: Unit prices are NOT yours to invent. For every cataloged product, service, fee, rental, or other line item, set its "catalogId"; the system then uses the catalog's authoritative unit price. If the plan researched a price for a NEW item, emit a CREATE_CATALOG_ITEM (assign it a temporary id like "cat-tmp-1", set the researched price and source store) and reference that same id as the catalogId of the quote item — this builds the catalog as you quote. If the user explicitly gave a price for an uncataloged item, put that exact number in materialCost. Otherwise omit it and ask for pricing.
- TIME may be estimated when appropriate: laborHours represents billable or internal service time per unit. Use zero when time does not apply.
- Resolve "this project" / "active job" to activeProjectId (${context.activeProjectId}).
- Resolve named clients/projects to their existing IDs from the context.
- To create a NEW client and immediately a project (and/or quote items) for them in the SAME turn: assign a unique temporary id to the CREATE_CLIENT payload (e.g. "id": "c-tmp-1") and reuse that exact string as the project's clientId. Likewise assign a temporary id to CREATE_PROJECT (e.g. "id": "p-tmp-1") and reuse it as the projectId for that turn's quote items. Never reference an id that neither exists in the context nor is created earlier in this same actions array.
- Execute ONLY what the approved plan calls for. Do not invent extra actions.
- For SWITCH_VIEW, include projectId in the payload when relevant.
- Output ONLY the JSON object, with no markdown fences.`;
}

// How many times to ask the model to repair its own output after the first
// attempt fails to parse. Total model calls per pass = 1 + MAX_PARSE_RETRIES.
const MAX_PARSE_RETRIES = 2;
// Ceiling on output size so large action arrays can't get truncated mid-JSON
// (truncation is the one failure the repair loop can't fully recover content for).
const MAX_OUTPUT_TOKENS = 4096;

// Tolerantly pull a JSON object from a model reply. Handles markdown fences and
// leading/trailing prose by falling back to the widest {...} span. Throws a
// SyntaxError (with position info) when the content still isn't valid JSON, so
// the caller can feed that exact complaint back to the model for repair.
function parseJsonLoose(text) {
  const trimmed = text.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '');
  try {
    return JSON.parse(trimmed);
  } catch (firstErr) {
    const start = trimmed.indexOf('{');
    const end = trimmed.lastIndexOf('}');
    if (start !== -1 && end > start) {
      // Re-parse the outermost object span; let this throw on real syntax errors.
      return JSON.parse(trimmed.slice(start, end + 1));
    }
    throw firstErr;
  }
}

// One OpenRouter chat round-trip. Returns the raw assistant content string.
async function postChat(messages, settings) {
  const response = await fetch(OPENROUTER_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'HTTP-Referer': 'http://localhost:5173/',
      'X-Title': 'QuoteFlow Business Estimate Chat'
    },
    body: JSON.stringify({
      model: settings.openRouterModel || 'openrouter/auto',
      messages,
      response_format: { type: 'json_object' },
      max_tokens: MAX_OUTPUT_TOKENS
    })
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
  return contentText;
}

// Chat call with a self-repair loop: if the reply won't parse as JSON, we send
// the model its own broken output plus the parser's exact error and ask it to
// fix and re-emit. The full system prompt + context ride along on every retry,
// so the model can correct a semantic slip (bad id, missing field) — not just a
// stray comma. Returns the parsed JSON content object.
async function callOpenRouter({ systemPrompt, history, userMessage, settings }) {
  const baseMessages = [
    { role: 'system', content: systemPrompt },
    ...(history || []),
    { role: 'user', content: userMessage }
  ];

  let lastContent = '';
  let lastError = null;

  for (let attempt = 0; attempt <= MAX_PARSE_RETRIES; attempt++) {
    const messages = attempt === 0
      ? baseMessages
      : [
          ...baseMessages,
          { role: 'assistant', content: lastContent },
          {
            role: 'user',
            content: `Your previous response could not be parsed as JSON. The parser reported: "${lastError.message}". Re-read your previous message, locate and fix the error (e.g. a stray sentence, a trailing comma, a missing brace or quote, an unfinished value), and return ONLY the corrected, complete JSON object — no explanation, no markdown code fences.`
          }
        ];

    lastContent = await postChat(messages, settings);
    try {
      return parseJsonLoose(lastContent);
    } catch (err) {
      lastError = err;
    }
  }

  throw new Error(`The model did not return valid JSON after ${MAX_PARSE_RETRIES + 1} attempts (last parser error: ${lastError?.message}). Try a model with reliable structured output (e.g. Gemini 2.5 Flash or Claude 3.5 Sonnet) in System Settings.`);
}

// Reason why a single action is invalid, or null if it passes. `clientIds` and
// `projectIds` are mutable sets seeded with existing ids and extended with ids
// minted earlier in the same batch.
function actionRejectionReason(action, clientIds, projectIds, catalogIds, taskIds) {
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
    case 'CREATE_CATALOG_ITEM':
      return payload.name ? null : 'CREATE_CATALOG_ITEM missing name';
    case 'UPDATE_CATALOG_ITEM':
      return catalogIds.has(payload.id) ? null : `UPDATE_CATALOG_ITEM references unknown catalog product "${payload.id}"`;
    case 'DELETE_CATALOG_ITEM':
      return catalogIds.has(payload.id) ? null : `DELETE_CATALOG_ITEM references unknown catalog product "${payload.id}"`;
    case 'CREATE_TASK':
      if (!payload.title) return 'CREATE_TASK missing title';
      if (payload.projectId && !projectIds.has(payload.projectId)) return `CREATE_TASK references unknown project "${payload.projectId}"`;
      if (payload.clientId && !clientIds.has(payload.clientId)) return `CREATE_TASK references unknown client "${payload.clientId}"`;
      if (payload.status && !VALID_TASK_STATUSES.includes(payload.status)) return `CREATE_TASK has invalid status "${payload.status}"`;
      return null;
    case 'UPDATE_TASK':
      if (!taskIds.has(payload.id)) return `UPDATE_TASK references unknown task "${payload.id}"`;
      if (payload.status && !VALID_TASK_STATUSES.includes(payload.status)) return `UPDATE_TASK has invalid status "${payload.status}"`;
      return null;
    case 'DELETE_TASK':
      return taskIds.has(payload.id) ? null : `DELETE_TASK references unknown task "${payload.id}"`;
    case 'SWITCH_VIEW':
      return VALID_VIEWS.includes(payload.view) ? null : `SWITCH_VIEW has invalid view "${payload.view}"`;
    default:
      return `unknown action type "${type}"`;
  }
}

// Run the model's requested web searches through the host search proxy.
// Returns [{ query, results: [{title, url, snippet}], error }].
async function webSearch(queries) {
  const unique = [...new Set((queries || []).map(q => String(q || '').trim()).filter(Boolean))].slice(0, 3);
  const found = [];
  for (const query of unique) {
    try {
      const response = await fetch(`/api/search?q=${encodeURIComponent(query)}`);
      const data = await response.json().catch(() => ({}));
      found.push({
        query,
        results: Array.isArray(data.results) ? data.results : [],
        error: response.ok ? null : (data.error || `search failed (${response.status})`)
      });
    } catch (e) {
      found.push({ query, results: [], error: e.message });
    }
  }
  return found;
}

// Deterministic gate: validate every proposed action against the DB context.
export function validateActions(actions, context) {
  const valid = [];
  const rejected = [];
  const clientIds = new Set(context.clients.map(c => c.id));
  const projectIds = new Set(context.projects.map(p => p.id));
  const catalogIds = new Set((context.priceCatalog || []).map(i => i.id));
  const taskIds = new Set((context.tasks || []).map(t => t.id));

  for (const action of actions) {
    const reason = actionRejectionReason(action, clientIds, projectIds, catalogIds, taskIds);
    if (reason) {
      rejected.push({ action, reason });
      continue;
    }
    valid.push(action);
    // Register ids minted in this batch so later actions can reference them.
    if (action.type === 'CREATE_CLIENT' && action.payload?.id) clientIds.add(action.payload.id);
    if (action.type === 'CREATE_PROJECT' && action.payload?.id) projectIds.add(action.payload.id);
    if (action.type === 'CREATE_CATALOG_ITEM' && action.payload?.id) catalogIds.add(action.payload.id);
    if (action.type === 'CREATE_TASK' && action.payload?.id) taskIds.add(action.payload.id);
  }

  return { valid, rejected };
}

// Orchestrate the dual pass + validation gate.
//   onPhase('reasoning'|'executing') is an optional callback for staged UI.
// Returns { decision, reasoning, actions, response, rejected }.
export async function runAgent({ userMessage, history, context, settings, onPhase }) {
  // PASS 1 — reason & plan, with up to MAX_SEARCH_ROUNDS of autonomous web
  // search. Each round the model may answer "SEARCH"; we run the queries, feed
  // the findings back, and let it reason again before it settles on ACT/CLARIFY.
  const MAX_SEARCH_ROUNDS = 2;
  const research = [];
  let planning;

  onPhase?.('reasoning');
  for (let round = 0; ; round++) {
    planning = await callOpenRouter({
      systemPrompt: reasoningPrompt(context, research),
      history,
      userMessage,
      settings
    });

    const wantsSearch = String(planning.decision || '').toUpperCase() === 'SEARCH';
    const queries = Array.isArray(planning.searchQueries) ? planning.searchQueries : [];
    if (wantsSearch && queries.length > 0 && round < MAX_SEARCH_ROUNDS) {
      onPhase?.('searching');
      research.push(...await webSearch(queries));
      onPhase?.('reasoning');
      continue;
    }
    break;
  }

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
    systemPrompt: executionPrompt(context, plan, reasoning, research),
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
