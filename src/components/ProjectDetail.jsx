import React, { useState } from 'react';
import { 
  CheckSquare, 
  Square, 
  Plus, 
  Trash2, 
  Camera, 
  FileText, 
  ArrowLeft, 
  AlertTriangle, 
  Check, 
  X, 
  PlusSquare,
  Clock,
  DollarSign,
  FileBadge,
  Download,
  Mail,
  Send,
  Save,
  ArrowUp,
  ArrowDown
} from 'lucide-react';
import { CATEGORIES } from '../utils/templates';
import { calculateQuoteTotals } from '../utils/dataStore';

export default function ProjectDetail({ 
  project, 
  clients, 
  settings, 
  onUpdateProject, 
  onEditQuote,
  onClose 
}) {
  const [activeTab, setActiveTab] = useState('checklist');
  const client = clients.find(c => c.id === project.clientId);

  // New Checklist state
  const [newChecklistText, setNewChecklistText] = useState('');

  // New Change Order states
  const [showAddCO, setShowAddCO] = useState(false);
  const [coTitle, setCoTitle] = useState('');
  const [coDesc, setCoDesc] = useState('');
  const [coItems, setCoItems] = useState([]);

  // New Photo states
  const [photoTitle, setPhotoTitle] = useState('');
  const [photoPhase, setPhotoPhase] = useState('Demolition');
  const [photoError, setPhotoError] = useState('');

  // Artifact Builder states
  const [showArtifactBuilder, setShowArtifactBuilder] = useState(false);
  const [editingArtifact, setEditingArtifact] = useState(null);
  const [newArtifactTitle, setNewArtifactTitle] = useState('');
  const [isEmailingArtifact, setIsEmailingArtifact] = useState(false);

  // Summary & Log states
  const [summaryText, setSummaryText] = useState(project.summary || '');
  const [newLogText, setNewLogText] = useState('');

  React.useEffect(() => {
    setSummaryText(project.summary || '');
  }, [project.summary]);

  const totals = React.useMemo(() => {
    return calculateQuoteTotals(project, settings);
  }, [project, settings]);

  // Format currency helpers
  const formatCurrency = (val) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(val || 0);
  };

  // --- SUMMARY & LOG LOGIC ---
  const handleSaveSummary = () => {
    if (summaryText !== project.summary) {
      onUpdateProject({ ...project, summary: summaryText });
    }
  };

  const handleAddLog = (e) => {
    e.preventDefault();
    if (!newLogText.trim()) return;
    const newLog = {
      id: `log-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
      timestamp: new Date().toISOString(),
      message: newLogText.trim()
    };
    onUpdateProject({
      ...project,
      logs: [...(project.logs || []), newLog]
    });
    setNewLogText('');
  };

  // --- CHECKLIST LOGIC ---
  const handleAddChecklist = (e) => {
    e.preventDefault();
    if (!newChecklistText.trim()) return;

    const newItem = {
      id: `ck-${Date.now()}`,
      text: newChecklistText.trim(),
      completed: false
    };

    onUpdateProject({
      ...project,
      checklists: [...project.checklists, newItem]
    });
    setNewChecklistText('');
  };

  const toggleChecklist = (id) => {
    const updated = project.checklists.map(item => 
      item.id === id ? { ...item, completed: !item.completed } : item
    );
    onUpdateProject({
      ...project,
      checklists: updated
    });
  };

  const deleteChecklistItem = (id) => {
    const updated = project.checklists.filter(item => item.id !== id);
    onUpdateProject({
      ...project,
      checklists: updated
    });
  };

  const checklistProgress = React.useMemo(() => {
    if (project.checklists.length === 0) return 0;
    const completed = project.checklists.filter(item => item.completed).length;
    return Math.round((completed / project.checklists.length) * 100);
  }, [project.checklists]);

  // --- CHANGE ORDERS LOGIC ---
  const handleAddCOItem = () => {
    setCoItems([
      ...coItems,
      {
        id: `coi-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
        category: 'Other',
        name: 'Change Order Task',
        unit: 'each',
        quantity: 1,
        materialCost: 0,
        laborHours: 0
      }
    ]);
  };

  const handleUpdateCOItem = (idx, field, val) => {
    const updated = [...coItems];
    if (field === 'quantity') updated[idx].quantity = parseFloat(val) || 0;
    else if (field === 'materialCost') updated[idx].materialCost = parseFloat(val) || 0;
    else if (field === 'laborHours') updated[idx].laborHours = parseFloat(val) || 0;
    else updated[idx][field] = val;
    setCoItems(updated);
  };

  const handleRemoveCOItem = (idx) => {
    setCoItems(coItems.filter((_, i) => i !== idx));
  };

  const handleCreateChangeOrder = (e) => {
    e.preventDefault();
    if (!coTitle || coItems.length === 0) return;

    const newCO = {
      id: `co-${Date.now()}`,
      title: coTitle,
      description: coDesc,
      status: 'pending',
      date: new Date().toISOString().slice(0, 10),
      items: coItems
    };

    onUpdateProject({
      ...project,
      changeOrders: [...project.changeOrders, newCO]
    });

    // Reset Form
    setCoTitle('');
    setCoDesc('');
    setCoItems([]);
    setShowAddCO(false);
  };

  const updateCOStatus = (coId, nextStatus) => {
    const updated = project.changeOrders.map(co => 
      co.id === coId ? { ...co, status: nextStatus } : co
    );
    onUpdateProject({
      ...project,
      changeOrders: updated
    });
  };

  const deleteChangeOrder = (coId) => {
    if (window.confirm('Are you sure you want to delete this Change Order?')) {
      const updated = project.changeOrders.filter(co => co.id !== coId);
      onUpdateProject({
        ...project,
        changeOrders: updated
      });
    }
  };

  // --- PHOTO UPLOAD LOGIC ---
  const handlePhotoUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    // Limit size to ~1.5MB to prevent LocalStorage bloat
    if (file.size > 1500000) {
      setPhotoError('Image file is too large (limit 1.5MB to save in local storage).');
      return;
    }
    setPhotoError('');

    const reader = new FileReader();
    reader.onloadend = () => {
      const newPhoto = {
        id: `ph-${Date.now()}`,
        url: reader.result,
        title: photoTitle.trim() || file.name,
        phase: photoPhase,
        date: new Date().toISOString().slice(0, 10)
      };

      onUpdateProject({
        ...project,
        photos: [...project.photos, newPhoto]
      });

      setPhotoTitle('');
    };
    reader.readAsDataURL(file);
  };

  const deletePhoto = (photoId) => {
    if (window.confirm('Delete this photo from project records?')) {
      const updated = project.photos.filter(p => p.id !== photoId);
      onUpdateProject({
        ...project,
        photos: updated
      });
    }
  };

  // Helper to calculate singular change order pricing
  const getCOPrice = (co) => {
    let mats = 0;
    let hrs = 0;
    co.items.forEach(item => {
      mats += item.materialCost * item.quantity;
      hrs += item.laborHours * item.quantity;
    });
    const laborRate = project.laborRate || settings.defaultLaborRate || 85.00;
    const markupPercent = project.markupPercent !== undefined ? project.markupPercent : (settings.defaultMarkupPercent || 20.0);
    const taxPercent = project.taxPercent !== undefined ? project.taxPercent : (settings.defaultTaxPercent || 8.25);

    const direct = mats + (hrs * laborRate);
    const markup = direct * (markupPercent / 100);
    const tax = mats * (taxPercent / 100);
    return direct + markup + tax;
  };

  // --- ARTIFACT BUILDER LOGIC ---
  const handleCreateArtifact = (e) => {
    e.preventDefault();
    if (!newArtifactTitle.trim()) return;

    const newArtifact = {
      id: `art-${Date.now()}`,
      title: newArtifactTitle.trim(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      sections: []
    };

    onUpdateProject({
      ...project,
      artifacts: [...(project.artifacts || []), newArtifact]
    });
    setNewArtifactTitle('');
    setEditingArtifact(newArtifact);
    setShowArtifactBuilder(true);
  };

  const handleAddArtifactSection = () => {
    if (!editingArtifact) return;
    const newSection = {
      id: `sec-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
      heading: 'New Section',
      content: ''
    };
    const updatedArtifact = {
      ...editingArtifact,
      updatedAt: new Date().toISOString(),
      sections: [...editingArtifact.sections, newSection]
    };
    setEditingArtifact(updatedArtifact);
    updateArtifactInProject(updatedArtifact);
  };

  const updateArtifactSection = (sectionId, field, value) => {
    if (!editingArtifact) return;
    const updatedSections = editingArtifact.sections.map(s => 
      s.id === sectionId ? { ...s, [field]: value } : s
    );
    const updatedArtifact = {
      ...editingArtifact,
      updatedAt: new Date().toISOString(),
      sections: updatedSections
    };
    setEditingArtifact(updatedArtifact);
    updateArtifactInProject(updatedArtifact);
  };

  const deleteArtifactSection = (sectionId) => {
    if (!editingArtifact) return;
    const updatedSections = editingArtifact.sections.filter(s => s.id !== sectionId);
    const updatedArtifact = {
      ...editingArtifact,
      updatedAt: new Date().toISOString(),
      sections: updatedSections
    };
    setEditingArtifact(updatedArtifact);
    updateArtifactInProject(updatedArtifact);
  };

  const moveArtifactSection = (index, direction) => {
    if (!editingArtifact) return;
    const newIndex = index + direction;
    if (newIndex < 0 || newIndex >= editingArtifact.sections.length) return;
    
    const updatedSections = [...editingArtifact.sections];
    const temp = updatedSections[index];
    updatedSections[index] = updatedSections[newIndex];
    updatedSections[newIndex] = temp;

    const updatedArtifact = {
      ...editingArtifact,
      updatedAt: new Date().toISOString(),
      sections: updatedSections
    };
    setEditingArtifact(updatedArtifact);
    updateArtifactInProject(updatedArtifact);
  };

  const updateArtifactInProject = (updatedArtifact) => {
    const updatedList = (project.artifacts || []).map(a => 
      a.id === updatedArtifact.id ? updatedArtifact : a
    );
    onUpdateProject({
      ...project,
      artifacts: updatedList
    });
  };

  const deleteArtifact = (artifactId) => {
    if (window.confirm('Are you sure you want to delete this Artifact?')) {
      const updatedList = (project.artifacts || []).filter(a => a.id !== artifactId);
      onUpdateProject({
        ...project,
        artifacts: updatedList
      });
      if (editingArtifact?.id === artifactId) {
        setShowArtifactBuilder(false);
        setEditingArtifact(null);
      }
    }
  };

  const handleDownloadArtifactPdf = async (artifact) => {
    const { generateArtifactPdf } = await import('../utils/generateArtifactPdf');
    generateArtifactPdf(artifact, project, client, settings);
  };

  const handleEmailArtifact = async (artifact) => {
    if (!client?.email) {
      alert("This client does not have an email address set.");
      return;
    }
    const confirm = window.confirm(`Email this document to ${client.email}?`);
    if (!confirm) return;
    
    setIsEmailingArtifact(true);
    try {
      let htmlBody = `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; color: #333;">
          <h2 style="color: #2b6cb0;">${artifact.title}</h2>
          <p>Project: ${project.name}</p>
          <hr style="border: 0; border-top: 1px solid #ddd; margin: 20px 0;" />
      `;

      artifact.sections.forEach(sec => {
        htmlBody += `
          <h3 style="color: #444; margin-top: 24px;">${sec.heading}</h3>
          <div style="white-space: pre-wrap; font-size: 14px; line-height: 1.5; color: #555;">${sec.content}</div>
        `;
      });

      htmlBody += `
          <hr style="border: 0; border-top: 1px solid #ddd; margin: 30px 0 20px 0;" />
          <p>Thank you,<br>${settings.companyName || 'Our Team'}</p>
        </div>
      `;
      
      const emailRes = await fetch('/api/email/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clientEmail: client.email,
          subject: `${artifact.title} - ${project.name}`,
          htmlBody: htmlBody
        })
      });
      const emailData = await emailRes.json();
      if (!emailRes.ok) throw new Error(emailData.error || 'Failed to send email');
      
      alert("Document successfully emailed to client!");
    } catch (e) {
      alert("Error: " + e.message);
    } finally {
      setIsEmailingArtifact(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      
      {/* HEADER CONTROL PANEL */}
      <div className="panel" style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: '16px', alignItems: 'center', marginBottom: 0 }}>
        <div style={{ display: 'flex', gap: '10px' }}>
          <button className="btn btn-secondary btn-sm" onClick={onClose}>
            <ArrowLeft size={14} /> Back
          </button>
          <button className="btn btn-primary btn-sm" onClick={() => onEditQuote(project.id)}>
            <FileText size={14} /> Estimate Builder
          </button>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '24px', fontSize: '13px' }}>
          <span>
            Client: <strong>{client?.name}</strong>
          </span>
          {project.startDate && (
            <span>
              Start: <strong style={{ fontFamily: 'var(--font-mono)' }}>{project.startDate}</strong>
            </span>
          )}
          {project.endDate && (
            <span>
              Target Completion: <strong style={{ fontFamily: 'var(--font-mono)' }}>{project.endDate}</strong>
            </span>
          )}
        </div>
      </div>

      {/* METRIC BREAKDOWNS INCLUDING CHANGE ORDERS */}
      <div className="metrics-grid">
        <div className="metric-card">
          <div className="metric-label">Contract Base Value</div>
          <div className="metric-value">{formatCurrency(totals.baseTotal)}</div>
          <div className="metric-change" style={{ color: 'var(--text-secondary)' }}>
            Original approved quote
          </div>
        </div>

        <div className="metric-card">
          <div className="metric-label">Approved Change Orders</div>
          <div className="metric-value" style={{ color: 'var(--accent)' }}>
            + {formatCurrency(totals.approvedChangeOrdersTotal)}
          </div>
          <div className="metric-change" style={{ color: 'var(--text-secondary)' }}>
            {project.changeOrders.filter(co => co.status === 'approved').length} Adjustments Added
          </div>
        </div>

        <div className="metric-card">
          <div className="metric-label">Total Contract Sum</div>
          <div className="metric-value" style={{ color: 'var(--success)' }}>
            {formatCurrency(totals.netTotal)}
          </div>
          <div className="metric-change" style={{ color: 'var(--text-secondary)' }}>
            Base contract + approved changes
          </div>
        </div>

        <div className="metric-card">
          <div className="metric-label">Scope Progress</div>
          <div className="metric-value">{checklistProgress}%</div>
          <div className="metric-change" style={{ width: '100%' }}>
            <div style={{ width: '100%', height: '4px', backgroundColor: 'var(--border-color)', marginTop: '4px' }}>
              <div style={{ height: '100%', width: `${checklistProgress}%`, backgroundColor: 'var(--accent)' }}></div>
            </div>
          </div>
        </div>
      </div>

      {/* TABS NAVIGATION */}
      <div>
        <div style={{ display: 'flex', borderBottom: '1px solid var(--border-color)', marginBottom: '24px' }}>
          <button 
            className={`btn btn-secondary`}
            style={{ 
              borderBottom: activeTab === 'summary' ? '2px solid var(--accent)' : 'none',
              backgroundColor: activeTab === 'summary' ? 'var(--bg-secondary)' : 'transparent',
              borderColor: 'transparent'
            }}
            onClick={() => setActiveTab('summary')}
          >
            Summary & Log
          </button>
          
          <button 
            className={`btn btn-secondary`}
            style={{ 
              borderBottom: activeTab === 'checklist' ? '2px solid var(--accent)' : 'none',
              backgroundColor: activeTab === 'checklist' ? 'var(--bg-secondary)' : 'transparent',
              borderColor: 'transparent'
            }}
            onClick={() => setActiveTab('checklist')}
          >
            Job Checklist
          </button>
          
          <button 
            className={`btn btn-secondary`}
            style={{ 
              borderBottom: activeTab === 'change-orders' ? '2px solid var(--accent)' : 'none',
              backgroundColor: activeTab === 'change-orders' ? 'var(--bg-secondary)' : 'transparent',
              borderColor: 'transparent'
            }}
            onClick={() => setActiveTab('change-orders')}
          >
            Change Orders ({project.changeOrders.length})
          </button>

          <button 
            className={`btn btn-secondary`}
            style={{ 
              borderBottom: activeTab === 'photos' ? '2px solid var(--accent)' : 'none',
              backgroundColor: activeTab === 'photos' ? 'var(--bg-secondary)' : 'transparent',
              borderColor: 'transparent'
            }}
            onClick={() => setActiveTab('photos')}
          >
            Site Gallery ({project.photos.length})
          </button>

          <button 
            className={`btn btn-secondary`}
            style={{ 
              borderBottom: activeTab === 'artifacts' ? '2px solid var(--accent)' : 'none',
              backgroundColor: activeTab === 'artifacts' ? 'var(--bg-secondary)' : 'transparent',
              borderColor: 'transparent'
            }}
            onClick={() => {
              setActiveTab('artifacts');
              setShowArtifactBuilder(false);
            }}
          >
            Artifact Registry ({(project.artifacts || []).length})
          </button>
        </div>

        {/* TAB: SUMMARY & LOG */}
        {activeTab === 'summary' && (
          <div className="card" style={{ padding: '24px' }}>
            <div className="grid-2" style={{ gap: '32px', gridTemplateColumns: '1fr 1fr' }}>
              
              {/* Left Column: Summary */}
              <div>
                <h3 style={{ fontSize: '14px', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <FileText size={16} />
                  Project Summary
                </h3>
                <div className="form-group">
                  <textarea 
                    className="input-field" 
                    placeholder="Write a high-level summary of the project scope, key decisions, or general notes..."
                    value={summaryText}
                    onChange={(e) => setSummaryText(e.target.value)}
                    onBlur={handleSaveSummary}
                    rows={12}
                  />
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '8px', display: 'flex', justifyContent: 'space-between' }}>
                    <span>Auto-saves when you click outside the box.</span>
                    <button type="button" className="btn btn-secondary" style={{ padding: '2px 8px', fontSize: '11px', height: 'auto' }} onClick={handleSaveSummary}>Save Now</button>
                  </div>
                </div>
              </div>

              {/* Right Column: Rolling Log */}
              <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
                <h3 style={{ fontSize: '14px', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Clock size={16} />
                  Rolling Activity Log
                </h3>
                
                <div style={{ flex: 1, minHeight: '300px', maxHeight: '400px', overflowY: 'auto', border: '1px solid var(--border-color)', borderRadius: '6px', padding: '16px', marginBottom: '16px', backgroundColor: 'var(--bg-primary)' }}>
                  {(!project.logs || project.logs.length === 0) ? (
                    <div style={{ textAlign: 'center', color: 'var(--text-muted)', marginTop: '40px', fontSize: '13px' }}>
                      No logs yet. Use the box below or ask the AI to log important updates.
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                      {(project.logs || []).map(log => (
                        <div key={log.id} style={{ display: 'flex', gap: '12px' }}>
                          <div style={{ minWidth: '40px', paddingTop: '4px' }}>
                            <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: 'var(--accent)', margin: '0 auto' }}></div>
                            <div style={{ width: '2px', height: '100%', backgroundColor: 'var(--border-color)', margin: '0 auto' }}></div>
                          </div>
                          <div>
                            <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '4px' }}>
                              {new Date(log.timestamp).toLocaleString()}
                            </div>
                            <div style={{ fontSize: '13px', lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>
                              {log.message}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <form onSubmit={handleAddLog} style={{ display: 'flex', gap: '8px' }}>
                  <input 
                    type="text" 
                    className="input-field" 
                    placeholder="Add a manual log entry..."
                    value={newLogText}
                    onChange={(e) => setNewLogText(e.target.value)}
                  />
                  <button type="submit" className="btn btn-primary" disabled={!newLogText.trim()}>
                    <Plus size={16} />
                  </button>
                </form>
              </div>

            </div>
          </div>
        )}

        {/* TAB 1: CHECKLIST PANEL */}
        {activeTab === 'checklist' && (
          <div className="panel">
            <div className="panel-header">
              <h2 className="panel-title">Checklist Tasks</h2>
              <form onSubmit={handleAddChecklist} style={{ display: 'flex', gap: '8px' }}>
                <input 
                  type="text" 
                  className="input-field" 
                  style={{ padding: '6px 12px', fontSize: '13px', minWidth: '250px' }}
                  placeholder="Add site task (e.g. Rough framing inspection)"
                  value={newChecklistText}
                  onChange={(e) => setNewChecklistText(e.target.value)}
                  required
                />
                <button type="submit" className="btn btn-primary btn-sm"><Plus size={14} /></button>
              </form>
            </div>

            {project.checklists.length === 0 ? (
              <div style={{ padding: '32px', textAlign: 'center', color: 'var(--text-secondary)', border: '1px dashed var(--border-color)' }}>
                No checklist tasks defined yet. Add some tasks above to track build progress.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', border: '1px solid var(--border-color)' }}>
                {project.checklists.map(item => (
                  <div 
                    key={item.id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '14px 18px',
                      borderBottom: '1px solid var(--border-color)',
                      backgroundColor: item.completed ? 'var(--bg-tertiary)' : 'var(--bg-primary)',
                      transition: 'background-color 0.15s ease'
                    }}
                  >
                    <div 
                      onClick={() => toggleChecklist(item.id)}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '12px',
                        cursor: 'pointer',
                        flex: 1
                      }}
                    >
                      {item.completed ? (
                        <CheckSquare size={18} style={{ color: 'var(--success)' }} />
                      ) : (
                        <Square size={18} style={{ color: 'var(--text-secondary)' }} />
                      )}
                      <span style={{ 
                        fontSize: '14px',
                        textDecoration: item.completed ? 'line-through' : 'none',
                        color: item.completed ? 'var(--text-muted)' : 'var(--text-primary)'
                      }}>
                        {item.text}
                      </span>
                    </div>

                    <button 
                      className="btn btn-secondary btn-sm"
                      style={{ padding: '4px', borderColor: 'transparent', color: 'var(--text-muted)' }}
                      onClick={() => deleteChecklistItem(item.id)}
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* TAB 2: CHANGE ORDERS PANEL */}
        {activeTab === 'change-orders' && (
          <div className="panel">
            <div className="panel-header">
              <h2 className="panel-title">Change Orders Ledger</h2>
              {!showAddCO && (
                <button className="btn btn-primary btn-sm" onClick={() => setShowAddCO(true)}>
                  <Plus size={14} /> Create Change Order
                </button>
              )}
            </div>

            {/* CREATE CHANGE ORDER DRAWER */}
            {showAddCO && (
              <div style={{ border: '1px solid var(--border-color-active)', padding: '20px', backgroundColor: 'var(--bg-primary)', marginBottom: '24px' }}>
                <h3 className="panel-title" style={{ fontSize: '12px', marginBottom: '16px' }}>New Change Order Scope</h3>
                <form onSubmit={handleCreateChangeOrder}>
                  <div className="form-group">
                    <label className="form-label">Change Order Title</label>
                    <input 
                      type="text" 
                      className="input-field" 
                      placeholder="e.g. Kitchen Backsplash Tile Upgrade"
                      value={coTitle}
                      onChange={(e) => setCoTitle(e.target.value)}
                      required
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">Reason / Description</label>
                    <textarea 
                      className="input-field" 
                      placeholder="Explain why this change is necessary and what is being modified..."
                      value={coDesc}
                      onChange={(e) => setCoDesc(e.target.value)}
                    />
                  </div>

                  {/* CO Line Items Grid */}
                  <div style={{ marginBottom: '20px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                      <label className="form-label" style={{ marginBottom: 0 }}>Itemized Additions / Deducts</label>
                      <button type="button" className="btn btn-secondary btn-sm" onClick={handleAddCOItem}>
                        <Plus size={10} /> Add Item
                      </button>
                    </div>

                    {coItems.length === 0 ? (
                      <div style={{ padding: '16px', textAlign: 'center', fontSize: '12px', color: 'var(--text-secondary)', border: '1px dashed var(--border-color)' }}>
                        No items added. Add at least one line item cost for the change order.
                      </div>
                    ) : (
                      <div className="table-container" style={{ border: '1px solid var(--border-color)' }}>
                        <table className="app-table" style={{ fontSize: '13px' }}>
                          <thead>
                            <tr>
                              <th>Description</th>
                              <th style={{ width: '15%' }}>Qty</th>
                              <th style={{ width: '15%' }}>Mat Cost ($)</th>
                              <th style={{ width: '15%' }}>Service Hrs</th>
                              <th style={{ width: '5%' }}></th>
                            </tr>
                          </thead>
                          <tbody>
                            {coItems.map((item, idx) => (
                              <tr key={item.id}>
                                <td>
                                  <input 
                                    type="text" 
                                    className="input-field" 
                                    style={{ padding: '4px', fontSize: '12px', background: 'none', border: 'none' }}
                                    value={item.name}
                                    onChange={(e) => handleUpdateCOItem(idx, 'name', e.target.value)}
                                    required
                                  />
                                </td>
                                <td>
                                  <input 
                                    type="number" 
                                    className="input-field" 
                                    style={{ padding: '4px', fontSize: '12px', textAlign: 'center' }}
                                    value={item.quantity}
                                    onChange={(e) => handleUpdateCOItem(idx, 'quantity', e.target.value)}
                                    required
                                  />
                                </td>
                                <td>
                                  <input 
                                    type="number" 
                                    className="input-field" 
                                    style={{ padding: '4px', fontSize: '12px' }}
                                    value={item.materialCost}
                                    onChange={(e) => handleUpdateCOItem(idx, 'materialCost', e.target.value)}
                                    step="any"
                                    required
                                  />
                                </td>
                                <td>
                                  <input 
                                    type="number" 
                                    className="input-field" 
                                    style={{ padding: '4px', fontSize: '12px' }}
                                    value={item.laborHours}
                                    onChange={(e) => handleUpdateCOItem(idx, 'laborHours', e.target.value)}
                                    step="any"
                                    required
                                  />
                                </td>
                                <td>
                                  <button type="button" className="btn btn-secondary btn-sm" style={{ padding: '4px', color: 'var(--danger)', borderColor: 'transparent' }} onClick={() => handleRemoveCOItem(idx)}>
                                    <Trash2 size={12} />
                                  </button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>

                  <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                    <button type="button" className="btn btn-secondary btn-sm" onClick={() => setShowAddCO(false)}>
                      Cancel
                    </button>
                    <button type="submit" className="btn btn-primary btn-sm" disabled={coItems.length === 0 || !coTitle}>
                      Add to Project
                    </button>
                  </div>
                </form>
              </div>
            )}

            {/* CHANGE ORDER LIST */}
            {project.changeOrders.length === 0 ? (
              <div style={{ padding: '32px', textAlign: 'center', color: 'var(--text-secondary)', border: '1px dashed var(--border-color)' }}>
                No change orders created. Contract value matches original quote.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                {project.changeOrders.map(co => {
                  const price = getCOPrice(co);
                  return (
                    <div key={co.id} className="change-order-card">
                      <div className="change-order-header">
                        <div>
                          <h3 style={{ fontSize: '15px', fontWeight: '700' }}>{co.title}</h3>
                          <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Created on {co.date}</span>
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                          <span style={{ fontFamily: 'var(--font-mono)', fontWeight: '600', color: 'var(--accent)' }}>
                            {formatCurrency(price)}
                          </span>

                          <span className={`badge badge-${co.status}`}>
                            {co.status}
                          </span>
                        </div>
                      </div>

                      <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '14px', borderBottom: '1px solid var(--border-color)', paddingBottom: '10px' }}>
                        {co.description || 'No description provided.'}
                      </p>

                      {/* Line Items breakdown inside card */}
                      <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginBottom: '14px' }}>
                        <strong style={{ display: 'block', marginBottom: '4px', textTransform: 'uppercase', color: 'var(--text-muted)' }}>Items Breakdown</strong>
                        {co.items.map((item, idx) => (
                          <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', padding: '3px 0' }}>
                            <span>• {item.name} (Qty: {item.quantity} {item.unit})</span>
                            <span style={{ fontFamily: 'var(--font-mono)' }}>
                              Unit price: ${item.materialCost}/unit | Service time: {item.laborHours} hrs/unit
                            </span>
                          </div>
                        ))}
                      </div>

                      {/* Approve / Reject Controls */}
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid var(--border-color)', paddingTop: '10px' }}>
                        <div style={{ display: 'flex', gap: '6px' }}>
                          {co.status !== 'approved' && (
                            <button 
                              className="btn btn-secondary btn-sm" 
                              style={{ padding: '2px 8px', fontSize: '10px', color: 'var(--success)' }}
                              onClick={() => updateCOStatus(co.id, 'approved')}
                            >
                              <Check size={10} style={{ marginRight: '2px' }} /> Approve & Sign
                            </button>
                          )}
                          {co.status !== 'rejected' && (
                            <button 
                              className="btn btn-secondary btn-sm" 
                              style={{ padding: '2px 8px', fontSize: '10px', color: 'var(--danger)' }}
                              onClick={() => updateCOStatus(co.id, 'rejected')}
                            >
                              <X size={10} style={{ marginRight: '2px' }} /> Reject
                            </button>
                          )}
                          {co.status !== 'pending' && (
                            <button 
                              className="btn btn-secondary btn-sm" 
                              style={{ padding: '2px 8px', fontSize: '10px' }}
                              onClick={() => updateCOStatus(co.id, 'pending')}
                            >
                              Reset to Pending
                            </button>
                          )}
                        </div>

                        <button 
                          className="btn btn-secondary btn-sm" 
                          style={{ padding: '4px', color: 'var(--text-muted)', borderColor: 'transparent' }}
                          onClick={() => deleteChangeOrder(co.id)}
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* TAB 3: PHOTO GALLERY */}
        {activeTab === 'photos' && (
          <div className="panel">
            <div className="panel-header" style={{ marginBottom: '24px' }}>
              <h2 className="panel-title">Progress Site Photos</h2>
              
              {/* Add photo block */}
              <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center' }}>
                <input 
                  type="text" 
                  className="input-field" 
                  style={{ padding: '6px 12px', fontSize: '13px', width: '180px' }}
                  placeholder="Photo Title/Description"
                  value={photoTitle}
                  onChange={(e) => setPhotoTitle(e.target.value)}
                />
                <select 
                  className="input-field" 
                  style={{ padding: '6px 12px', fontSize: '13px', width: '130px' }}
                  value={photoPhase}
                  onChange={(e) => setPhotoPhase(e.target.value)}
                >
                  <option value="Demolition">Demolition</option>
                  <option value="Framing">Framing</option>
                  <option value="Plumbing">Plumbing</option>
                  <option value="Electrical">Electrical</option>
                  <option value="Drywall">Drywall</option>
                  <option value="Tile & Stone">Tile & Stone</option>
                  <option value="Paint & Trim">Paint & Trim</option>
                  <option value="Finished">Finished Job</option>
                </select>

                <label className="btn btn-primary btn-sm" style={{ marginBottom: 0 }}>
                  <Camera size={14} /> Upload Site Photo
                  <input 
                    type="file" 
                    accept="image/*" 
                    onChange={handlePhotoUpload} 
                    style={{ display: 'none' }} 
                  />
                </label>
              </div>
            </div>

            {photoError && (
              <div style={{ padding: '8px 12px', backgroundColor: 'var(--danger-muted)', borderLeft: '3px solid var(--danger)', fontSize: '12px', marginBottom: '16px', color: 'var(--danger)' }}>
                {photoError}
              </div>
            )}

            {project.photos.length === 0 ? (
              <div style={{ padding: '48px', textAlign: 'center', color: 'var(--text-secondary)', border: '1px dashed var(--border-color)' }}>
                No site photos logged for this job yet. Upload photos from phone or computer to track progress records.
              </div>
            ) : (
              <div className="gallery-grid">
                {project.photos.map(p => (
                  <div key={p.id} className="gallery-card">
                    <div className="gallery-image-wrapper">
                      <img src={p.url} className="gallery-image" alt={p.title} />
                      <button 
                        className="btn btn-secondary btn-sm"
                        style={{
                          position: 'absolute',
                          top: '6px',
                          right: '6px',
                          padding: '2px',
                          backgroundColor: 'rgba(0,0,0,0.6)',
                          borderColor: 'transparent',
                          color: '#ff4d4d'
                        }}
                        onClick={() => deletePhoto(p.id)}
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>

                    <div className="gallery-info">
                      <div style={{ fontWeight: '600', color: 'var(--text-primary)', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                        {p.title}
                      </div>
                      <div style={{ color: 'var(--text-muted)', fontSize: '10px', marginTop: '2px' }}>
                        Uploaded {p.date}
                      </div>
                      <span className="gallery-tag">{p.phase}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
        {/* TAB 4: ARTIFACT REGISTRY & BUILDER */}
        {activeTab === 'artifacts' && (
          <div className="panel">
            {!showArtifactBuilder ? (
              // REGISTRY LIST VIEW
              <>
                <div className="panel-header" style={{ marginBottom: '24px' }}>
                  <h2 className="panel-title">Project Artifact Registry</h2>
                  <form onSubmit={handleCreateArtifact} style={{ display: 'flex', gap: '8px' }}>
                    <input 
                      type="text" 
                      className="input-field" 
                      style={{ padding: '6px 12px', fontSize: '13px', minWidth: '220px' }}
                      placeholder="New document title..."
                      value={newArtifactTitle}
                      onChange={(e) => setNewArtifactTitle(e.target.value)}
                      required
                    />
                    <button type="submit" className="btn btn-primary btn-sm"><Plus size={14} /> Create New</button>
                  </form>
                </div>

                {!(project.artifacts && project.artifacts.length > 0) ? (
                  <div style={{ padding: '48px', textAlign: 'center', color: 'var(--text-secondary)', border: '1px dashed var(--border-color)' }}>
                    No artifacts or documents created for this project yet.
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    {project.artifacts.map(art => (
                      <div key={art.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-primary)' }}>
                        <div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                            <FileBadge size={16} style={{ color: 'var(--accent)' }} />
                            <h3 style={{ fontSize: '15px', fontWeight: '600' }}>{art.title}</h3>
                          </div>
                          <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                            {art.sections.length} Sections • Last updated {new Date(art.updatedAt).toLocaleDateString()}
                          </div>
                        </div>
                        <div style={{ display: 'flex', gap: '8px' }}>
                          <button 
                            className="btn btn-secondary btn-sm"
                            onClick={() => {
                              setEditingArtifact(art);
                              setShowArtifactBuilder(true);
                            }}
                          >
                            Open Builder
                          </button>
                          <button 
                            className="btn btn-primary btn-sm"
                            onClick={() => handleDownloadArtifactPdf(art)}
                          >
                            <Download size={14} />
                          </button>
                          <button 
                            className="btn btn-secondary btn-sm"
                            style={{ borderColor: 'transparent', color: 'var(--danger)' }}
                            onClick={() => deleteArtifact(art.id)}
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </>
            ) : (
              // ARTIFACT BUILDER VIEW
              <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '1px solid var(--border-color)', paddingBottom: '16px' }}>
                  <div>
                    <button 
                      className="btn btn-secondary btn-sm" 
                      style={{ marginBottom: '12px', padding: '4px 8px', fontSize: '11px' }}
                      onClick={() => setShowArtifactBuilder(false)}
                    >
                      <ArrowLeft size={12} style={{ marginRight: '4px' }} /> Registry
                    </button>
                    <input 
                      type="text" 
                      className="input-field"
                      style={{ fontSize: '20px', fontWeight: '700', border: 'none', background: 'transparent', padding: 0, color: 'var(--text-primary)', width: '100%', outline: 'none' }}
                      value={editingArtifact?.title || ''}
                      onChange={(e) => {
                        const updated = { ...editingArtifact, title: e.target.value, updatedAt: new Date().toISOString() };
                        setEditingArtifact(updated);
                        updateArtifactInProject(updated);
                      }}
                      placeholder="Artifact Title"
                    />
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>
                      All changes auto-saved to project.
                    </div>
                  </div>
                  
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button 
                      className="btn btn-secondary btn-sm"
                      onClick={() => handleDownloadArtifactPdf(editingArtifact)}
                    >
                      <Download size={14} style={{ marginRight: '4px' }} /> PDF
                    </button>
                    <button 
                      className="btn btn-primary btn-sm"
                      onClick={() => handleEmailArtifact(editingArtifact)}
                      disabled={isEmailingArtifact}
                    >
                      <Mail size={14} style={{ marginRight: '4px' }} /> {isEmailingArtifact ? 'Sending...' : 'Email'}
                    </button>
                  </div>
                </div>

                {/* Sections List */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                  {editingArtifact?.sections.map((sec, idx) => (
                    <div key={sec.id} style={{ display: 'flex', gap: '12px' }}>
                      {/* Section Controls */}
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', paddingTop: '6px' }}>
                        <button 
                          className="btn btn-secondary btn-sm"
                          style={{ padding: '4px', height: '24px', width: '24px', display: 'flex', justifyContent: 'center', alignItems: 'center' }}
                          onClick={() => moveArtifactSection(idx, -1)}
                          disabled={idx === 0}
                        >
                          <ArrowUp size={12} />
                        </button>
                        <button 
                          className="btn btn-secondary btn-sm"
                          style={{ padding: '4px', height: '24px', width: '24px', display: 'flex', justifyContent: 'center', alignItems: 'center' }}
                          onClick={() => moveArtifactSection(idx, 1)}
                          disabled={idx === editingArtifact.sections.length - 1}
                        >
                          <ArrowDown size={12} />
                        </button>
                        <button 
                          className="btn btn-secondary btn-sm"
                          style={{ padding: '4px', height: '24px', width: '24px', display: 'flex', justifyContent: 'center', alignItems: 'center', borderColor: 'transparent', color: 'var(--danger)', marginTop: 'auto' }}
                          onClick={() => deleteArtifactSection(sec.id)}
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>

                      {/* Section Content Editor */}
                      <div style={{ flex: 1, backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border-color)', padding: '16px' }}>
                        <input
                          type="text"
                          className="input-field"
                          style={{ fontSize: '15px', fontWeight: '600', marginBottom: '12px', backgroundColor: 'var(--bg-primary)', padding: '8px 12px' }}
                          value={sec.heading}
                          onChange={(e) => updateArtifactSection(sec.id, 'heading', e.target.value)}
                          placeholder="Section Heading"
                        />
                        <textarea
                          className="input-field"
                          style={{ minHeight: '150px', fontSize: '13px', lineHeight: '1.5', fontFamily: 'var(--font-mono)', backgroundColor: 'var(--bg-primary)', padding: '12px', resize: 'vertical' }}
                          value={sec.content}
                          onChange={(e) => updateArtifactSection(sec.id, 'content', e.target.value)}
                          placeholder="Enter section content here..."
                        />
                      </div>
                    </div>
                  ))}

                  <button 
                    className="btn btn-secondary" 
                    style={{ borderStyle: 'dashed', padding: '16px', color: 'var(--text-secondary)' }}
                    onClick={handleAddArtifactSection}
                  >
                    <Plus size={16} style={{ marginRight: '6px' }} /> Add New Section
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

    </div>
  );
}
