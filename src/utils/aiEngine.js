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

import { saveSettings } from './dataStore';

const OPENROUTER_URL = '/api/openrouter/api/v1/chat/completions';

// Safety-net model used only when the user's chosen model errors out (rate
// limit, outage, retired slug). Must be a currently valid OpenRouter id — a
// dead slug here breaks the whole self-healing path. Verify against
// https://openrouter.ai/api/v1/models if models get retired.
const FALLBACK_MODEL = 'meta-llama/llama-3.3-70b-instruct:free';

const VALID_STATUSES = ['lead', 'quoting', 'scheduled', 'progress', 'completed'];
const VALID_VIEWS = ['dashboard', 'clients', 'contacts', 'quote-builder', 'project-detail', 'settings', 'calendar', 'agent-workspace'];
const VALID_TASK_STATUSES = ['todo', 'in_progress', 'done'];

export const SUPPORTED_ACTION_TYPES = [
  'CREATE_CLIENT', 'UPDATE_CLIENT', 'DELETE_CLIENT',
  'CREATE_CONTACT', 'UPDATE_CONTACT', 'DELETE_CONTACT',
  'CREATE_PROJECT', 'UPDATE_PROJECT_STATUS', 'UPDATE_PROJECT', 'ADD_PROJECT_LOG',
  'ADD_QUOTE_ITEM', 'UPDATE_QUOTE_ITEM', 'DELETE_QUOTE_ITEM',
  'ADD_CHECKLIST_ITEM', 'TOGGLE_CHECKLIST_ITEM',
  'CREATE_CHANGE_ORDER', 'APPROVE_CHANGE_ORDER', 'REJECT_CHANGE_ORDER',
  'CREATE_CATALOG_ITEM', 'UPDATE_CATALOG_ITEM', 'DELETE_CATALOG_ITEM',
  'CREATE_TASK', 'UPDATE_TASK', 'DELETE_TASK',
  'SEND_EMAIL_TO_CLIENT', 'SEND_SMS', 'SWITCH_VIEW',
  'WRITE_FILE', 'READ_FILE', 'RUN_COMMAND', 'SPAWN_SUBAGENT',
  'CREATE_KNOWLEDGE_ARTICLE', 'UPDATE_KNOWLEDGE_ARTICLE', 'DELETE_KNOWLEDGE_ARTICLE',
  'SAVE_MEMORY', 'UPDATE_MEMORY', 'DELETE_MEMORY'
];

const ACTION_TYPE_ALIASES = {
  CHANGE_VIEW: 'SWITCH_VIEW',
  NAVIGATE: 'SWITCH_VIEW',
  NAVIGATE_TO_VIEW: 'SWITCH_VIEW',
  SEND_EMAIL: 'SEND_EMAIL_TO_CLIENT',
  EMAIL_CLIENT: 'SEND_EMAIL_TO_CLIENT',
  SEND_TEXT: 'SEND_SMS',
  SEND_TEXT_MESSAGE: 'SEND_SMS',
  CREATE_FILE: 'WRITE_FILE',
  UPDATE_FILE: 'WRITE_FILE',
  WRITE_TO_FILE: 'WRITE_FILE',
  GET_FILE: 'READ_FILE',
  READ_FROM_FILE: 'READ_FILE',
  EXEC_COMMAND: 'RUN_COMMAND',
  EXECUTE_COMMAND: 'RUN_COMMAND',
  RUN_SHELL_COMMAND: 'RUN_COMMAND',
  SHELL_COMMAND: 'RUN_COMMAND',
  SPAWN_AGENT: 'SPAWN_SUBAGENT',
  CREATE_SUBAGENT: 'SPAWN_SUBAGENT',
  CREATE_SUB_AGENT: 'SPAWN_SUBAGENT'
};

