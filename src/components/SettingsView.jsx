import React, { useState } from 'react';
import { Save, Download, Upload, Trash2, ShieldAlert } from 'lucide-react';
import { exportDataBackup, importDataBackup } from '../utils/dataStore';

export default function SettingsView({ settings, onSettingsChange, onDataImported }) {
  const [companyName, setCompanyName] = useState(settings.companyName || '');
  const [contractorName, setContractorName] = useState(settings.contractorName || '');
  const [email, setEmail] = useState(settings.email || '');
  const [phone, setPhone] = useState(settings.phone || '');
  const [address, setAddress] = useState(settings.address || '');
  const [defaultLaborRate, setDefaultLaborRate] = useState(settings.defaultLaborRate || 85);
  const [defaultMarkupPercent, setDefaultMarkupPercent] = useState(settings.defaultMarkupPercent || 20);
  const [defaultTaxPercent, setDefaultTaxPercent] = useState(settings.defaultTaxPercent || 8.25);
  const PRESET_MODELS = [
    'openrouter/auto',
    'google/gemini-2.5-flash:free',
    'meta-llama/llama-3-8b-instruct:free',
    'meta-llama/llama-3.3-70b-instruct',
    'deepseek/deepseek-r1',
    'anthropic/claude-3.5-sonnet',
    'google/gemini-2.5-pro'
  ];

  const initialModel = settings.openRouterModel || 'openrouter/auto';
  const isPreset = PRESET_MODELS.includes(initialModel);

  const [openRouterKey, setOpenRouterKey] = useState(settings.openRouterKey || '');
  const [openRouterModel, setOpenRouterModel] = useState(initialModel);
  const [selectedPreset, setSelectedPreset] = useState(isPreset ? initialModel : 'custom');
  const [customModelText, setCustomModelText] = useState(isPreset ? 'openrouter/free' : initialModel);
  
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [importStatus, setImportStatus] = useState({ type: '', message: '' });

  const handlePresetChange = (val) => {
    setSelectedPreset(val);
    if (val === 'custom') {
      setOpenRouterModel(customModelText || 'openrouter/free');
    } else {
      setOpenRouterModel(val);
    }
  };

  const handleCustomTextChange = (val) => {
    setCustomModelText(val);
    setOpenRouterModel(val);
  };

  const handleSave = (e) => {
    e.preventDefault();
    onSettingsChange({
      companyName,
      contractorName,
      email,
      phone,
      address,
      defaultLaborRate: parseFloat(defaultLaborRate) || 0,
      defaultMarkupPercent: parseFloat(defaultMarkupPercent) || 0,
      defaultTaxPercent: parseFloat(defaultTaxPercent) || 0,
      openRouterKey,
      openRouterModel,
    });
    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 3000);
  };

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

  const handleResetDatabase = () => {
    if (window.confirm('WARNING: This will completely wipe all local data including projects, clients, and settings. Are you absolutely sure?')) {
      localStorage.clear();
      window.location.reload();
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      
      <div className="grid-2">
        {/* LEFT COLUMN: COMPANY & COST SETTINGS */}
        <div className="panel" style={{ marginBottom: 0 }}>
          <div className="panel-header">
            <h2 className="panel-title">Contractor & Pricing Configuration</h2>
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

            <div style={{ borderTop: '1px dashed var(--border-color)', margin: '24px 0' }}></div>

            <h3 style={{ fontSize: '11px', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '14px', letterSpacing: '0.5px' }}>
              Standard Cost Estimates Defaults
            </h3>

            <div className="grid-2">
              <div className="form-group">
                <label className="form-label">Default Labor Rate ($/hr)</label>
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
              OpenRouter NLP Configuration
            </h3>

            <div className="form-group">
              <label className="form-label">OpenRouter API Key</label>
              <input 
                type="password" 
                className="input-field" 
                placeholder={settings.openRouterKey ? "••••••••••••••••••••••••" : "sk-or-v1-..."}
                value={openRouterKey}
                onChange={(e) => setOpenRouterKey(e.target.value)}
                style={{ fontFamily: 'var(--font-mono)' }}
              />
              <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '4px' }}>
                Your key is stored locally in your browser cache and is only sent directly to OpenRouter.
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Preferred LLM Model</label>
              <select 
                className="input-field"
                value={selectedPreset}
                onChange={(e) => handlePresetChange(e.target.value)}
              >
                <option value="openrouter/auto">OpenRouter Auto-Router (Free/Cheap Auto)</option>
                <option value="google/gemini-2.5-flash:free">Google Gemini 2.5 Flash (Free Endpoint)</option>
                <option value="meta-llama/llama-3-8b-instruct:free">Meta Llama 3 8B (Free Endpoint)</option>
                <option value="meta-llama/llama-3.3-70b-instruct">Meta Llama 3.3 70B (High Precision)</option>
                <option value="deepseek/deepseek-r1">DeepSeek R1 (Premium Reasoning)</option>
                <option value="anthropic/claude-3.5-sonnet">Anthropic Claude 3.5 Sonnet (Premium)</option>
                <option value="google/gemini-2.5-pro">Google Gemini 2.5 Pro (Premium)</option>
                <option value="custom">Other / Custom Model...</option>
              </select>
            </div>

            {selectedPreset === 'custom' && (
              <div className="form-group">
                <label className="form-label">Custom OpenRouter Model Identifier</label>
                <input 
                  type="text" 
                  className="input-field" 
                  placeholder="e.g. openrouter/free or mistralai/mistral-7b-instruct:free"
                  value={customModelText}
                  onChange={(e) => handleCustomTextChange(e.target.value)}
                  style={{ fontFamily: 'var(--font-mono)' }}
                  required
                />
                <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '4px' }}>
                  Input any model identifier from OpenRouter (e.g. <code>openrouter/free</code>).
                </div>
              </div>
            )}

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
              Wipe all client records, active remodeling estimates, and photo records from local browser storage. This action is irreversible.
            </p>

            <button className="btn btn-danger" onClick={handleResetDatabase} style={{ width: '100%' }}>
              <Trash2 size={16} /> Wipe Local Database
            </button>
          </div>

        </div>
      </div>

    </div>
  );
}
