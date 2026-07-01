import React, { useState, useEffect, useRef } from 'react';
import { Sparkles, Loader2, CheckCircle2, AlertCircle, X, CornerDownLeft } from 'lucide-react';
import { dispatchNLPActions } from '../utils/dataStore';

export default function AICommandLine({ 
  projects, 
  clients, 
  settings, 
  activeProjectId, 
  currentView,
  onProjectsChange,
  onClientsChange,
  onCatalogChange,
  setCurrentView,
  setActiveProjectId
}) {
  const [command, setCommand] = useState('');
  const [status, setStatus] = useState('idle'); // idle | thinking | success | error
  const [responseMsg, setResponseMsg] = useState('');
  const [showStatusPanel, setShowStatusPanel] = useState(false);
  const statusTimerRef = useRef(null);

  const hasApiKey = !!(settings.openRouterConfigured || settings.openRouterKey);

  // Clear timers on unmount
  useEffect(() => {
    return () => {
      if (statusTimerRef.current) clearTimeout(statusTimerRef.current);
    };
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!command.trim() || !hasApiKey || status === 'thinking') return;

    setStatus('thinking');
    setResponseMsg('');
    setShowStatusPanel(true);

    try {
      // 1. Prepare clean context for the LLM
      const clientsCtx = clients.map(c => ({
        id: c.id,
        name: c.name,
        company: c.company || '',
        email: c.email || '',
        phone: c.phone || '',
        address: c.address || ''
      }));

      const projectsCtx = projects.map(p => {
        // Summary details only to keep prompt size tiny
        const summary = {
          id: p.id,
          name: p.name,
          clientId: p.clientId,
          status: p.status
        };
        
        // Full detail only for the active project
        if (p.id === activeProjectId) {
          summary.checklists = p.checklists.map(c => ({ id: c.id, text: c.text, completed: c.completed }));
          summary.changeOrders = p.changeOrders.map(co => ({ id: co.id, title: co.title, status: co.status }));
          summary.rooms = p.rooms.map(r => ({
            name: r.name,
            items: r.items.map(item => ({ id: item.id, name: item.name, category: item.category, unit: item.unit, quantity: item.quantity, materialCost: item.materialCost, laborHours: item.laborHours }))
          }));
        }
        
        return summary;
      });

      const activeProjectName = projects.find(p => p.id === activeProjectId)?.name || 'None';

      const promptContext = {
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
        projects: projectsCtx
      };

      // 2. Formulate system prompt with strict schemas
      const systemPrompt = `You are the Natural Language Processing (NLP) core for QuoteFlow, a flexible quoting and project workspace for any line of business.
Your job is to translate the user's instructions into a structured array of JSON actions and formulate a concise professional confirmation. Adapt to the configured business profile. Treat roomName as a generic project section such as a phase, package, deliverable, location, department, or workstream.
Follow the personaStatement in the business profile for tone and behavior unless it conflicts with accuracy or these action rules.

Current Application Context:
${JSON.stringify(promptContext, null, 2)}

You MUST return a JSON object with exactly two fields:
1. "actions": An array of command objects. If no action is needed, return an empty array.
2. "response": A string outlining the changes made or any clarification questions. Speak directly to the user in a helpful, clean tone.

Available Action Types and Payloads:
- { "type": "CREATE_CLIENT", "payload": { "name": string, "company": string, "email": string, "phone": string, "address": string, "notes": string } }
- { "type": "UPDATE_CLIENT", "payload": { "id": string, "name": string, "company": string, "email": string, "phone": string, "address": string, "notes": string } }
- { "type": "DELETE_CLIENT", "payload": { "id": string } }
- { "type": "CREATE_PROJECT", "payload": { "name": string, "clientId": string, "status": "lead"|"quoting"|"scheduled"|"progress"|"completed" } }
- { "type": "UPDATE_PROJECT_STATUS", "payload": { "id": string, "status": "lead"|"quoting"|"scheduled"|"progress"|"completed" } }
- { "type": "ADD_QUOTE_ITEM", "payload": { "projectId": string, "roomName": string (a project section or phase), "name": string, "category": string, "quantity": number|string, "unit": string, "materialCost": number|string, "laborHours": number|string } }
- { "type": "UPDATE_QUOTE_ITEM", "payload": { "projectId": string, "itemId": string, "name": string, "category": string, "quantity": number|string, "unit": string, "materialCost": number|string, "laborHours": number|string } }
- { "type": "DELETE_QUOTE_ITEM", "payload": { "projectId": string, "itemId": string } }
- { "type": "ADD_CHECKLIST_ITEM", "payload": { "projectId": string, "text": string } }
- { "type": "TOGGLE_CHECKLIST_ITEM", "payload": { "projectId": string, "checklistItemId": string } }
- { "type": "CREATE_CHANGE_ORDER", "payload": { "projectId": string, "title": string, "description": string, "items": [ { "name": string, "category": string, "quantity": number|string, "unit": string, "materialCost": number|string, "laborHours": number|string } ] } }
- { "type": "APPROVE_CHANGE_ORDER", "payload": { "projectId": string, "changeOrderId": string } }
- { "type": "REJECT_CHANGE_ORDER", "payload": { "projectId": string, "changeOrderId": string } }
- { "type": "SWITCH_VIEW", "payload": { "view": "dashboard"|"clients"|"quote-builder"|"project-detail"|"settings", "projectId": string (optional) } }

Rules:
- CRITICAL: You have access to a calculation engine. Instead of calculating dimensions, waste factors, or totals in your head (which leads to errors), you MUST write the raw mathematical formula as a string in the payload fields (quantity, materialCost, laborHours, laborRate, markupPercent, taxPercent). For example: "quantity": "12 * 15 * 1.10" or "laborHours": "(180 / 50) * 1.5". The system will solve them. Never try to calculate math in your head.
- If a project command references "this project", "the active job", or similar, map it to the activeProjectId (${activeProjectId || 'None'}).
- If the user references a client or project by name (e.g. "David Miller" or "Miller remodel"), find the matching ID in the provided database context.
- When creating projects, the clientId field MUST be an existing client's ID. If they want to make a project for a new client, write two actions: CREATE_CLIENT first (generates ID, but you can use placeholders like "c-new" or let the engine handle it—actually, in payload, since CREATE_CLIENT generates a new ID, if you need to couple them, you can specify "c-new" as the clientId, and the engine will bind the generated ID automatically). Better: output a response asking them to create the client first, or if the client name is in the database, match it.
- If you switch a view, e.g. SWITCH_VIEW to quote-builder or project-detail, make sure to include the projectId in the payload.
- Always output a valid JSON object containing ONLY "actions" and "response". Do not wrap the JSON in markdown code blocks (\`\`\`json ... \`\`\`).`;

      // 3. Make fetch call to OpenRouter API — only the user's selected model.
      if (!settings.openRouterModel) {
        throw new Error('No AI model is selected. Choose an OpenRouter model in System Settings first.');
      }
      const requestBody = {
        model: settings.openRouterModel,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: command.trim() }
        ],
        response_format: { type: 'json_object' }
      };

      const response = await fetch('/api/openrouter/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'HTTP-Referer': 'http://localhost:5173/',
          'X-Title': 'QuoteFlow Business Estimate'
        },
        body: JSON.stringify(requestBody)
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.error?.message || `API error: ${response.status}`);
      }

      const resData = await response.json();
      const contentText = resData.choices[0]?.message?.content;
      if (!contentText) {
        throw new Error('Empty response received from LLM.');
      }

      // 4. Parse content
      const resultObj = JSON.parse(contentText);
      const parsedActions = resultObj.actions || [];
      const parsedResponse = resultObj.response || 'Commands executed successfully.';

      // 5. Execute actions sequentially
      dispatchNLPActions(parsedActions, {
        setProjects: onProjectsChange,
        setClients: onClientsChange,
        setCatalog: onCatalogChange,
        setCurrentView,
        setActiveProjectId
      });

      setResponseMsg(parsedResponse);
      setStatus('success');
      setCommand('');

      // Auto-hide success panel after 8 seconds
      if (statusTimerRef.current) clearTimeout(statusTimerRef.current);
      statusTimerRef.current = setTimeout(() => {
        setShowStatusPanel(false);
        setStatus('idle');
      }, 8000);

    } catch (err) {
      console.error('NLP Execution failed:', err);
      setResponseMsg(err.message || 'An unknown error occurred while communicating with the AI.');
      setStatus('error');
    }
  };

  return (
    <div style={{ position: 'relative', width: '420px' }} className="no-print">
      {/* Command input form */}
      <form onSubmit={handleSubmit} style={{ width: '100%' }}>
        <div 
          className="input-group" 
          style={{ 
            border: status === 'thinking' ? '1px solid var(--accent)' : '1px solid var(--border-color)',
            backgroundColor: 'var(--bg-primary)'
          }}
        >
          <span className="input-addon" style={{ border: 'none', backgroundColor: 'transparent', padding: '0 10px' }}>
            {status === 'thinking' ? (
              <Loader2 size={14} className="animate-spin" style={{ color: 'var(--accent)' }} />
            ) : (
              <Sparkles size={14} style={{ color: hasApiKey ? 'var(--accent)' : 'var(--text-muted)' }} />
            )}
          </span>
          
          <input 
            type="text"
            className="input-field"
            style={{ 
              border: 'none', 
              fontSize: '12px', 
              padding: '8px 10px',
              backgroundColor: 'transparent'
            }}
            placeholder={
              hasApiKey 
                ? "Type project command (e.g. 'Add client John Doe...')" 
                : "Configure OpenRouter Key in Settings to enable NLP..."
            }
            value={command}
            onChange={(e) => setCommand(e.target.value)}
            disabled={!hasApiKey || status === 'thinking'}
          />

          {command.trim() && hasApiKey && status !== 'thinking' && (
            <button 
              type="submit" 
              className="input-addon" 
              style={{ 
                border: 'none', 
                backgroundColor: 'transparent', 
                cursor: 'pointer',
                padding: '0 10px',
                color: 'var(--accent)'
              }}
              title="Submit Command"
            >
              <CornerDownLeft size={12} />
            </button>
          )}
        </div>
      </form>

      {/* Floating Status / Response Panel */}
      {showStatusPanel && (
        <div 
          style={{
            position: 'absolute',
            top: '42px',
            right: 0,
            width: '420px',
            backgroundColor: 'var(--bg-secondary)',
            border: '1px solid var(--border-color-active)',
            padding: '16px',
            zIndex: 1000,
            boxShadow: '0 8px 16px rgba(0,0,0,0.5)',
            display: 'flex',
            flexDirection: 'column',
            gap: '12px'
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '11px', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '6px' }}>
              {status === 'thinking' && (
                <>
                  <Loader2 size={12} className="animate-spin" style={{ color: 'var(--accent)' }} /> 
                  AI NLP Interpreter Thinking...
                </>
              )}
              {status === 'success' && (
                <>
                  <CheckCircle2 size={12} style={{ color: 'var(--success)' }} /> 
                  Actions Executed
                </>
              )}
              {status === 'error' && (
                <>
                  <AlertCircle size={12} style={{ color: 'var(--danger)' }} /> 
                  Action Failed
                </>
              )}
            </span>

            <button 
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}
              onClick={() => setShowStatusPanel(false)}
            >
              <X size={14} />
            </button>
          </div>

          <div style={{ fontSize: '13px', lineHeight: '1.4', color: status === 'error' ? 'var(--danger)' : 'var(--text-primary)' }}>
            {status === 'thinking' ? 'Analyzing your instruction against the database schema...' : responseMsg}
          </div>

          {status === 'success' && (
            <div style={{ fontSize: '10px', color: 'var(--text-muted)', borderTop: '1px solid var(--border-color)', paddingTop: '8px', textAlign: 'right' }}>
              Auto-closing in 8 seconds
            </div>
          )}
        </div>
      )}
    </div>
  );
}
