import React, { useState, useEffect, useRef } from 'react';
import { Sparkles, Mic, MicOff, Send, Volume2, VolumeX, Loader2, Database, AlertCircle } from 'lucide-react';
import { dispatchNLPActions } from '../utils/dataStore';

export default function AIChat({ 
  projects, 
  clients, 
  settings, 
  activeProjectId, 
  currentView,
  onProjectsChange,
  onClientsChange,
  setCurrentView,
  setActiveProjectId
}) {
  const [messages, setMessages] = useState([
    {
      id: 'm-init',
      sender: 'ai',
      text: 'Hello! I am your Apex Remodeling Voice Assistant. Speak or type instructions (e.g. "Add client Clark Kent", "Open kitchen project quote", "Add drywall demolition to Kitchen room"), and I will execute the actions on your database instantly.',
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      actions: []
    }
  ]);
  const [inputText, setInputText] = useState('');
  const [isListening, setIsListening] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [ttsEnabled, setTtsEnabled] = useState(true);
  
  // Speech Synthesis states
  const [voices, setVoices] = useState([]);
  const [selectedVoiceName, setSelectedVoiceName] = useState('');
  
  const chatEndRef = useRef(null);
  const recognitionRef = useRef(null);

  const hasApiKey = !!settings.openRouterKey;

  // Initialize Speech Recognition & Speech Synthesis
  useEffect(() => {
    // 1. Setup speech recognition
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SpeechRecognition) {
      const rec = new SpeechRecognition();
      rec.continuous = false;
      rec.interimResults = false;
      rec.lang = 'en-US';

      rec.onstart = () => {
        setIsListening(true);
      };

      rec.onresult = (event) => {
        const transcript = event.results[0][0].transcript;
        setInputText(prev => {
          const spacing = prev ? ' ' : '';
          return prev + spacing + transcript;
        });
      };

      rec.onerror = (event) => {
        console.error('Speech recognition error:', event.error);
        setIsListening(false);
      };

      rec.onend = () => {
        setIsListening(false);
      };

      recognitionRef.current = rec;
    }

    // 2. Setup speech synthesis voices
    if (window.speechSynthesis) {
      const loadVoices = () => {
        const availableVoices = window.speechSynthesis.getVoices();
        setVoices(availableVoices);
        // Default to a natural Google or Microsoft Edge voice if present, else first
        const defaultVoice = availableVoices.find(v => 
          v.name.includes('Natural') || 
          v.name.includes('Google') || 
          v.name.includes('Microsoft')
        ) || availableVoices[0];
        
        if (defaultVoice) {
          setSelectedVoiceName(defaultVoice.name);
        }
      };

      loadVoices();
      if (window.speechSynthesis.onvoiceschanged !== undefined) {
        window.speechSynthesis.onvoiceschanged = loadVoices;
      }
    }
  }, []);

  // Auto-scroll chat to bottom
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  // Voice output / Text-to-Speech function
  const speakText = (text) => {
    if (!ttsEnabled || !window.speechSynthesis) return;
    
    // Cancel any active speech first
    window.speechSynthesis.cancel();
    
    const utterance = new SpeechSynthesisUtterance(text);
    if (selectedVoiceName) {
      const voiceObj = voices.find(v => v.name === selectedVoiceName);
      if (voiceObj) utterance.voice = voiceObj;
    }
    
    window.speechSynthesis.speak(utterance);
  };

  // Toggle Microphone
  const toggleListening = () => {
    if (!recognitionRef.current) {
      alert('Speech Recognition API is not supported in this browser. Please use Google Chrome, MS Edge, or Safari.');
      return;
    }

    if (isListening) {
      recognitionRef.current.stop();
    } else {
      recognitionRef.current.start();
    }
  };

  // Chat message submit
  const handleSendMessage = async (e) => {
    e.preventDefault();
    const query = inputText.trim();
    if (!query || isLoading) return;

    // Add user message to screen
    const userMsg = {
      id: `msg-${Date.now()}`,
      sender: 'user',
      text: query,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    setMessages(prev => [...prev, userMsg]);
    setInputText('');
    
    if (!hasApiKey) {
      setMessages(prev => [...prev, {
        id: `msg-err-${Date.now()}`,
        sender: 'ai',
        text: 'Error: OpenRouter API key is missing. Please head to System Settings, configure your OpenRouter key, and try again.',
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        error: true
      }]);
      speakText('OpenRouter key is missing. Please configure it in settings.');
      return;
    }

    setIsLoading(true);

    try {
      // 1. Prepare minimal DB context
      const clientsCtx = clients.map(c => ({
        id: c.id,
        name: c.name,
        company: c.company || '',
        email: c.email || '',
        phone: c.phone || '',
        address: c.address || ''
      }));

      const projectsCtx = projects.map(p => {
        const summary = {
          id: p.id,
          name: p.name,
          clientId: p.clientId,
          status: p.status
        };
        
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
        currentDate: new Date().toISOString().slice(0, 10),
        currentTime: new Date().toLocaleTimeString(),
        currentView,
        activeProjectId: activeProjectId || 'None',
        activeProjectName,
        clients: clientsCtx,
        projects: projectsCtx
      };

      // 2. System instructions for conversational JSON actions
      const systemPrompt = `You are the conversational NLP interface for Apex Estimate.
You translate the user's natural language spoken chat instruction into database actions AND formulate a highly helpful vocalized confirmation response.

Context:
${JSON.stringify(promptContext, null, 2)}

Return a strict JSON object with:
1. "actions": Array of command actions to execute.
2. "response": Natural language confirmation text to display and speak to the contractor. Keep it concise, friendly, and professional (e.g. "I've added the kitchen tile drywall item and updated your estimate summary.").

Available Actions Schema:
- { "type": "CREATE_CLIENT", "payload": { "name": string, "company": string, "email": string, "phone": string, "address": string, "notes": string } }
- { "type": "UPDATE_CLIENT", "payload": { "id": string, "name": string, "company": string, "email": string, "phone": string, "address": string, "notes": string } }
- { "type": "DELETE_CLIENT", "payload": { "id": string } }
- { "type": "CREATE_PROJECT", "payload": { "name": string, "clientId": string, "status": "lead"|"quoting"|"scheduled"|"progress"|"completed" } }
- { "type": "UPDATE_PROJECT_STATUS", "payload": { "id": string, "status": "lead"|"quoting"|"scheduled"|"progress"|"completed" } }
- { "type": "ADD_QUOTE_ITEM", "payload": { "projectId": string, "roomName": string, "name": string, "category": string, "quantity": number|string, "unit": string, "materialCost": number|string, "laborHours": number|string } }
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
- Resolve "this project" or "active project" to activeProjectId (${activeProjectId || 'None'}).
- Resolve named entities (clients, projects) to their database IDs.
- Format response for easy reading and speaking. Do not use Markdown codeblocks.`;

      const requestBody = {
        model: settings.openRouterModel || 'google/gemini-2.5-flash',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: query }
        ],
        response_format: { type: 'json_object' }
      };

      const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
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
      const contentText = resData.choices[0]?.message?.content;
      if (!contentText) throw new Error('Empty response from OpenRouter.');

      const resultObj = JSON.parse(contentText);
      const parsedActions = resultObj.actions || [];
      const parsedResponse = resultObj.response || 'Executed successfully.';

      // 3. Dispatch mutations to the local database
      dispatchNLPActions(parsedActions, {
        setProjects: onProjectsChange,
        setClients: onClientsChange,
        setCurrentView,
        setActiveProjectId
      });

      // 4. Update Chat Log
      setMessages(prev => [...prev, {
        id: `msg-ai-${Date.now()}`,
        sender: 'ai',
        text: parsedResponse,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        actions: parsedActions
      }]);

      // 5. Vocalize response
      speakText(parsedResponse);

    } catch (err) {
      console.error(err);
      setMessages(prev => [...prev, {
        id: `msg-err-${Date.now()}`,
        sender: 'ai',
        text: `Error parsing command: ${err.message || 'Check connection or key settings.'}`,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        error: true
      }]);
      speakText('An error occurred during communication.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 130px)', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-secondary)' }}>
      
      {/* Voice Controls Bar */}
      <div 
        style={{ 
          padding: '12px 24px', 
          borderBottom: '1px solid var(--border-color)', 
          backgroundColor: 'var(--bg-tertiary)',
          display: 'flex', 
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '12px'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px' }}>
          <Volume2 size={16} style={{ color: 'var(--accent)' }} />
          <strong>Audio Synthesis Engine</strong>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          {/* Mute Button */}
          <button 
            className={`btn btn-sm ${ttsEnabled ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => {
              setTtsEnabled(!ttsEnabled);
              if (ttsEnabled && window.speechSynthesis) window.speechSynthesis.cancel();
            }}
            title={ttsEnabled ? "Mute TTS response" : "Unmute TTS response"}
          >
            {ttsEnabled ? (
              <>
                <Volume2 size={12} /> Text-To-Speech: ON
              </>
            ) : (
              <>
                <VolumeX size={12} style={{ color: 'var(--danger)' }} /> Text-To-Speech: OFF
              </>
            )}
          </button>

          {/* Voice Selector */}
          {voices.length > 0 && ttsEnabled && (
            <select
              className="input-field"
              style={{ padding: '4px 8px', fontSize: '12px', width: '220px', backgroundColor: 'var(--bg-primary)' }}
              value={selectedVoiceName}
              onChange={(e) => {
                setSelectedVoiceName(e.target.value);
                // test selected voice
                const testUtterance = new SpeechSynthesisUtterance("Voice Selected.");
                const voiceObj = voices.find(v => v.name === e.target.value);
                if (voiceObj) testUtterance.voice = voiceObj;
                window.speechSynthesis.cancel();
                window.speechSynthesis.speak(testUtterance);
              }}
            >
              {voices.map(voice => (
                <option key={voice.name} value={voice.name}>
                  {voice.name} ({voice.lang})
                </option>
              ))}
            </select>
          )}
        </div>
      </div>

      {/* Messages Viewport */}
      <div style={{ flex: 1, padding: '24px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '16px' }}>
        {messages.map(msg => {
          const isAi = msg.sender === 'ai';
          return (
            <div 
              key={msg.id}
              style={{
                display: 'flex',
                justifyContent: isAi ? 'flex-start' : 'flex-end',
                width: '100%'
              }}
            >
              <div 
                style={{
                  maxWidth: '75%',
                  border: '1px solid',
                  borderColor: msg.error 
                    ? 'var(--danger)' 
                    : isAi ? 'var(--border-color-active)' : 'var(--border-color)',
                  backgroundColor: isAi ? 'var(--bg-primary)' : 'var(--bg-tertiary)',
                  padding: '16px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '8px'
                }}
              >
                {/* Header info */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '24px' }}>
                  <span style={{ fontSize: '10px', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    {isAi ? (
                      <>
                        <Sparkles size={10} style={{ color: 'var(--accent)' }} /> Apex Voice AI
                      </>
                    ) : (
                      'Contractor (You)'
                    )}
                  </span>
                  <span style={{ fontSize: '10px', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                    {msg.timestamp}
                  </span>
                </div>

                {/* Msg text */}
                <div style={{ fontSize: '13.5px', lineHeight: '1.5', color: msg.error ? 'var(--danger)' : 'var(--text-primary)' }}>
                  {msg.text}
                </div>

                {/* Database logs mutator indicator */}
                {isAi && msg.actions && msg.actions.length > 0 && (
                  <div style={{ borderTop: '1px solid var(--border-color)', marginTop: '8px', paddingTop: '8px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <div style={{ fontSize: '9px', fontWeight: 'bold', textTransform: 'uppercase', color: 'var(--success)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <Database size={9} /> Database Mutations Dispatched:
                    </div>
                    {msg.actions.map((act, aIdx) => (
                      <div key={aIdx} style={{ fontSize: '10px', fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)', paddingLeft: '8px' }}>
                        ➔ {act.type} {act.payload.name || act.payload.title || act.payload.view || ''}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          );
        })}

        {isLoading && (
          <div style={{ display: 'flex', justifyContent: 'flex-start', width: '100%' }}>
            <div style={{ border: '1px dashed var(--border-color)', padding: '12px 16px', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', color: 'var(--text-secondary)' }}>
              <Loader2 size={12} className="animate-spin" style={{ color: 'var(--accent)' }} /> Analyzing instruction & synthesizing updates...
            </div>
          </div>
        )}
        <div ref={chatEndRef} />
      </div>

      {/* Input console */}
      <div style={{ padding: '18px 24px', borderTop: '1px solid var(--border-color)', backgroundColor: 'var(--bg-tertiary)' }}>
        <form onSubmit={handleSendMessage} style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
          
          {/* Mic Button */}
          <button 
            type="button" 
            className={`btn`} 
            style={{ 
              borderRadius: '0px', 
              padding: '12px',
              backgroundColor: isListening ? 'var(--danger-muted)' : 'var(--bg-primary)',
              borderColor: isListening ? 'var(--danger)' : 'var(--border-color)',
              color: isListening ? 'var(--danger)' : 'var(--text-primary)',
              boxShadow: isListening ? '0 0 10px rgba(239, 68, 68, 0.4)' : 'none'
            }}
            onClick={toggleListening}
            title={isListening ? "Stop listening" : "Record voice input"}
            disabled={isLoading}
          >
            {isListening ? (
              <MicOff size={16} className="animate-pulse" />
            ) : (
              <Mic size={16} />
            )}
          </button>

          {/* Text Input */}
          <input 
            type="text" 
            className="input-field"
            style={{ flex: 1, padding: '12px 16px', backgroundColor: 'var(--bg-primary)' }}
            placeholder={
              isListening 
                ? "Listening... Speak clearly into your mic." 
                : "Type remodeling instructions or toggle microphone..."
            }
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            disabled={isLoading || isListening}
          />

          {/* Send Button */}
          <button 
            type="submit" 
            className="btn btn-primary"
            style={{ padding: '12px 20px', height: '100%' }}
            disabled={!inputText.trim() || isLoading || isListening}
          >
            <Send size={14} /> Send
          </button>
        </form>
      </div>

    </div>
  );
}
