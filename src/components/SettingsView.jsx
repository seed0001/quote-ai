import React, { useEffect, useState } from 'react';
import { Save, Download, Upload, Trash2, ShieldAlert } from 'lucide-react';
import { exportDataBackup, importDataBackup, masterResetData } from '../utils/dataStore';
import { fetchAllFishVoices, generateFishSpeech } from '../utils/fishAudio';
import { fetchOpenRouterModels } from '../utils/openRouterModels';
import { fetchOllamaModels } from '../utils/ollamaModels';
import { enhancePersona } from '../utils/aiEngine';
import { playSuccess, playWarning, playClick } from '../utils/soundEngine';

export default function SettingsView({ settings, onSettingsChange, onDataImported }) {
  const [companyName, setCompanyName] = useState(settings.companyName || '');
  const [businessType, setBusinessType] = useState(settings.businessType || '');
  const [businessDescription, setBusinessDescription] = useState(settings.businessDescription || '');
  const [personaStatement, setPersonaStatement] = useState(settings.personaStatement || '');
  const [contractorName, setContractorName] = useState(settings.contractorName || '');
  const [email, setEmail] = useState(settings.email || '');
  const [phone, setPhone] = useState(settings.phone || '');
  const [address, setAddress] = useState(settings.address || '');
  const [defaultLaborRate, setDefaultLaborRate] = useState(settings.defaultLaborRate || 85);
  const [defaultMarkupPercent, setDefaultMarkupPercent] = useState(settings.defaultMarkupPercent || 20);
  const [defaultTaxPercent, setDefaultTaxPercent] = useState(settings.defaultTaxPercent || 8.25);
  const [companyLogo, setCompanyLogo] = useState(settings.companyLogo || '');
  const [depositPercent, setDepositPercent] = useState(settings.depositPercent !== undefined ? settings.depositPercent : 50);
  const [proposalTerms, setProposalTerms] = useState(settings.proposalTerms || '');
  const [fishAudioKey, setFishAudioKey] = useState(settings.fishAudioKey || '');
  const [fishAudioModel, setFishAudioModel] = useState('s2.1-pro-free');
  const [fishVoiceId, setFishVoiceId] = useState(settings.fishVoiceId || '');
  const [fishVoiceName, setFishVoiceName] = useState(settings.fishVoiceName || '');
  const [fishVoices, setFishVoices] = useState([]);
  const [fishVoiceSearch, setFishVoiceSearch] = useState('');
  const [fishStatus, setFishStatus] = useState('');
  const [fishLoading, setFishLoading] = useState(false);
  const initialModel = settings.openRouterModel || '';
  const initialVisionModel = settings.openRouterVisionModel || '';
  const initialClassifierModel = settings.openRouterClassifierModel || '';
  const initialClassifierSchema = settings.classifierSchema || '{\n  "decision": "ACT" | "CLARIFY" | "SEARCH",\n  "suggestedActions": string[],\n  "searchQueries": string[],\n  "clarifyingQuestion": string\n}';

  const [openRouterKey, setOpenRouterKey] = useState(settings.openRouterKey || '');
  const [openRouterModel, setOpenRouterModel] = useState(initialModel);
  const [openRouterVisionModel, setOpenRouterVisionModel] = useState(initialVisionModel);
  const [openRouterClassifierModel, setOpenRouterClassifierModel] = useState(initialClassifierModel);
  const [classifierSchema, setClassifierSchema] = useState(initialClassifierSchema);
  const [openRouterModels, setOpenRouterModels] = useState([]);
  const [openRouterModelSearch, setOpenRouterModelSearch] = useState('');
  const [openRouterStatus, setOpenRouterStatus] = useState('');
  const [openRouterLoading, setOpenRouterLoading] = useState(false);
  
  const [resendKey, setResendKey] = useState(settings.resendKey || '');
  const [notificationFromEmail, setNotificationFromEmail] = useState(settings.notificationFromEmail || '');
  const [tavilyKey, setTavilyKey] = useState(settings.tavilyKey || '');
  const [braveSearchKey, setBraveSearchKey] = useState(settings.braveSearchKey || '');
  const [stripeKey, setStripeKey] = useState(settings.stripeKey || '');
  const [team, setTeam] = useState(Array.isArray(settings.team) ? settings.team : []);
  const [newMemberName, setNewMemberName] = useState('');
  const [newMemberEmail, setNewMemberEmail] = useState('');
  const [testEmail, setTestEmail] = useState('');
  const [testStatus, setTestStatus] = useState('');
  const [customPersonaPrompt, setCustomPersonaPrompt] = useState(settings.customPersonaPrompt || '');
  const [enhancingPersona, setEnhancingPersona] = useState(false);
  const [enhancingPersonaStatement, setEnhancingPersonaStatement] = useState(false);

  const [saveSuccess, setSaveSuccess] = useState(false);
  const [importStatus, setImportStatus] = useState({ type: '', message: '' });

  const [theme, setTheme] = useState(settings.theme || 'dark');
  const [spacingScale, setSpacingScale] = useState(settings.spacingScale !== undefined ? settings.spacingScale : 1.0);
  const [fontScale, setFontScale] = useState(settings.fontScale !== undefined ? settings.fontScale : 1.0);
  const [radius, setRadius] = useState(settings.radius !== undefined ? settings.radius : 0);
  const [soundVolume, setSoundVolume] = useState(settings.soundVolume !== undefined ? settings.soundVolume : 0.5);
  const [soundEnabled, setSoundEnabled] = useState(settings.soundEnabled !== undefined ? settings.soundEnabled : true);
  const [soundPack, setSoundPack] = useState(settings.soundPack || 'modern');

  const addTeamMember = () => {
    const name = newMemberName.trim();
    const memberEmail = newMemberEmail.trim();
    if (!name) return;
    setTeam((prev) => [...prev, { name, email: memberEmail }]);
    setNewMemberName('');
    setNewMemberEmail('');
  };

  const removeTeamMember = (idx) => setTeam((prev) => prev.filter((_, i) => i !== idx));

  const sendTestEmail = async () => {
    setTestStatus('Sending...');
    try {
      const response = await fetch('/api/notify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ to: testEmail.trim() }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || 'Failed to send.');
      setTestStatus('Test email sent — check the inbox.');
    } catch (error) {
      setTestStatus(error.message);
    }
  };

  const loadOpenRouterModels = async (key = openRouterKey) => {
    setOpenRouterLoading(true);
    setOpenRouterStatus('Checking your model access...');
    try {
      const openRouterPromise = (key || settings.openRouterConfigured) ? fetchOpenRouterModels(key) : Promise.resolve([]);
      const ollamaPromise = fetchOllamaModels();
      
      const [orModels, olModels] = await Promise.all([
        openRouterPromise.catch((e) => { console.warn(e); return []; }),
        ollamaPromise
      ]);
      const models = [...orModels, ...olModels];
      setOpenRouterModels(models);
      setOpenRouterStatus(`Loaded ${orModels.length} cloud models and ${olModels.length} local models.`);
    } catch (error) {
      setOpenRouterModels([]);
      setOpenRouterStatus(error.message);
    } finally {
      setOpenRouterLoading(false);
    }
  };

  useEffect(() => {
    const key = openRouterKey.trim();
    const timer = window.setTimeout(() => loadOpenRouterModels(key), 700);
    return () => window.clearTimeout(timer);
  }, [openRouterKey, settings.openRouterConfigured]);

  const visibleOpenRouterModels = openRouterModels.filter((model) => {
    const term = openRouterModelSearch.trim().toLowerCase();
    return !term || `${model.name} ${model.id} ${model.description}`.toLowerCase().includes(term);
  });

  const selectedOpenRouterModel = openRouterModels.find((model) => model.id === openRouterModel);
  const perMillion = (perToken) => {
    if (!Number.isFinite(perToken) || perToken < 0) return 'Not listed';
    if (perToken === 0) return 'Free';
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 4,
    }).format(perToken * 1_000_000);
  };
  const formatFixedCost = (cost) => {
    if (!Number.isFinite(cost) || cost < 0) return 'Not listed';
    if (cost === 0) return 'None';
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 4,
      maximumFractionDigits: 6,
    }).format(cost);
  };
  const exampleCost = selectedOpenRouterModel
    ? (selectedOpenRouterModel.pricing.prompt * 10_000)
      + (selectedOpenRouterModel.pricing.completion * 2_000)
      + selectedOpenRouterModel.pricing.request
    : 0;

  const handleLogoUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (file.size > 1000000) {
      alert('Logo image is too large (1MB max to keep it in local storage).');
      return;
    }
    const reader = new FileReader();
    reader.onloadend = () => setCompanyLogo(reader.result);
    reader.readAsDataURL(file);
  };

  const handleEnhancePersona = async () => {
    if (!customPersonaPrompt.trim()) return;
    setEnhancingPersona(true);
    try {
      // Need to use the latest settings object in case the user hasn't saved their API key changes yet
      const currentSettings = {
        ...settings,
        openRouterKey,
        openRouterModel,
        openRouterVisionModel,
        openRouterClassifierModel,
        classifierSchema
      };
      const enhanced = await enhancePersona(customPersonaPrompt, currentSettings);
      setCustomPersonaPrompt(enhanced);
    } catch (err) {
      console.error('Failed to enhance persona:', err);
      alert(err.message || 'Failed to enhance persona.');
    } finally {
      setEnhancingPersona(false);
    }
  };

  const handleEnhancePersonaStatement = async () => {
    if (!personaStatement.trim()) return;
    setEnhancingPersonaStatement(true);
    try {
      const currentSettings = {
        ...settings,
        openRouterKey,
        openRouterModel,
        openRouterVisionModel,
        openRouterClassifierModel,
        classifierSchema
      };
      const enhanced = await enhancePersona(personaStatement, currentSettings);
      setPersonaStatement(enhanced);
    } catch (err) {
      console.error('Failed to enhance persona statement:', err);
      alert(err.message || 'Failed to enhance persona statement.');
    } finally {
      setEnhancingPersonaStatement(false);
    }
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setSaveSuccess(false);
    const hostPayload = {
      ...settings,
      companyName,
      businessType,
      businessDescription,
      personaStatement,
      contractorName,
      email,
      phone,
      address,
      defaultLaborRate: parseFloat(defaultLaborRate) || 0,
      defaultMarkupPercent: parseFloat(defaultMarkupPercent) || 0,
      defaultTaxPercent: parseFloat(defaultTaxPercent) || 0,
      companyLogo,
      depositPercent: parseFloat(depositPercent) || 0,
      proposalTerms,
      fishAudioKey,
      fishAudioModel,
      fishVoiceId,
      fishVoiceName,
      openRouterKey,
      openRouterModel,
      openRouterVisionModel,
      openRouterClassifierModel,
      classifierSchema,
      resendKey,
      notificationFromEmail,
      team,
      customPersonaPrompt,
      tavilyKey,
      braveSearchKey,
      stripeKey,
      theme,
      spacingScale: parseFloat(spacingScale) || 1.0,
      fontScale: parseFloat(fontScale) || 1.0,
      radius: parseInt(radius) || 0,
      soundVolume: parseFloat(soundVolume) || 0.5,
      soundEnabled,
      soundPack,
    };

    try {
      const response = await fetch('/api/host-config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(hostPayload),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || 'Unable to save host configuration.');
      onSettingsChange({
        ...hostPayload,
        ...result,
        openRouterKey: '',
        fishAudioKey: '',
        resendKey: '',
        tavilyKey: '',
        braveSearchKey: '',
        stripeKey: '',
      });
      setSaveSuccess(true);
      playSuccess();
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (error) {
      playWarning();
      setImportStatus({ type: 'error', message: error.message });
      setTimeout(() => setImportStatus({ type: '', message: '' }), 5000);
    }
  };

  const loadFishVoices = async () => {
    setFishLoading(true);
    setFishStatus('Connecting to Fish Audio...');
    try {
      const loaded = await fetchAllFishVoices(fishAudioKey, (count, total) => {
        setFishStatus(`Loading voices: ${count}${total ? ` of ${total}` : ''}`);
      });
      setFishVoices(loaded);
      setFishStatus(`Loaded ${loaded.length} available voices.`);
    } catch (error) {
      setFishStatus(error.message);
    } finally {
      setFishLoading(false);
    }
  };

  const testFishVoice = async () => {
    if (!fishVoiceId) return;
    setFishLoading(true);
    setFishStatus('Generating voice preview...');
    try {
      const blob = await generateFishSpeech({
        apiKey: fishAudioKey,
        voiceId: fishVoiceId,
        model: fishAudioModel,
        text: 'Hello. This is the selected voice for your QuoteFlow agent.',
      });
      const url = URL.createObjectURL(blob);
      const audio = new Audio(url);
      audio.onended = () => URL.revokeObjectURL(url);
      await audio.play();
      setFishStatus(`Playing ${fishVoiceName || 'selected voice'}.`);
    } catch (error) {
      setFishStatus(error.message);
    } finally {
      setFishLoading(false);
    }
  };

  const visibleFishVoices = fishVoices.filter((voice) => {
    const term = fishVoiceSearch.trim().toLowerCase();
    if (!term) return true;
    return `${voice.title} ${voice.author} ${voice.languages.join(' ')} ${voice.tags.join(' ')}`.toLowerCase().includes(term);
  });

  const handleImportFile = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const result = importDataBackup(event.target.result);
      if (result.success) {
        setImportStatus({ type: 'success', message: 'Data backup imported successfully. Reloading state...' });
        onDataImported();
      } else {
        setImportStatus({ type: 'error', message: `Import failed: ${result.error}` });
      }
      setTimeout(() => setImportStatus({ type: '', message: '' }), 5000);
    };
    reader.readAsText(file);
  };

  const handleResetDatabase = async () => {
    const firstWarning = window.confirm(
      'MASTER RESET WARNING\n\nThis permanently deletes every client, project, quote, catalog item, chat, API key, voice selection, persona, and setting stored by QuoteFlow on this browser.\n\nThis cannot be undone unless you exported a backup.\n\nContinue?'
    );
    if (!firstWarning) return;

    const confirmation = window.prompt(
      'FINAL WARNING: All QuoteFlow data will be erased and the application will restart completely empty.\n\nType RESET EVERYTHING to confirm.'
    );
    if (confirmation !== 'RESET EVERYTHING') {
      alert('Master reset cancelled. Nothing was deleted.');
      return;
    }

    try {
      const response = await fetch('/api/host-config', { method: 'DELETE' });
      if (!response.ok) throw new Error('Unable to erase the host API configuration.');
      masterResetData();
      window.location.replace(window.location.href);
    } catch (error) {
      alert(`Master reset stopped: ${error.message}`);
    }
  };

  return (
    <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      
      {/* Top action bar: Save button */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h1 style={{ fontSize: '20px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Settings</h1>
        <button type="submit" className="btn btn-primary" style={{ gap: '8px' }}>
          <Save size={16} /> Save All Settings
        </button>
      </div>

      {saveSuccess && (
        <div style={{ padding: '12px', background: 'var(--success-muted)', border: '1px solid var(--success)', color: 'var(--success)', fontSize: '13px' }}>
          ✓ Settings saved successfully to host configuration.
        </div>
      )}

      {importStatus.message && (
        <div style={{ padding: '12px', background: importStatus.type === 'error' ? 'var(--danger-muted)' : 'var(--success-muted)', border: `1px solid var(--${importStatus.type === 'error' ? 'danger' : 'success'})`, color: `var(--${importStatus.type === 'error' ? 'danger' : 'success'})`, fontSize: '13px' }}>
          {importStatus.message}
        </div>
      )}

      <div className="grid-2" style={{ alignItems: 'start' }}>
        {/* LEFT COLUMN: COMPANY PROFILE & COST RULES */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          
          {/* Card 1: Company Profile */}
          <div className="panel" style={{ marginBottom: 0 }}>
            <div className="panel-header">
              <h2 className="panel-title">Company Profile</h2>
            </div>
            
            <h3 style={{ fontSize: '11px', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '14px', letterSpacing: '0.5px' }}>
              Company Details (Appears on client proposals)
            </h3>
            
            <div className="form-group">
              <label className="form-label">Company Name</label>
              <input 
                type="text" 
                className="input-field" 
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                required
              />
            </div>

            <div className="form-group">
              <label className="form-label">Line of Business</label>
              <input
                type="text"
                className="input-field"
                value={businessType}
                onChange={(e) => setBusinessType(e.target.value)}
                placeholder="e.g. Marketing agency, catering, IT consulting, landscaping, wholesale"
              />
            </div>

            <div className="form-group">
              <label className="form-label">Business Description for AI</label>
              <textarea
                className="input-field"
                value={businessDescription}
                onChange={(e) => setBusinessDescription(e.target.value)}
                placeholder="Describe your products, services, usual project structure, pricing rules, and terminology."
                rows={4}
              />
              <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '4px' }}>
                The AI uses this context to adapt quotes and questions to your business.
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Agent Persona Statement</label>
              <textarea
                className="input-field"
                value={personaStatement}
                onChange={(e) => setPersonaStatement(e.target.value)}
                placeholder="Describe how the agent should behave, communicate, make decisions, and represent your business."
                rows={6}
              />
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '4px' }}>
                <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>
                  This statement is included in every AI request as behavioral guidance.
                </div>
                <button 
                  type="button" 
                  className="btn btn-secondary" 
                  style={{ padding: '2px 8px', fontSize: '11px', height: 'auto' }}
                  onClick={handleEnhancePersonaStatement}
                  disabled={enhancingPersonaStatement || !personaStatement.trim()}
                >
                  {enhancingPersonaStatement ? 'Enhancing...' : '✨ Enhance with AI'}
                </button>
              </div>
            </div>

            <div className="grid-2">
              <div className="form-group">
                <label className="form-label">Contact Name</label>
                <input 
                  type="text" 
                  className="input-field" 
                  value={contractorName}
                  onChange={(e) => setContractorName(e.target.value)}
                />
              </div>
              <div className="form-group">
                <label className="form-label">Phone Number</label>
                <input 
                  type="text" 
                  className="input-field" 
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                />
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Email Address</label>
              <input 
                type="email" 
                className="input-field" 
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>

            <div className="form-group">
              <label className="form-label">Business / Mailing Address</label>
              <textarea
                className="input-field"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="Include street, city, state, zip..."
              />
            </div>

            <div className="form-group">
              <label className="form-label">Company Logo (appears on proposals)</label>
              <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                {companyLogo ? (
                  <img src={companyLogo} alt="Company logo" style={{ width: '56px', height: '56px', objectFit: 'contain', border: '1px solid var(--border-color)', padding: '4px', backgroundColor: 'var(--bg-primary)' }} />
                ) : (
                  <div style={{ width: '56px', height: '56px', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px dashed var(--border-color)', fontSize: '9px', color: 'var(--text-muted)', textAlign: 'center' }}>
                    No logo
                  </div>
                )}
                <label className="btn btn-secondary btn-sm" style={{ marginBottom: 0 }}>
                  <Upload size={12} /> Upload Logo
                  <input type="file" accept="image/*" onChange={handleLogoUpload} style={{ display: 'none' }} />
                </label>
                {companyLogo && (
                  <button type="button" className="btn btn-secondary btn-sm" style={{ color: 'var(--danger)' }} onClick={() => setCompanyLogo('')}>
                    <Trash2 size={12} /> Remove
                  </button>
                )}
              </div>
            </div>

          </div>

          {/* Card 2: Cost & Pricing Rules */}
          <div className="panel" style={{ marginBottom: 0 }}>
            <div className="panel-header">
              <h2 className="panel-title">Pricing Defaults</h2>
            </div>
            
            <h3 style={{ fontSize: '11px', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '14px', letterSpacing: '0.5px' }}>
              Standard Cost Estimates Defaults
            </h3>

            <div className="grid-2">
              <div className="form-group">
                <label className="form-label">Default Service / Labor Rate ($/hr)</label>
                <div className="input-group">
                  <span className="input-addon">$</span>
                  <input 
                    type="number" 
                    className="input-field" 
                    value={defaultLaborRate}
                    onChange={(e) => setDefaultLaborRate(e.target.value)}
                    style={{ fontFamily: 'var(--font-mono)' }}
                  />
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Default Markup (%)</label>
                <div className="input-group">
                  <input 
                    type="number" 
                    className="input-field" 
                    value={defaultMarkupPercent}
                    onChange={(e) => setDefaultMarkupPercent(e.target.value)}
                    style={{ fontFamily: 'var(--font-mono)' }}
                  />
                  <span className="input-addon">%</span>
                </div>
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Standard Sales Tax (%)</label>
              <div className="input-group">
                <input
                  type="number"
                  className="input-field"
                  value={defaultTaxPercent}
                  onChange={(e) => setDefaultTaxPercent(e.target.value)}
                  style={{ fontFamily: 'var(--font-mono)' }}
                />
                <span className="input-addon">%</span>
              </div>
            </div>

            <div style={{ borderTop: '1px dashed var(--border-color)', margin: '24px 0' }}></div>

            <h3 style={{ fontSize: '11px', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '14px', letterSpacing: '0.5px' }}>
              Proposal Document Defaults
            </h3>

            <div className="form-group">
              <label className="form-label">Deposit Required (%)</label>
              <div className="input-group">
                <input
                  type="number"
                  className="input-field"
                  value={depositPercent}
                  onChange={(e) => setDepositPercent(e.target.value)}
                  style={{ fontFamily: 'var(--font-mono)' }}
                />
                <span className="input-addon">%</span>
              </div>
              <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '4px' }}>
                Shown on the proposal as a deposit due on acceptance. Set to 0 to hide.
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Proposal Terms / Payment Notes</label>
              <textarea
                className="input-field"
                value={proposalTerms}
                onChange={(e) => setProposalTerms(e.target.value)}
                placeholder="Payment terms, warranty, validity period..."
                rows={3}
              />
            </div>
          </div>

          {/* Card 3: Team Members */}
          <div className="panel" style={{ marginBottom: 0 }}>
            <div className="panel-header">
              <h2 className="panel-title">Team Settings</h2>
            </div>
            
            <div className="form-group">
              <label className="form-label">Team Members</label>
              {team.length > 0 && (
                <div style={{ marginBottom: '8px' }}>
                  {team.map((m, idx) => (
                    <div key={`${m.email}-${idx}`} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '12px', padding: '6px 8px', border: '1px solid var(--border-color)', borderRadius: '5px', marginBottom: '4px' }}>
                      <span>{m.name} {m.email && <span style={{ color: 'var(--text-muted)' }}>· {m.email}</span>}</span>
                      <button type="button" onClick={() => removeTeamMember(idx)} style={{ cursor: 'pointer', color: 'var(--danger)', background: 'none', border: 'none' }}>
                        <Trash2 size={12} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
              <div style={{ display: 'flex', gap: '8px' }}>
                <input type="text" className="input-field" placeholder="Name" value={newMemberName} onChange={(e) => setNewMemberName(e.target.value)} />
                <input type="email" className="input-field" placeholder="Email" value={newMemberEmail} onChange={(e) => setNewMemberEmail(e.target.value)} />
                <button type="button" className="btn btn-secondary btn-sm" onClick={addTeamMember}>Add</button>
              </div>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>
                Members appear as assignee options on the calendar.
              </div>
            </div>
          </div>

        </div>

        {/* RIGHT COLUMN: THEMES, SOUNDS, AI, INTEGRATIONS, BACKUPS */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          
          {/* Card 4: Appearance & Theming */}
          <div className="panel" style={{ marginBottom: 0 }}>
            <div className="panel-header">
              <h2 className="panel-title">Appearance & Custom Themes</h2>
            </div>
            
            <div className="form-group">
              <label className="form-label">Color Theme</label>
              <select className="input-field" value={theme} onChange={(e) => setTheme(e.target.value)}>
                <option value="dark">Dark Theme (Default)</option>
                <option value="light">Light Theme</option>
                <option value="ocean">Ocean Blue Theme</option>
                <option value="forest">Forest Green Theme</option>
                <option value="midnight">Midnight Purple Theme</option>
              </select>
            </div>

            <div className="form-group">
              <label className="form-label">Spacing Density ({spacingScale}x)</label>
              <input 
                type="range" 
                min="0.75" 
                max="1.25" 
                step="0.05" 
                className="input-field" 
                style={{ padding: 0, height: '24px' }}
                value={spacingScale} 
                onChange={(e) => setSpacingScale(e.target.value)} 
              />
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', color: 'var(--text-muted)' }}>
                <span>Compact (0.75x)</span>
                <span>Comfortable (1.0x)</span>
                <span>Spacious (1.25x)</span>
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Font Scale ({fontScale}x)</label>
              <input 
                type="range" 
                min="0.85" 
                max="1.15" 
                step="0.05" 
                className="input-field" 
                style={{ padding: 0, height: '24px' }}
                value={fontScale} 
                onChange={(e) => setFontScale(e.target.value)} 
              />
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', color: 'var(--text-muted)' }}>
                <span>Small (0.85x)</span>
                <span>Default (1.0x)</span>
                <span>Large (1.15x)</span>
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Border Radius ({radius}px)</label>
              <input 
                type="range" 
                min="0" 
                max="12" 
                step="1" 
                className="input-field" 
                style={{ padding: 0, height: '24px' }}
                value={radius} 
                onChange={(e) => setRadius(e.target.value)} 
              />
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', color: 'var(--text-muted)' }}>
                <span>Sharp (0px)</span>
                <span>Soft (4px)</span>
                <span>Rounded (12px)</span>
              </div>
            </div>
          </div>

          {/* Card 5: Sound Engine Preferences */}
          <div className="panel" style={{ marginBottom: 0 }}>
            <div className="panel-header">
              <h2 className="panel-title">UI Sound Effects</h2>
            </div>
            
            <div className="form-group" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <input 
                type="checkbox" 
                id="soundEnabled"
                checked={soundEnabled} 
                onChange={(e) => setSoundEnabled(e.target.checked)} 
                style={{ width: '16px', height: '16px' }}
              />
              <label htmlFor="soundEnabled" className="form-label" style={{ marginBottom: 0, cursor: 'pointer' }}>Enable UI Sounds</label>
            </div>

            {soundEnabled && (
              <>
                <div className="form-group">
                  <label className="form-label">Sound Pack Style</label>
                  <select className="input-field" value={soundPack} onChange={(e) => {
                    setSoundPack(e.target.value);
                    // play click preview
                    setTimeout(() => playClick(), 100);
                  }}>
                    <option value="modern">Modern Crisp</option>
                    <option value="mechanical">Retro Mechanical</option>
                    <option value="soft">Soft Bubble</option>
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Volume ({Math.round(soundVolume * 100)}%)</label>
                  <input 
                    type="range" 
                    min="0" 
                    max="1" 
                    step="0.05" 
                    className="input-field" 
                    style={{ padding: 0, height: '24px' }}
                    value={soundVolume} 
                    onChange={(e) => setSoundVolume(e.target.value)} 
                  />
                </div>
                <button type="button" className="btn btn-secondary btn-sm" onClick={() => playSuccess()}>
                  Test Chime
                </button>
              </>
            )}
          </div>

          {/* Card 6: AI Engine & Brain */}
          <div className="panel" style={{ marginBottom: 0 }}>
            <div className="panel-header">
              <h2 className="panel-title">AI Engine Settings</h2>
            </div>
            
            <h3 style={{ fontSize: '11px', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '14px', letterSpacing: '0.5px' }}>
              OpenRouter NLP Configuration
            </h3>

            <div className="form-group">
              <label className="form-label">OpenRouter API Key</label>
              <div style={{ display: 'flex', gap: '8px' }}>
                <input
                  type="password"
                  className="input-field"
                  placeholder={settings.openRouterConfigured ? 'Configured on hosting computer' : 'sk-or-v1-...'}
                  value={openRouterKey}
                  onChange={(e) => setOpenRouterKey(e.target.value)}
                  style={{ fontFamily: 'var(--font-mono)', flex: 1 }}
                />
                <button type="button" className="btn btn-secondary" onClick={() => loadOpenRouterModels()} disabled={openRouterLoading}>
                  {openRouterLoading ? 'Searching...' : 'Refresh Models'}
                </button>
              </div>
              <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '4px' }}>
                Entering a key automatically loads the models available under that account.
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Search Available Models</label>
              <input
                type="text"
                className="input-field"
                value={openRouterModelSearch}
                onChange={(e) => setOpenRouterModelSearch(e.target.value)}
                placeholder="Search by provider, model name, or model ID"
                disabled={openRouterModels.length === 0}
              />
            </div>

            <div className="form-group">
              <label className="form-label">Preferred LLM Model</label>
              <select className="input-field" value={openRouterModel} onChange={(e) => setOpenRouterModel(e.target.value)}>
                <option value="">Select a model…</option>
                {openRouterModel && !visibleOpenRouterModels.some((model) => model.id === openRouterModel) && (
                  <option value={openRouterModel}>{openRouterModel} (current)</option>
                )}
                {visibleOpenRouterModels.map((model) => (
                  <option key={model.id} value={model.id}>
                    {model.free ? '🎁 [FREE] ' : '💸 [PAID] '}{model.name} — {model.id}
                  </option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label className="form-label">Preferred Vision Model (For Images)</label>
              <select className="input-field" value={openRouterVisionModel} onChange={(e) => setOpenRouterVisionModel(e.target.value)}>
                <option value="">Use my main model for images</option>
                {openRouterVisionModel && !visibleOpenRouterModels.filter(m => m.isVision).some((model) => model.id === openRouterVisionModel) && (
                  <option value={openRouterVisionModel}>{openRouterVisionModel} (current)</option>
                )}
                {visibleOpenRouterModels.filter(m => m.isVision).map((model) => (
                  <option key={model.id + '-vision'} value={model.id}>
                    {model.free ? '🎁 [FREE] ' : '💸 [PAID] '}{model.name} — {model.id}
                  </option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label className="form-label">Preferred Classifier Model (Pass 1)</label>
              <select className="input-field" value={openRouterClassifierModel} onChange={(e) => setOpenRouterClassifierModel(e.target.value)}>
                <option value="">Use my main model for classification</option>
                {openRouterClassifierModel && !visibleOpenRouterModels.some((model) => model.id === openRouterClassifierModel) && (
                  <option value={openRouterClassifierModel}>{openRouterClassifierModel} (current)</option>
                )}
                {visibleOpenRouterModels.map((model) => (
                  <option key={model.id + '-classifier'} value={model.id}>
                    {model.free ? '🎁 [FREE] ' : '💸 [PAID] '}{model.name} — {model.id}
                  </option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label className="form-label">Classifier JSON Schema (Pass 1)</label>
              <textarea 
                className="input-field" 
                value={classifierSchema} 
                onChange={(e) => setClassifierSchema(e.target.value)} 
                rows={6}
                style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', lineHeight: '1.4' }}
                placeholder='{\n  "decision": "ACT" | "CLARIFY" | "SEARCH",\n  "suggestedActions": string[],\n  "searchQueries": string[],\n  "clarifyingQuestion": string\n}'
              />
              <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>
                Define the JSON fields returned during classification. Pass 2 (reasoning model) will receive these fields as pre-pass guidance.
              </span>
            </div>

            {selectedOpenRouterModel && (
              <div style={{ border: '1px solid var(--border-color)', background: 'var(--bg-primary)', padding: '14px', marginBottom: '14px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', marginBottom: '12px' }}>
                  <div>
                    <div style={{ fontWeight: '700', fontSize: '13px' }}>{selectedOpenRouterModel.name}</div>
                    <div style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', fontSize: '10px' }}>{selectedOpenRouterModel.id}</div>
                  </div>
                  <span className={`badge ${selectedOpenRouterModel.free ? 'badge-completed' : 'badge-quoting'}`}>
                    {selectedOpenRouterModel.free ? 'FREE' : 'PAID'}
                  </span>
                </div>

                <div className="grid-2" style={{ gap: '8px' }}>
                  <div style={{ padding: '10px', background: 'var(--bg-secondary)' }}>
                    <div style={{ color: 'var(--text-muted)', fontSize: '10px', textTransform: 'uppercase' }}>Input</div>
                    <div style={{ fontFamily: 'var(--font-mono)', fontWeight: '700' }}>{perMillion(selectedOpenRouterModel.pricing.prompt)} / 1M</div>
                  </div>
                  <div style={{ padding: '10px', background: 'var(--bg-secondary)' }}>
                    <div style={{ color: 'var(--text-muted)', fontSize: '10px', textTransform: 'uppercase' }}>Output</div>
                    <div style={{ fontFamily: 'var(--font-mono)', fontWeight: '700' }}>{perMillion(selectedOpenRouterModel.pricing.completion)} / 1M</div>
                  </div>
                </div>
              </div>
            )}

            <div className="form-group" style={{ marginTop: '16px' }}>
              <label className="form-label">Custom AI Persona Prompt</label>
              <textarea 
                className="input-field" 
                placeholder="E.g., You are a strict AI assistant..."
                value={customPersonaPrompt}
                onChange={(e) => setCustomPersonaPrompt(e.target.value)}
                style={{ height: '80px' }}
              />
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '4px' }}>
                <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>
                  Define custom instructions here.
                </div>
                <button 
                  type="button" 
                  className="btn btn-secondary" 
                  style={{ padding: '2px 8px', fontSize: '11px', height: 'auto' }}
                  onClick={handleEnhancePersona}
                  disabled={enhancingPersona || !customPersonaPrompt.trim()}
                >
                  {enhancingPersona ? 'Enhancing...' : '✨ Enhance with AI'}
                </button>
              </div>
            </div>

            <div style={{ borderTop: '1px dashed var(--border-color)', margin: '24px 0' }}></div>

            <h3 style={{ fontSize: '11px', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '14px', letterSpacing: '0.5px' }}>
              Fish Audio Text-to-Speech
            </h3>

            <div className="form-group">
              <label className="form-label">Fish Audio API Key</label>
              <input
                type="password"
                className="input-field"
                placeholder={settings.fishAudioConfigured ? 'Configured on hosting computer' : 'Paste Fish API Key'}
                value={fishAudioKey}
                onChange={(e) => setFishAudioKey(e.target.value)}
                style={{ fontFamily: 'var(--font-mono)' }}
              />
            </div>

            <div className="grid-2">
              <div className="form-group">
                <label className="form-label">TTS Model</label>
                <select className="input-field" value={fishAudioModel} onChange={(e) => setFishAudioModel(e.target.value)}>
                  <option value="s2.1-pro-free">S2.1 Pro Free</option>
                </select>
              </div>
              <div className="form-group" style={{ display: 'flex', alignItems: 'flex-end' }}>
                <button type="button" className="btn btn-secondary" onClick={loadFishVoices} disabled={fishLoading || !(fishAudioKey || settings.fishAudioConfigured)} style={{ width: '100%' }}>
                  {fishLoading ? 'Loading...' : 'Load Voices'}
                </button>
              </div>
            </div>

            {(fishVoices.length > 0 || fishVoiceId) && (
              <>
                <div className="form-group">
                  <label className="form-label">Selected Voice</label>
                  <select
                    className="input-field"
                    value={fishVoiceId}
                    onChange={(e) => {
                      const voice = fishVoices.find((item) => item.id === e.target.value);
                      setFishVoiceId(e.target.value);
                      setFishVoiceName(voice?.title || (e.target.value === fishVoiceId ? fishVoiceName : ''));
                    }}
                  >
                    <option value="">-- Choose a voice --</option>
                    {fishVoiceId && !visibleFishVoices.some((voice) => voice.id === fishVoiceId) && (
                      <option value={fishVoiceId}>{fishVoiceName || fishVoiceId} (current)</option>
                    )}
                    {visibleFishVoices.map((voice) => (
                      <option key={voice.id} value={voice.id}>
                        {voice.title}
                      </option>
                    ))}
                  </select>
                </div>
              </>
            )}
          </div>

          {/* Card 7: Cloud Integrations */}
          <div className="panel" style={{ marginBottom: 0 }}>
            <div className="panel-header">
              <h2 className="panel-title">System Integrations</h2>
            </div>
            
            <div className="form-group">
              <label className="form-label">Resend API Key</label>
              <input
                type="password"
                className="input-field"
                placeholder={settings.resendConfigured ? 'Configured on hosting computer' : 'Paste Resend API key'}
                value={resendKey}
                onChange={(e) => setResendKey(e.target.value)}
              />
            </div>

            <div className="form-group">
              <label className="form-label">Send-From Address</label>
              <input
                type="text"
                className="input-field"
                placeholder="QuoteFlow <onboarding@resend.dev>"
                value={notificationFromEmail}
                onChange={(e) => setNotificationFromEmail(e.target.value)}
              />
            </div>

            <div className="form-group">
              <label className="form-label">Stripe API Key</label>
              <input
                type="password"
                className="input-field"
                placeholder={settings.stripeConfigured ? 'Configured on hosting computer' : 'Paste Stripe Key'}
                value={stripeKey}
                onChange={(e) => setStripeKey(e.target.value)}
              />
            </div>

            <div className="form-group">
              <label className="form-label">Tavily API Key (AI Search)</label>
              <input
                type="password"
                className="input-field"
                placeholder={settings.tavilyConfigured ? 'Configured on hosting computer' : 'Paste Tavily Key'}
                value={tavilyKey}
                onChange={(e) => setTavilyKey(e.target.value)}
              />
            </div>

            <div className="form-group">
              <label className="form-label">Brave Search API Key</label>
              <input
                type="password"
                className="input-field"
                placeholder={settings.braveSearchConfigured ? 'Configured on hosting computer' : 'Paste Brave Key'}
                value={braveSearchKey}
                onChange={(e) => setBraveSearchKey(e.target.value)}
              />
            </div>
          </div>

          {/* Card 8: Data Backup & Migration */}
          <div className="panel" style={{ marginBottom: 0 }}>
            <div className="panel-header">
              <h2 className="panel-title">Data Backup & Migration</h2>
            </div>
            <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '20px' }}>
              Backup your local database regularly.
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <button type="button" className="btn btn-secondary" onClick={exportDataBackup} style={{ justifyContent: 'flex-start' }}>
                <Download size={16} style={{ color: 'var(--accent)' }} /> Export local database (.JSON)
              </button>
              <label className="btn btn-secondary" style={{ justifyContent: 'flex-start', cursor: 'pointer', marginBottom: 0 }}>
                <Upload size={16} style={{ color: 'var(--info)' }} /> Import database backup
                <input type="file" accept=".json" onChange={handleImportFile} style={{ display: 'none' }} />
              </label>
            </div>
          </div>

          {/* Card 9: Danger Zone */}
          <div className="panel" style={{ border: '1px solid var(--danger)', marginBottom: 0 }}>
            <div className="panel-header" style={{ borderBottom: '1px solid var(--danger-muted)' }}>
              <h2 className="panel-title" style={{ color: 'var(--danger)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <ShieldAlert size={16} /> Danger Zone
              </h2>
            </div>
            <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '20px', marginTop: '14px' }}>
              Permanently wipes everything.
            </p>
            <button type="button" className="btn btn-danger" onClick={handleResetDatabase} style={{ width: '100%' }}>
              <Trash2 size={16} /> Master Reset Everything
            </button>
          </div>

        </div>
      </div>
    </form>
  );
}
