import React, { useEffect, useState } from 'react';
import { Save, Download, Upload, Trash2, ShieldAlert } from 'lucide-react';
import { exportDataBackup, importDataBackup, masterResetData } from '../utils/dataStore';
import { fetchAllFishVoices, generateFishSpeech } from '../utils/fishAudio';
import { fetchOpenRouterModels } from '../utils/openRouterModels';

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
  const initialModel = settings.openRouterModel || 'openrouter/auto';

  const [openRouterKey, setOpenRouterKey] = useState(settings.openRouterKey || '');
  const [openRouterModel, setOpenRouterModel] = useState(initialModel);
  const [openRouterModels, setOpenRouterModels] = useState([]);
  const [openRouterModelSearch, setOpenRouterModelSearch] = useState('');
  const [openRouterStatus, setOpenRouterStatus] = useState('');
  const [openRouterLoading, setOpenRouterLoading] = useState(false);
  
  const [resendKey, setResendKey] = useState(settings.resendKey || '');
  const [notificationFromEmail, setNotificationFromEmail] = useState(settings.notificationFromEmail || '');
  const [team, setTeam] = useState(Array.isArray(settings.team) ? settings.team : []);
  const [newMemberName, setNewMemberName] = useState('');
  const [newMemberEmail, setNewMemberEmail] = useState('');
  const [testEmail, setTestEmail] = useState('');
  const [testStatus, setTestStatus] = useState('');

  const [saveSuccess, setSaveSuccess] = useState(false);
  const [importStatus, setImportStatus] = useState({ type: '', message: '' });

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
    setOpenRouterStatus('Checking your OpenRouter model access...');
    try {
      const models = await fetchOpenRouterModels(key);
      setOpenRouterModels(models);
      setOpenRouterStatus(`Loaded ${models.length} available models from OpenRouter.`);
    } catch (error) {
      setOpenRouterModels([]);
      setOpenRouterStatus(error.message);
    } finally {
      setOpenRouterLoading(false);
    }
  };

  useEffect(() => {
    const key = openRouterKey.trim();
    if (!key && !settings.openRouterConfigured) return undefined;
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
      resendKey,
      notificationFromEmail,
      team,
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
      });
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (error) {
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
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      
      <div className="grid-2">
        {/* LEFT COLUMN: COMPANY & COST SETTINGS */}
        <div className="panel" style={{ marginBottom: 0 }}>
          <div className="panel-header">
            <h2 className="panel-title">Business & Pricing Configuration</h2>
          </div>
          
          <form onSubmit={handleSave}>
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
              <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '4px' }}>
                This statement is included in every AI request as behavioral guidance.
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

            <div style={{ borderTop: '1px dashed var(--border-color)', margin: '24px 0' }}></div>

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

            <div style={{ borderTop: '1px dashed var(--border-color)', margin: '24px 0' }}></div>

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
                <button type="button" className="btn btn-secondary" onClick={() => loadOpenRouterModels()} disabled={openRouterLoading || !(openRouterKey || settings.openRouterConfigured)}>
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
                {openRouterModel && openRouterModel !== 'openrouter/auto' && !visibleOpenRouterModels.some((model) => model.id === openRouterModel) && (
                  <option value={openRouterModel}>{openRouterModel} (current)</option>
                )}
                <option value="openrouter/auto">OpenRouter Auto Router</option>
                {visibleOpenRouterModels.map((model) => (
                  <option key={model.id} value={model.id}>
                    {model.free ? '[FREE] ' : ''}{model.name} — {model.id}
                  </option>
                ))}
              </select>
              <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '4px' }}>
                Exact live API identifiers are used. Free models are listed first and marked FREE.
              </div>
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
                    <div style={{ color: 'var(--text-muted)', fontSize: '10px', textTransform: 'uppercase' }}>Input / Prompt</div>
                    <div style={{ fontFamily: 'var(--font-mono)', fontWeight: '700' }}>{perMillion(selectedOpenRouterModel.pricing.prompt)} / 1M tokens</div>
                  </div>
                  <div style={{ padding: '10px', background: 'var(--bg-secondary)' }}>
                    <div style={{ color: 'var(--text-muted)', fontSize: '10px', textTransform: 'uppercase' }}>Output / Completion</div>
                    <div style={{ fontFamily: 'var(--font-mono)', fontWeight: '700' }}>{perMillion(selectedOpenRouterModel.pricing.completion)} / 1M tokens</div>
                  </div>
                  <div style={{ padding: '10px', background: 'var(--bg-secondary)' }}>
                    <div style={{ color: 'var(--text-muted)', fontSize: '10px', textTransform: 'uppercase' }}>Fixed Request Fee</div>
                    <div style={{ fontFamily: 'var(--font-mono)', fontWeight: '700' }}>{formatFixedCost(selectedOpenRouterModel.pricing.request)} / request</div>
                  </div>
                  <div style={{ padding: '10px', background: 'var(--bg-secondary)' }}>
                    <div style={{ color: 'var(--text-muted)', fontSize: '10px', textTransform: 'uppercase' }}>Context Window</div>
                    <div style={{ fontFamily: 'var(--font-mono)', fontWeight: '700' }}>{selectedOpenRouterModel.contextLength.toLocaleString()} tokens</div>
                  </div>
                </div>

                {(selectedOpenRouterModel.pricing.internalReasoning > 0
                  || selectedOpenRouterModel.pricing.cacheRead > 0
                  || selectedOpenRouterModel.pricing.cacheWrite > 0
                  || selectedOpenRouterModel.pricing.webSearch > 0) && (
                  <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '10px', lineHeight: 1.7 }}>
                    {selectedOpenRouterModel.pricing.internalReasoning > 0 && <div>Reasoning tokens: {perMillion(selectedOpenRouterModel.pricing.internalReasoning)} per 1M</div>}
                    {selectedOpenRouterModel.pricing.cacheRead > 0 && <div>Cached-input reads: {perMillion(selectedOpenRouterModel.pricing.cacheRead)} per 1M</div>}
                    {selectedOpenRouterModel.pricing.cacheWrite > 0 && <div>Cached-input writes: {perMillion(selectedOpenRouterModel.pricing.cacheWrite)} per 1M</div>}
                    {selectedOpenRouterModel.pricing.webSearch > 0 && <div>Web search: {formatFixedCost(selectedOpenRouterModel.pricing.webSearch)} per operation</div>}
                  </div>
                )}

                <div style={{ borderTop: '1px dashed var(--border-color)', marginTop: '12px', paddingTop: '10px', fontSize: '11px', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                  Example: 10,000 input tokens plus 2,000 output tokens would cost approximately{' '}
                  <strong style={{ color: 'var(--accent)', fontFamily: 'var(--font-mono)' }}>
                    {selectedOpenRouterModel.free ? '$0.00' : formatFixedCost(exampleCost)}
                  </strong>.
                  Input tokens include your instructions, business context, persona, conversation history, and project data. Output tokens are the model’s generated reasoning and response. Actual billing uses the provider’s measured token counts.
                </div>
              </div>
            )}

            {openRouterModel === 'openrouter/auto' && (
              <div style={{ padding: '12px', border: '1px solid var(--border-color)', marginBottom: '14px', fontSize: '11px', color: 'var(--text-secondary)' }}>
                Auto Router selects a model dynamically, so it has no single fixed token price. Choose a specific model above to see exact posted rates and make costs predictable.
              </div>
            )}

            {openRouterStatus && (
              <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginBottom: '12px' }}>
                {openRouterStatus}
              </div>
            )}

            <div style={{ borderTop: '1px dashed var(--border-color)', margin: '24px 0' }}></div>

            <h3 style={{ fontSize: '11px', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '14px', letterSpacing: '0.5px' }}>
              Fish Audio Text-to-Speech
            </h3>

            <div className="form-group">
              <label className="form-label">Fish Audio API Key</label>
              <input
                type="password"
                className="input-field"
                placeholder={settings.fishAudioConfigured ? 'Configured on hosting computer' : 'Paste your Fish Audio API key'}
                value={fishAudioKey}
                onChange={(e) => setFishAudioKey(e.target.value)}
                style={{ fontFamily: 'var(--font-mono)' }}
              />
              <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '4px' }}>
                Stored only in this browser and sent directly to Fish Audio.
              </div>
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
                  {fishLoading ? 'Loading...' : 'Load All Voices'}
                </button>
              </div>
            </div>

            {(fishVoices.length > 0 || fishVoiceId) && (
              <>
                <div className="form-group">
                  <label className="form-label">Search Available Voices</label>
                  <input
                    type="text"
                    className="input-field"
                    value={fishVoiceSearch}
                    onChange={(e) => setFishVoiceSearch(e.target.value)}
                    placeholder="Search by voice, author, language, or tag"
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Selected Fish Audio Voice</label>
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
                        {voice.title}{voice.author ? ` — ${voice.author}` : ''}{voice.languages.length ? ` (${voice.languages.join(', ')})` : ''}
                      </option>
                    ))}
                  </select>
                </div>

                <button type="button" className="btn btn-secondary btn-sm" onClick={testFishVoice} disabled={fishLoading || !fishVoiceId}>
                  Test Selected Voice
                </button>
              </>
            )}

            {fishStatus && (
              <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '10px' }}>
                {fishStatus}
              </div>
            )}

            <h3 style={{ fontSize: '11px', textTransform: 'uppercase', color: 'var(--text-muted)', margin: '28px 0 14px', letterSpacing: '0.5px' }}>
              Reminders & Team (Email via Resend)
            </h3>

            <div className="form-group">
              <label className="form-label">Resend API Key</label>
              <input
                type="password"
                className="input-field"
                placeholder={settings.resendConfigured ? 'Configured on hosting computer' : 'Paste your Resend API key (re_...)'}
                value={resendKey}
                onChange={(e) => setResendKey(e.target.value)}
              />
              <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>
                Powers autonomous task reminders and customer status updates. Stored only on the hosting computer.
              </div>
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
              <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>
                Must be a verified Resend sender. Leave blank to use Resend's test address.
              </div>
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
                Save to apply. Members appear as assignee options on the calendar.
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Send a Test Email</label>
              <div style={{ display: 'flex', gap: '8px' }}>
                <input type="email" className="input-field" placeholder="you@example.com" value={testEmail} onChange={(e) => setTestEmail(e.target.value)} />
                <button type="button" className="btn btn-secondary btn-sm" onClick={sendTestEmail} disabled={!testEmail.trim()}>Send Test</button>
              </div>
              {testStatus && (
                <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '6px' }}>{testStatus}</div>
              )}
              <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>
                Save your Resend key first. Test sending only works from the hosting computer.
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginTop: '24px' }}>
              <button type="submit" className="btn btn-primary">
                <Save size={14} /> Save Configuration
              </button>
              {saveSuccess && (
                <span style={{ color: 'var(--success)', fontSize: '12px', fontWeight: 'bold' }}>
                  ✓ System settings saved successfully.
                </span>
              )}
            </div>
          </form>
        </div>

        {/* RIGHT COLUMN: SYSTEM UTILITIES & BACKUPS */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          
          {/* Backups Panel */}
          <div className="panel">
            <div className="panel-header">
              <h2 className="panel-title">Data backup & migration</h2>
            </div>
            
            <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '20px' }}>
              Since all details are stored directly in your web browser local storage, you should periodically back up your data to avoid losing quotes during cache cleans.
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <button className="btn btn-secondary" onClick={exportDataBackup} style={{ justifyContent: 'flex-start' }}>
                <Download size={16} style={{ color: 'var(--accent)' }} /> Export local database (.JSON)
              </button>

              <label className="btn btn-secondary" style={{ justifyContent: 'flex-start', cursor: 'pointer', marginBottom: 0 }}>
                <Upload size={16} style={{ color: 'var(--info)' }} /> Import database backup
                <input 
                  type="file" 
                  accept=".json" 
                  onChange={handleImportFile} 
                  style={{ display: 'none' }} 
                />
              </label>
            </div>

            {importStatus.message && (
              <div 
                style={{ 
                  marginTop: '16px', 
                  padding: '10px 14px', 
                  borderLeft: '3px solid',
                  borderColor: importStatus.type === 'success' ? 'var(--success)' : 'var(--danger)',
                  backgroundColor: importStatus.type === 'success' ? 'var(--success-muted)' : 'var(--danger-muted)',
                  fontSize: '12px',
                  color: importStatus.type === 'success' ? 'var(--success)' : 'var(--danger)',
                }}
              >
                {importStatus.message}
              </div>
            )}
          </div>

          {/* Danger zone / Factory Reset */}
          <div className="panel" style={{ border: '1px solid var(--danger)' }}>
            <div className="panel-header" style={{ borderBottom: '1px solid var(--danger-muted)' }}>
              <h2 className="panel-title" style={{ color: 'var(--danger)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <ShieldAlert size={16} /> Danger Zone
              </h2>
            </div>
            
            <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '20px', marginTop: '14px' }}>
              Permanently wipes every client, project, quote, catalog item, chat, API key, voice selection, persona, and setting stored by QuoteFlow in this browser.
            </p>

            <div style={{ padding: '12px', marginBottom: '16px', border: '1px solid var(--danger)', background: 'var(--danger-muted)', color: 'var(--danger)', fontSize: '12px', fontWeight: '700' }}>
              Warning: this cannot be undone. Export a backup first if you may need this data later. You will be asked twice before anything is deleted.
            </div>

            <button className="btn btn-danger" onClick={handleResetDatabase} style={{ width: '100%' }}>
              <Trash2 size={16} /> Master Reset Everything
            </button>
          </div>

        </div>
      </div>

    </div>
  );
}