const canonicalActionType = (value) => {
  const normalized = String(value || '')
    .trim()
    .replace(/([a-z0-9])([A-Z])/g, '$1_$2')
    .replace(/[^A-Za-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .toUpperCase();
  return ACTION_TYPE_ALIASES[normalized] || normalized;
};

// Models do not always serialize tool calls in the exact same wrapper. Accept
// the common action/function-call shapes, then reduce them to the one internal
// contract used by both validation and dispatch.
export function normalizeAction(action) {
  if (!action || typeof action !== 'object') return action;

  const functionCall = action.function && typeof action.function === 'object'
    ? action.function
    : null;
  const type = canonicalActionType(
    action.type
    || action.actionType
    || action.action
    || action.name
    || action.tool
    || action.toolName
    || functionCall?.name
  );

  let payload = action.payload
    ?? action.params
    ?? action.parameters
    ?? action.arguments
    ?? action.input
    ?? functionCall?.arguments
    ?? {};

  if (typeof payload === 'string') {
    try {
      payload = JSON.parse(payload);
    } catch {
      payload = {};
    }
  }

  return {
    type,
    payload: payload && typeof payload === 'object' && !Array.isArray(payload) ? payload : {}
  };
}

const ACTION_SCHEMA = `Available Actions Schema:
- { "type": "CREATE_CLIENT", "payload": { "name": string, "company": string, "email": string, "phone": string, "address": string, "notes": string, "id": string (optional temporary id, see rules) } }
- { "type": "UPDATE_CLIENT", "payload": { "id": string, "name": string, "company": string, "email": string, "phone": string, "address": string, "notes": string } }
- { "type": "DELETE_CLIENT", "payload": { "id": string } }
- { "type": "CREATE_CONTACT", "payload": { "name": string, "phone": string, "email": string, "address": string, "website": string, "carrier": string (optional, e.g. "AT&T"|"Verizon"|"T-Mobile"|"Sprint"|"Boost Mobile"|"Cricket"|"MetroPCS"|"Virgin Mobile"), "notes": string, "id": string (optional temporary id, see rules) } }
- { "type": "UPDATE_CONTACT", "payload": { "id": string, "name": string, "phone": string, "email": string, "address": string, "website": string, "carrier": string (optional), "notes": string } }
- { "type": "DELETE_CONTACT", "payload": { "id": string } }
- { "type": "CREATE_PROJECT", "payload": { "name": string, "clientId": string (optional), "status": "lead"|"quoting"|"scheduled"|"progress"|"completed", "id": string (optional temporary id, see rules) } }
- { "type": "UPDATE_PROJECT_STATUS", "payload": { "id": string, "status": "lead"|"quoting"|"scheduled"|"progress"|"completed" } }
- { "type": "UPDATE_PROJECT", "payload": { "id": string, "name": string, "clientId": string, "status": "lead"|"quoting"|"scheduled"|"progress"|"completed", "summary": string, "startDate": string, "endDate": string, "laborRate": number|string, "markupPercent": number|string, "taxPercent": number|string } } — use to RE-LINK a project to a different client (clientId), rename it, update its summary, or change its dates/rates. Only include the fields you are changing.
- { "type": "ADD_PROJECT_LOG", "payload": { "projectId": string, "message": string } } — append a new entry to the rolling activity log to track decisions, discussions, or work done.
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
- { "type": "SEND_EMAIL_TO_CLIENT", "payload": { "clientId": string, "subject": string, "htmlBody": string } } — use to instantly dispatch a fully drafted email to a client via the backend email engine. Write the htmlBody in professional HTML.
- { "type": "SEND_SMS", "payload": { "to": string[] (array of phone numbers or contact IDs), "message": string } } — sends an SMS text message to one or more phone numbers or contact IDs via carrier email-to-SMS gateway.
- { "type": "SWITCH_VIEW", "payload": { "view": "dashboard"|"clients"|"contacts"|"quote-builder"|"project-detail"|"settings"|"calendar"|"agent-workspace", "projectId": string (optional) } }
- { "type": "WRITE_FILE", "payload": { "path": string, "content": string } } — writes a file to the host file system.
- { "type": "READ_FILE", "payload": { "path": string } } — reads a file from the host file system.
- { "type": "RUN_COMMAND", "payload": { "command": string } } — executes a shell command on the host machine.
- { "type": "SPAWN_SUBAGENT", "payload": { "role": string, "task": string } } — spins up a background AI sub-agent to assist with parallel coding or research.
- { "type": "CREATE_KNOWLEDGE_ARTICLE", "payload": { "title": string, "content": string, "tags": [string] } } — use to store SOPs, rules, or workflows in your brain.
- { "type": "UPDATE_KNOWLEDGE_ARTICLE", "payload": { "id": string, "title": string, "content": string, "tags": [string] } }
- { "type": "DELETE_KNOWLEDGE_ARTICLE", "payload": { "id": string } }
- { "type": "SAVE_MEMORY", "payload": { "memoryType": "short"|"long"|"episodic", "content": string, "tags": [string] } } — write to your persistent memory (shown to you each turn as aiMemory). Use "long" for durable facts, user preferences, corrections, and standing rules — ALWAYS save a long memory when the user states a preference, corrects you, or sets a rule. Use "episodic" to journal a meaningful event: what happened, with whom, key decisions, and the outcome (e.g. after finishing a quote, a client call, or an important conversation). Use "short" for scratch notes that only matter for the next few days (short memories expire automatically after a week). One concise paragraph per memory; never duplicate an existing memory — update it instead.
- { "type": "UPDATE_MEMORY", "payload": { "id": string, "content": string, "tags": [string] } } — revise an existing memory when facts change; include only the fields you are changing.
- { "type": "DELETE_MEMORY", "payload": { "id": string } } — remove a memory that is wrong, obsolete, or that the user asks you to forget.`;

// Build the compact DB snapshot the model reasons over. Mirrors the prior
// inline context-builder so the model sees the same shape it always has.
export function buildContext({ projects, clients, contacts = [], catalog, tasks = [], knowledgeBase = [], aiMemory = [], websiteAnalytics = null, activeProjectId, currentView, settings = {} }) {
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
      summary.summary = p.summary || '';
      summary.logs = p.logs || [];
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

  // Your persistent memory. Long-term is always fully present; episodic and
  // short-term are the most recent entries (newest last), so stale scratch
  // notes age out of the prompt naturally.
  const byNewest = (a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || ''));
  const memoryEntry = (m) => ({ id: m.id, content: m.content, tags: m.tags || [], saved: String(m.createdAt || '').slice(0, 10) });
  const aiMemoryCtx = {
    longTerm: aiMemory.filter(m => m.type === 'long').map(memoryEntry),
    episodic: aiMemory.filter(m => m.type === 'episodic').sort(byNewest).slice(0, 15).reverse().map(memoryEntry),
    shortTerm: aiMemory.filter(m => m.type === 'short').sort(byNewest).slice(0, 20).reverse().map(memoryEntry),
  };

  // Live numbers from the public website (visitors, AI advisor chats, quote
  // requests). Present when the cloud portal is connected and reachable.
  let websiteAnalyticsCtx = 'Website analytics unavailable right now.'
  if (websiteAnalytics && websiteAnalytics.totals) {
    const today = new Date().toISOString().slice(0, 10)
    const todayRow = (websiteAnalytics.daily || []).find(d => d.day === today);
    websiteAnalyticsCtx = {
      windowDays: websiteAnalytics.days,
      today: { date: today, pageViews: todayRow?.views || 0, uniqueVisitors: todayRow?.visitors || 0 },
      totals: websiteAnalytics.totals,
      last7Days: (websiteAnalytics.daily || []).slice(-7),
      topPages: websiteAnalytics.topPaths || [],
      recentAiConversations: (websiteAnalytics.recentAiChats || []).slice(0, 12).map(c => ({
        when: c.ts, who: c.type === 'client_chat' ? `client: ${c.visitor}` : 'site visitor', said: c.text
      })),
    };
  }

  return {
    websiteAnalytics: websiteAnalyticsCtx,
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
    contacts, // pass entire contacts array since it's a general address book
    knowledgeBase, // SOPs and internal rules for the AI
    aiMemory: aiMemoryCtx, // your persistent memory: consult before answering, maintain with SAVE/UPDATE/DELETE_MEMORY
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

// PASS 1 prompt — Classifier triage.
function classifierPrompt(context, schemaText, research = []) {
  const schemaDescription = schemaText || `{
  "decision": "ACT" | "CLARIFY" | "SEARCH",
  "suggestedActions": string[],
  "searchQueries": string[],
  "clarifyingQuestion": string
}`;

  return `You are the triage classifier for QuoteFlow, a business and project workspace.
In this pass, analyze the user's request and provide a quick triage decision.
Your only job is to categorize the turn and identify which actions/tools might be useful.

Adapt your assumptions to the configured business profile (e.g. event planning, construction, digital agency). 
Follow the personaStatement in the business profile for tone and behavior.

Current Application Context:
${JSON.stringify(context, null, 2)}
${researchSection(research)}

Evaluate the user's message and return a JSON object matching exactly this schema:
${schemaDescription}

Rules:
1. "decision" MUST be one of:
   - "SEARCH": You need to perform web search first to get details/prices. Specify queries.
   - "CLARIFY": You are missing essential details to do the work. Ask a question.
   - "ACT": You have enough context to proceed with database or backend operations.
2. "suggestedActions" is a list of action types you guess will be needed (e.g., "CREATE_CLIENT", "CREATE_PROJECT", "SEND_SMS", "RUN_COMMAND", etc.). It is just a suggestion to guide the reasoning model in the next pass.
3. Do not include any explanations, reasoning paragraphs, or conversational filler outside the JSON. Return only the JSON object. Do not wrap in markdown code blocks.`;
}

// PASS 2 prompt — execute based on triage suggestions.
function executionPrompt(context, classifierTriage, research = []) {
  const triageText = classifierTriage 
    ? `Triage Pre-Pass Suggestions:\n${JSON.stringify(classifierTriage, null, 2)}` 
    : '(none)';

  return `You are the reasoning and execution core for QuoteFlow. 
A fast triage pre-pass has analyzed the user request and provided suggested tools/actions. Your job is to translate the user's request into precise database actions and a conversational confirmation response.

Adapt your vocabulary and behavior to the personaStatement in the business profile.

Current Application Context:
${JSON.stringify(context, null, 2)}
${researchSection(research)}

Classifier triage pre-pass findings (use these as a guidance head start, but evaluate them critically):
${triageText}

Return a STRICT JSON object with exactly two fields:
1. "actions": Array of action objects matching the schema below.
2. "response": Natural language confirmation to display and speak to the user. Concise, friendly, professional. Do not use Markdown code blocks.

${ACTION_SCHEMA}

Rules:
- CRITICAL: You have access to a calculation engine. Never do math in your head. Instead, write the raw formula as a string in numeric payload fields (quantity, materialCost, laborHours, laborRate, markupPercent, taxPercent). For example: "quantity": "12 * 15 * 1.10" or "laborHours": "(180 / 50) * 1.5". The system solves them exactly.
- CRITICAL PRICING: Unit prices are NOT yours to invent. For every cataloged product, service, fee, rental, or other line item, set its "catalogId"; the system then uses the catalog's authoritative unit price. If you researched a price for a NEW item, emit a CREATE_CATALOG_ITEM (assign it a temporary id like "cat-tmp-1", set the researched price and source store) and reference that same id as the catalogId of the quote item — this builds the catalog as you quote. If the user explicitly gave a price for an uncataloged item, put that exact number in materialCost. Otherwise omit it and ask for pricing.
- TIME may be estimated when appropriate: laborHours represents billable or internal service time per unit. Use zero when time does not apply.
- Resolve "this project" / "active job" to activeProjectId (${context.activeProjectId}).
- Resolve named clients/projects to their existing IDs from the context.
- To create a NEW client and immediately a project (and/or quote items) for them in the SAME turn: assign a unique temporary id to the CREATE_CLIENT payload (e.g. "id": "c-tmp-1") and reuse that exact string as the project's clientId. Likewise assign a temporary id to CREATE_PROJECT (e.g. "id": "p-tmp-1") and reuse it as the projectId for that turn's quote items. Never reference an id that neither exists in the context nor is created earlier in this same actions array.
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
      const sliced = trimmed.slice(start, end + 1);
      try {
        return JSON.parse(sliced);
      } catch (sliceErr) {
        try {
          // Attempt to fix common small-model errors like trailing commas
          let fixed = sliced.replace(/,\s*([}\]])/g, '$1');
          return JSON.parse(fixed);
        } catch (regexErr) {
          throw sliceErr; // throw original slice error for repair loop
        }
      }
    }
    throw firstErr;
  }
}

// One OpenRouter chat round-trip. Returns the raw assistant content string.
async function postChat(messages, settings, jsonMode = true, classifierModel) {
  // Only ever use models the user picked in Settings. If a message carries an
  // image and a dedicated vision model is set, use it; otherwise fall back to
  // the user's main model (which for most modern models handles images too).
  // No hardcoded model slugs anywhere — nothing can silently bill a model
  // nobody chose, and no dead default slug can break image requests.
  const hasImage = messages.some(m => Array.isArray(m.content) && m.content.some(c => c?.type === 'image_url'));
  let targetModel = settings.openRouterModel;
  if (classifierModel) {
    targetModel = classifierModel;
  } else if (hasImage && settings.openRouterVisionModel) {
    targetModel = settings.openRouterVisionModel;
  }
  if (!targetModel) {
    throw new Error('No AI model is selected. Open System Settings and choose an OpenRouter model before using the assistant.');
  }

  const isOllama = targetModel.startsWith('ollama/');
  const actualModel = isOllama ? targetModel.replace('ollama/', '') : targetModel;
  const endpointUrl = isOllama ? '/api/ollama/api/chat' : OPENROUTER_URL;

  const headers = { 'Content-Type': 'application/json' };
  if (!isOllama) {
    headers['HTTP-Referer'] = 'http://localhost:5173/';
    headers['X-Title'] = 'QuoteFlow Business Estimate Chat';
  }

  const payload = isOllama 
    ? {
        model: actualModel,
        messages,
        ...(jsonMode && { format: 'json' }),
        stream: false,
        options: { num_predict: MAX_OUTPUT_TOKENS }
      }
    : {
        model: actualModel,
        messages,
        ...(jsonMode && { response_format: { type: 'json_object' } }),
        max_tokens: MAX_OUTPUT_TOKENS
      };

  const response = await fetch(endpointUrl, {
    method: 'POST',
    headers,
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    const errData = await response.json().catch(() => ({}));
    const errMsg = errData.error?.message || errData.error || `API Error: ${response.status}`;
    const isModelErr = response.status === 404 || errMsg.toLowerCase().includes('model') || errMsg.toLowerCase().includes('not found') || errMsg.toLowerCase().includes('invalid');
    if (isModelErr) {
      throw new Error(`MODEL_NOT_FOUND: ${errMsg}`);
    }
    throw new Error(errMsg);
  }

  const resData = await response.json();

  if (resData.error) {
    const errMsg = resData.error.message || resData.error || 'The AI provider returned an error response.';
    const isModelErr = errMsg.toLowerCase().includes('model') || errMsg.toLowerCase().includes('not found') || errMsg.toLowerCase().includes('invalid');
    if (isModelErr) {
      throw new Error(`MODEL_NOT_FOUND: ${errMsg}`);
    }
    throw new Error(errMsg);
  }

  const contentText = isOllama ? resData.message?.content : resData.choices?.[0]?.message?.content;
  if (!contentText) {
    throw new Error('The model returned no content. It may have been blocked or encountered an error.');
  }

  const finishReason = isOllama ? (resData.done_reason || (resData.done ? 'stop' : 'length')) : resData.choices?.[0]?.finish_reason;
  return { content: contentText, finishReason };
}

// Chat call with a self-repair loop: if the reply won't parse as JSON, we send
// the model its own broken output plus the parser's exact error and ask it to
// fix and re-emit. The full system prompt + context ride along on every retry,
// so the model can correct a semantic slip (bad id, missing field) — not just a
// stray comma. Returns the parsed JSON content object.
async function callOpenRouter({ systemPrompt, history, userMessage, settings, classifierModel }) {
  const baseMessages = [
    { role: 'system', content: systemPrompt },
    ...(history || []),
    { role: 'user', content: userMessage }
  ];

  let accumulatedContent = '';
  let lastError = null;
  let isContinuation = false;
  let activeClassifierModel = classifierModel;

  for (let attempt = 0; attempt <= MAX_PARSE_RETRIES; attempt++) {
    let messages;
    
    if (attempt === 0) {
      messages = baseMessages;
    } else if (isContinuation) {
      messages = [
        ...baseMessages,
        { role: 'assistant', content: accumulatedContent },
        {
          role: 'user',
          content: `Your previous response was cut off due to length limits. Please continue EXACTLY where you left off. Do not repeat anything you've already output, just output the remainder of the JSON.`
        }
      ];
    } else {
      messages = [
        ...baseMessages,
        { role: 'assistant', content: accumulatedContent },
        {
          role: 'user',
          content: `Your previous response could not be parsed as JSON. The parser reported: "${lastError?.message || lastError}". Re-read your previous message, locate and fix the error (e.g. a stray sentence, a trailing comma, a missing brace or quote, an unfinished value), and return ONLY the corrected, complete JSON object — no explanation, no markdown code fences.`
        }
      ];
    }

    let chatResult;
    try {
      chatResult = await postChat(messages, settings, true, activeClassifierModel);
    } catch (err) {
      const modelToFallBack = activeClassifierModel || settings.openRouterModel;
      
      // If ANY model error occurs (rate limits, not found, server error, etc.)
      // and we are not already on the fallback model, automatically heal!
      if (modelToFallBack !== FALLBACK_MODEL) {
        console.warn(`Model ${modelToFallBack} failed with error: "${err.message}". Falling back to ${FALLBACK_MODEL}...`);

        if (activeClassifierModel) {
          settings.openRouterClassifierModel = FALLBACK_MODEL;
          activeClassifierModel = FALLBACK_MODEL;
        } else {
          settings.openRouterModel = FALLBACK_MODEL;
        }
        if (settings.openRouterVisionModel) {
          settings.openRouterVisionModel = FALLBACK_MODEL;
        }
        
        try {
          saveSettings(settings);
          await fetch('/api/host-config', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(settings),
          }).catch(e => console.error("Failed to sync fallback config", e));
        } catch (saveErr) {
          console.error("Failed to save fallback settings", saveErr);
        }
        
        attempt--; // Retry this attempt with the fallback model
        isContinuation = false;
        continue;
      }
      
      // If we are already on the fallback model and it fails, throw the API error immediately
      throw err;
    }

    const { content, finishReason } = chatResult;
    
    if (isContinuation) {
      accumulatedContent += content;
    } else {
      accumulatedContent = content;
    }

    if (finishReason === 'length' || finishReason === 'max_tokens') {
      isContinuation = true;
      lastError = new Error('Output cut off by length limits.');
      continue;
    }

    try {
      return parseJsonLoose(accumulatedContent);
    } catch (err) {
      lastError = err;
      isContinuation = false;
    }
  }

  const parseErr = new Error(`The model did not return valid JSON after ${MAX_PARSE_RETRIES + 1} attempts (last parser error: ${lastError?.message || lastError}).`);
  parseErr.rawContent = accumulatedContent;
  throw parseErr;
}

