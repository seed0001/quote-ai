import React, { useState, useEffect, useRef } from 'react';
import { Sparkles, Mic, MicOff, Send, Volume2, VolumeX, Database, Trash2, BrainCircuit, ChevronDown, Globe } from 'lucide-react';
import { dispatchNLPActions } from '../utils/dataStore';
import { runAgent, buildContext } from '../utils/aiEngine';
import { generateFishSpeech } from '../utils/fishAudio';

// Persist conversation across view changes & reloads (local-first, matches dataStore pattern)
const CHAT_STORAGE_KEY = 'quote_ai_chat_history';

const INITIAL_MESSAGES = [
  {
    id: 'm-init',
    sender: 'ai',
    text: 'Hello! I am your QuoteFlow business assistant. Tell me about a client, project, product, service, deliverable, or quote, and I can organize the work and update your records. For a new quote, describe what your business is providing and I will help fill in the details.',
    timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    actions: []
  }
];

export default function AIChat({
  mobile = false,
  projects,
  clients,
  catalog,
  tasks,
  settings,
  activeProjectId,
  currentView,
  onProjectsChange,
  onClientsChange,
  onCatalogChange,
  onTasksChange,
  setCurrentView,
  setActiveProjectId
}) {
  const [messages, setMessages] = useState(() => {
    try {
      const stored = localStorage.getItem(CHAT_STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch (e) {
      console.error('Error parsing stored chat history', e);
    }
    return INITIAL_MESSAGES;
  });
  const [inputText, setInputText] = useState('');
  const [isListening, setIsListening] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [loadingPhase, setLoadingPhase] = useState('reasoning'); // 'reasoning' | 'executing'
  const [ttsEnabled, setTtsEnabled] = useState(true);
  const [ttsError, setTtsError] = useState('');
  const [selectedPersona, setSelectedPersona] = useState('default');

  // Speech Synthesis states
  const [voices, setVoices] = useState([]);
  const [selectedVoiceName, setSelectedVoiceName] = useState('');

  const chatEndRef = useRef(null);
  const recognitionRef = useRef(null);
  const fishAudioRef = useRef(null);
  const fishAudioUrlRef = useRef('');
  const inputTextRef = useRef('');
  const textBeforeListeningRef = useRef('');

  useEffect(() => {
    inputTextRef.current = inputText;
  }, [inputText]);

  const hasApiKey = !!(settings.openRouterConfigured || settings.openRouterKey);

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
        textBeforeListeningRef.current = inputTextRef.current;
      };

      rec.onresult = (event) => {
        let currentTranscript = '';
        for (let i = 0; i < event.results.length; i++) {
          currentTranscript += event.results[i][0].transcript;
        }
        const base = textBeforeListeningRef.current;
        setInputText((base ? base + ' ' : '') + currentTranscript);
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

  useEffect(() => () => {
    fishAudioRef.current?.pause();
    if (fishAudioUrlRef.current) URL.revokeObjectURL(fishAudioUrlRef.current);
  }, []);

  // Auto-scroll chat to bottom
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  // Persist chat history so it survives navigating between views and reloads
  useEffect(() => {
    try {
      localStorage.setItem(CHAT_STORAGE_KEY, JSON.stringify(messages));
    } catch (e) {
      console.error('Error saving chat history', e);
    }
  }, [messages]);

  // Reset conversation to a fresh start
  const handleClearChat = () => {
    window.speechSynthesis?.cancel();
    fishAudioRef.current?.pause();
    setMessages([{ ...INITIAL_MESSAGES[0], timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) }]);
  };

  // Voice output / Text-to-Speech function
  const speakText = async (text) => {
    if (!ttsEnabled) return;
    setTtsError('');

    window.speechSynthesis?.cancel();
    fishAudioRef.current?.pause();
    if (fishAudioUrlRef.current) {
      URL.revokeObjectURL(fishAudioUrlRef.current);
      fishAudioUrlRef.current = '';
    }

    if ((settings.fishAudioConfigured || settings.fishAudioKey) && settings.fishVoiceId) {
      try {
        const blob = await generateFishSpeech({
          apiKey: settings.fishAudioKey,
          voiceId: settings.fishVoiceId,
          model: settings.fishAudioModel || 's2.1-pro-free',
          text,
        });
        const url = URL.createObjectURL(blob);
        fishAudioUrlRef.current = url;
        const audio = new Audio(url);
        fishAudioRef.current = audio;
        audio.onended = () => {
          URL.revokeObjectURL(url);
          if (fishAudioUrlRef.current === url) fishAudioUrlRef.current = '';
        };
        await audio.play();
        return;
      } catch (error) {
        console.error('Fish Audio TTS failed.', error);
        setTtsError(`Fish Audio failed: ${error.message}`);
        return;
      }
    }

    if (!window.speechSynthesis) return;

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

    // Conversation memory: prior turns (errors excluded), capped to keep requests light.
    // `messages` here is the state before this turn's user message was appended.
    const history = messages
      .filter(m => !m.error)
      .slice(-20)
      .map(m => {
        let content = m.text;
        if (m.sender === 'ai' && m.persona) {
          const personaLabel = m.persona.replace('_', ' ').toUpperCase();
          content = `[Expert: ${personaLabel}]: ${m.text}`;
        }
        return { role: m.sender === 'ai' ? 'assistant' : 'user', content };
      });

    setIsLoading(true);
    setLoadingPhase('reasoning');

    try {
      let personaInstruction = settings.personaStatement || 'Be clear, practical, professional, and attentive to the user.';
      if (selectedPersona === 'business_management') {
        personaInstruction = 'You are a Business Management Consultant. Review the conversation history (including input from other experts). Offer strategic insights on operations, margin management, efficiency, and overall business health. Conclude by asking key driving questions to help the user uncover hidden costs or optimize the quote.';
      } else if (selectedPersona === 'sales_expert') {
        personaInstruction = 'You are a Sales and Closing Expert. Review the conversation history (including input from other experts). Focus your response on closing techniques, handling client objections, and increasing conversion rates. Conclude by asking key driving questions to help the user position the quote perfectly for the client.';
      } else if (selectedPersona === 'custom') {
        personaInstruction = settings.customPersonaPrompt || '';
      }

      const effectiveSettings = { ...settings, personaStatement: personaInstruction };
      const context = buildContext({ projects, clients, catalog, tasks, activeProjectId, currentView, settings: effectiveSettings });

      // Dual pass: Pass 1 reasons & decides ACT vs CLARIFY, Pass 2 executes the
      // approved plan, then a deterministic gate validates the actions before dispatch.
      const result = await runAgent({
        userMessage: query,
        history,
        context,
        settings: effectiveSettings,
        onPhase: setLoadingPhase
      });

      // Only ACT turns mutate the database; CLARIFY turns just ask a question.
      if (result.decision === 'ACT' && result.actions.length > 0) {
        // Prevent the AI from navigating the user away from the chat unexpectedly
        const safeActions = result.actions.filter(a => a.type !== 'SWITCH_VIEW');

        dispatchNLPActions(safeActions, {
          setProjects: onProjectsChange,
          setClients: onClientsChange,
          setCatalog: onCatalogChange,
          setTasks: onTasksChange,
          setCurrentView: () => {}, // Disable view switching in chat
          setActiveProjectId
        });
      }

      setMessages(prev => [...prev, {
        id: `msg-ai-${Date.now()}`,
        sender: 'ai',
        text: result.response,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        actions: result.actions,
        reasoning: result.reasoning,
        decision: result.decision,
        persona: selectedPersona
      }]);

      // Vocalize response
      speakText(result.response);

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
    <div
      className={`ai-chat-shell${mobile ? ' mobile-chat-shell' : ''}`}
      style={{ display: 'flex', flexDirection: 'column', height: mobile ? '100%' : 'calc(100vh - 130px)', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-secondary)' }}
    >

      {/* Voice Controls Bar */}
      <div
        className="ai-chat-controls"
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
          {/* Clear Chat Button */}
          <button
            className="btn btn-sm btn-secondary"
            onClick={handleClearChat}
            title="Clear conversation and start fresh"
          >
            <Trash2 size={12} /> New Chat
          </button>

          {/* Mute Button */}
          <button
            className={`btn btn-sm ${ttsEnabled ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => {
              setTtsEnabled(!ttsEnabled);
              if (ttsEnabled) {
                window.speechSynthesis?.cancel();
                fishAudioRef.current?.pause();
              }
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

          {/* Persona Selector */}
          <select
            className="input-field"
            style={{ padding: '4px 8px', fontSize: '12px', width: '160px', backgroundColor: 'var(--bg-primary)' }}
            value={selectedPersona}
            onChange={(e) => setSelectedPersona(e.target.value)}
            title="Select AI Persona"
          >
            <option value="default">Default Persona</option>
            <option value="business_management">Business Manager</option>
            <option value="sales_expert">Sales Expert</option>
            <option value="custom">Custom Persona</option>
          </select>

          {/* Voice Selector */}
          {ttsEnabled && (settings.fishAudioConfigured || settings.fishAudioKey) && settings.fishVoiceId && (
            <div className="badge badge-quoting" style={{ fontSize: '10px' }}>
              Fish Audio: {settings.fishVoiceName || settings.fishVoiceId}
            </div>
          )}

          {voices.length > 0 && ttsEnabled && !((settings.fishAudioConfigured || settings.fishAudioKey) && settings.fishVoiceId) && (
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

      {ttsError && (
        <div style={{ padding: '10px 14px', borderBottom: '1px solid var(--danger)', background: 'var(--danger-muted)', color: 'var(--danger)', fontSize: '12px' }}>
          {ttsError} Check the Fish API key, selected voice, account credits, and TTS model in Settings.
        </div>
      )}

      {/* Messages Viewport */}
      <div className="ai-chat-messages" style={{ flex: 1, padding: '24px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '16px' }}>
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
                        <Sparkles size={10} style={{ color: 'var(--accent)' }} /> QuoteFlow AI
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

                {/* Reasoning trace (Pass 1) — collapsed by default */}
                {isAi && msg.reasoning && (
                  <details style={{ marginTop: '2px' }}>
                    <summary style={{ cursor: 'pointer', fontSize: '9px', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <BrainCircuit size={10} style={{ color: 'var(--accent)' }} />
                      Reasoning
                      {msg.decision === 'CLARIFY' && <span style={{ color: 'var(--text-muted)', fontWeight: 'normal' }}>· gathering details</span>}
                      <ChevronDown size={10} />
                    </summary>
                    <div style={{ fontSize: '11.5px', lineHeight: '1.5', color: 'var(--text-secondary)', marginTop: '6px', paddingLeft: '8px', borderLeft: '2px solid var(--border-color-active)', fontStyle: 'italic' }}>
                      {msg.reasoning}
                    </div>
                  </details>
                )}

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
              {loadingPhase === 'executing' ? (
                <>
                  <Database size={12} className="animate-spin" style={{ color: 'var(--accent)' }} /> Plan approved — executing actions & updating your database...
                </>
              ) : loadingPhase === 'searching' ? (
                <>
                  <Globe size={12} className="animate-spin" style={{ color: 'var(--accent)' }} /> Searching the web for the latest information...
                </>
              ) : (
                <>
                  <BrainCircuit size={12} className="animate-pulse" style={{ color: 'var(--accent)' }} /> Reasoning about your request before taking action...
                </>
              )}
            </div>
          </div>
        )}
        <div ref={chatEndRef} />
      </div>

      {/* Input console */}
      <div className="ai-chat-composer" style={{ padding: '18px 24px', borderTop: '1px solid var(--border-color)', backgroundColor: 'var(--bg-tertiary)' }}>
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
                : "Type a business or quoting instruction..."
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