// Reason why a single action is invalid, or null if it passes. `clientIds` and
// `projectIds` are mutable sets seeded with existing ids and extended with ids
// minted earlier in the same batch.
function actionRejectionReason(action, clientIds, projectIds, catalogIds, taskIds, contactIds, knowledgeBaseIds, memoryIds) {
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
    case 'CREATE_CONTACT':
      return payload.name ? null : 'CREATE_CONTACT missing name';
    case 'UPDATE_CONTACT':
      return contactIds.has(payload.id) ? null : `UPDATE_CONTACT references unknown contact "${payload.id}"`;
    case 'DELETE_CONTACT':
      return contactIds.has(payload.id) ? null : `DELETE_CONTACT references unknown contact "${payload.id}"`;
    case 'CREATE_PROJECT':
      if (!payload.name) return 'CREATE_PROJECT missing name';
      if (payload.clientId !== undefined && !clientIds.has(payload.clientId)) return `CREATE_PROJECT references unknown client "${payload.clientId}" — create the client first`;
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
    case 'ADD_PROJECT_LOG':
      if (!projectIds.has(payload.projectId)) return `ADD_PROJECT_LOG references unknown project "${payload.projectId}"`;
      return payload.message ? null : 'ADD_PROJECT_LOG missing message';
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
    case 'SEND_EMAIL_TO_CLIENT':
      if (!clientIds.has(payload.clientId)) return `SEND_EMAIL_TO_CLIENT references unknown client "${payload.clientId}"`;
      if (!payload.subject || !payload.htmlBody) return 'SEND_EMAIL_TO_CLIENT missing subject or htmlBody';
      return null;
    case 'SEND_SMS':
      if (!payload.to || !payload.message) return 'SEND_SMS missing to or message';
      return null;
    case 'WRITE_FILE':
      return (payload.path && payload.content) ? null : 'WRITE_FILE missing path or content';
    case 'READ_FILE':
      return payload.path ? null : 'READ_FILE missing path';
    case 'RUN_COMMAND':
      return payload.command ? null : 'RUN_COMMAND missing command';
    case 'SPAWN_SUBAGENT':
      return (payload.role && payload.task) ? null : 'SPAWN_SUBAGENT missing role or task';
    case 'SAVE_MEMORY':
      if (!payload.content) return 'SAVE_MEMORY missing content';
      if (payload.memoryType !== undefined && !['short', 'long', 'episodic'].includes(payload.memoryType)) return `SAVE_MEMORY has invalid memoryType "${payload.memoryType}"`;
      return null;
    case 'UPDATE_MEMORY':
      if (!memoryIds.has(payload.id)) return `UPDATE_MEMORY references unknown memory "${payload.id}"`;
      if (payload.content === undefined && payload.tags === undefined) return 'UPDATE_MEMORY has nothing to change';
      return null;
    case 'DELETE_MEMORY':
      return memoryIds.has(payload.id) ? null : `DELETE_MEMORY references unknown memory "${payload.id}"`;
    case 'CREATE_KNOWLEDGE_ARTICLE':
      return (payload.title && payload.content) ? null : 'CREATE_KNOWLEDGE_ARTICLE missing title or content';
    case 'UPDATE_KNOWLEDGE_ARTICLE':
      if (!knowledgeBaseIds.has(payload.id)) return `UPDATE_KNOWLEDGE_ARTICLE references unknown article "${payload.id}"`;
      return null;
    case 'DELETE_KNOWLEDGE_ARTICLE':
      if (!knowledgeBaseIds.has(payload.id)) return `DELETE_KNOWLEDGE_ARTICLE references unknown article "${payload.id}"`;
      return null;
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
      const isUrl = /^https?:\/\//i.test(query);
      if (isUrl) {
        const response = await fetch(`/api/agent/url?url=${encodeURIComponent(query)}`, { cache: 'no-store' });
        const data = await response.json().catch(() => ({}));
        found.push({
          query,
          results: response.ok ? [{ title: `Page Content from ${query}`, url: query, snippet: data.content || 'Empty page.' }] : [],
          error: response.ok ? null : (data.error || `fetch failed (${response.status})`)
        });
      } else {
        const response = await fetch(`/api/search?q=${encodeURIComponent(query)}`, { cache: 'no-store' });
        const data = await response.json().catch(() => ({}));
        found.push({
          query,
          results: Array.isArray(data.results) ? data.results : [],
          error: response.ok ? null : (data.error || `search failed (${response.status})`)
        });
      }
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
  const clientIds = new Set((context.clients || []).map(c => c.id));
  const projectIds = new Set((context.projects || []).map(p => p.id));
  const catalogIds = new Set((context.priceCatalog || []).map(i => i.id));
  const taskIds = new Set((context.tasks || []).map(t => t.id));
  const contactIds = new Set((context.contacts || []).map(c => c.id));
  const knowledgeBaseIds = new Set((context.knowledgeBase || []).map(k => k.id));
  // Memory ids come from the same context snapshot the model saw, so it can
  // only update or delete memories that were actually in its prompt.
  const memoryCtx = context.aiMemory || {};
  const memoryIds = new Set(
    [...(memoryCtx.longTerm || []), ...(memoryCtx.episodic || []), ...(memoryCtx.shortTerm || [])].map(m => m.id)
  );

  for (const action of actions) {
    const normalizedAction = normalizeAction(action);
    const reason = actionRejectionReason(normalizedAction, clientIds, projectIds, catalogIds, taskIds, contactIds, knowledgeBaseIds, memoryIds);
    if (reason) {
      rejected.push({ action: normalizedAction, originalAction: action, reason });
      continue;
    }
    valid.push(normalizedAction);
    // Register ids minted in this batch so later actions can reference them.
    if (normalizedAction.type === 'CREATE_CLIENT' && normalizedAction.payload?.id) clientIds.add(normalizedAction.payload.id);
    if (normalizedAction.type === 'CREATE_CONTACT' && normalizedAction.payload?.id) contactIds.add(normalizedAction.payload.id);
    if (normalizedAction.type === 'CREATE_PROJECT' && normalizedAction.payload?.id) projectIds.add(normalizedAction.payload.id);
    if (normalizedAction.type === 'CREATE_CATALOG_ITEM' && normalizedAction.payload?.id) catalogIds.add(normalizedAction.payload.id);
    if (normalizedAction.type === 'CREATE_TASK' && normalizedAction.payload?.id) taskIds.add(normalizedAction.payload.id);
    if (normalizedAction.type === 'CREATE_KNOWLEDGE_ARTICLE' && normalizedAction.payload?.id) knowledgeBaseIds.add(normalizedAction.payload.id);
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
    try {
      planning = await callOpenRouter({
        systemPrompt: classifierPrompt(context, settings.classifierSchema, research),
        history,
        userMessage,
        settings,
        classifierModel: settings.openRouterClassifierModel
      });
    } catch (err) {
      if (err.rawContent) {
        return {
          decision: 'CLARIFY',
          reasoning: 'Classifier pre-pass returned plain text response instead of structured JSON.',
          actions: [],
          rejected: [],
          response: err.rawContent.trim()
        };
      }
      throw err;
    }

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
  const suggestedTools = Array.isArray(planning.suggestedActions) ? planning.suggestedActions : [];
  const reasoningSummary = `Triage decision: ${decision}. Suggested actions/tools: [${suggestedTools.join(', ')}].`;

  // CLARIFY short-circuits: no execution, no DB writes, conversation stays open.
  if (decision !== 'ACT') {
    return {
      decision: 'CLARIFY',
      reasoning: reasoningSummary,
      actions: [],
      rejected: [],
      response: planning.clarifyingQuestion || 'Could you give me a little more detail so I can set this up correctly?'
    };
  }

  // PASS 2 — execute.
  onPhase?.('executing');
  let execResult;
  try {
    execResult = await callOpenRouter({
      systemPrompt: executionPrompt(context, planning, research),
      history,
      userMessage,
      settings
    });
  } catch (err) {
    if (err.rawContent) {
      return {
        decision: 'CLARIFY',
        reasoning: 'Plan execution failed to parse as JSON. Returning raw text response.',
        actions: [],
        rejected: [],
        response: err.rawContent.trim()
      };
    }
    throw err;
  }

  const proposedActions = Array.isArray(execResult.actions) ? execResult.actions : [];
  let response = execResult.response || 'Executed successfully.';

  // GATE — validate before anything is dispatched.
  const { valid, rejected } = validateActions(proposedActions, context);
  if (rejected.length > 0) {
    response += ` (Note: I held back ${rejected.length} step(s) that didn't pass validation: ${rejected.map(r => r.reason).join('; ')}.)`;
  }

  return { decision: 'ACT', reasoning: reasoningSummary, actions: valid, response, rejected };
}

// Enhances a persona string using the configured AI model.
export async function enhancePersona(currentPersona, settings) {
  const messages = [
    {
      role: 'system',
      content: 'You are an expert prompt engineer. The user will provide a rough draft of an AI persona or instructions. Your job is to enhance it into a highly effective, professional, and detailed system prompt. Add structure, specify tone, clarify decision-making boundaries, and make it robust. Return ONLY the enhanced persona text. Do not wrap it in quotes or markdown formatting, just the raw text.'
    },
    { role: 'user', content: currentPersona || 'You are a helpful assistant for a quoting and business management app.' }
  ];

  const result = await postChat(messages, settings, false);
  return result.content.trim();
}
