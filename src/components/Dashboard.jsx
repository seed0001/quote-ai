import React, { useState } from 'react';
import { 
  TrendingUp, 
  DollarSign, 
  Clock, 
  Layers, 
  Plus, 
  ArrowRight,
  ArrowLeft,
  X,
  FileText
} from 'lucide-react';
import { calculateQuoteTotals, addProject } from '../utils/dataStore';

export default function Dashboard({ 
  projects, 
  clients, 
  settings, 
  onProjectsChange, 
  onViewDetails,
  onEditQuote
}) {
  const [showAddModal, setShowAddModal] = useState(false);
  const [newJobName, setNewJobName] = useState('');
  const [newClientId, setNewClientId] = useState('');
  const [newStatus, setNewStatus] = useState('lead');

  // Format currency helpers
  const formatCurrency = (val) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      maximumFractionDigits: 0
    }).format(val || 0);
  };

  // Financial calculations
  const stats = React.useMemo(() => {
    let quotedTotal = 0;
    let activeTotal = 0;
    let completedTotal = 0;
    
    let leadCount = 0;
    let quoteCount = 0;
    let activeCount = 0; // scheduled + progress
    let completedCount = 0;

    projects.forEach(p => {
      const totals = calculateQuoteTotals(p, settings);
      const val = totals.netTotal;

      if (p.status === 'lead') leadCount++;
      else if (p.status === 'quoting') {
        quoteCount++;
        quotedTotal += val;
      } else if (p.status === 'scheduled' || p.status === 'progress') {
        activeCount++;
        activeTotal += val;
      } else if (p.status === 'completed') {
        completedCount++;
        completedTotal += val;
      }
    });

    const totalCount = projects.length;
    const wonCount = activeCount + completedCount;
    const winRate = totalCount > 0 ? Math.round((wonCount / totalCount) * 100) : 0;

    return {
      quotedTotal,
      activeTotal,
      completedTotal,
      leadCount,
      quoteCount,
      activeCount,
      completedCount,
      winRate
    };
  }, [projects, settings]);

  // Kanban status stages
  const STAGES = [
    { id: 'lead', name: 'Leads / Inquiries', class: 'lead' },
    { id: 'quoting', name: 'Active Estimates', class: 'quoting' },
    { id: 'scheduled', name: 'Scheduled Jobs', class: 'scheduled' },
    { id: 'progress', name: 'In Progress', class: 'progress' },
    { id: 'completed', name: 'Completed & Invoiced', class: 'completed' }
  ];

  // Move project status
  const moveProjectStatus = (projectId, direction) => {
    const project = projects.find(p => p.id === projectId);
    if (!project) return;

    const currentIdx = STAGES.findIndex(s => s.id === project.status);
    let nextIdx = currentIdx + direction;
    if (nextIdx >= 0 && nextIdx < STAGES.length) {
      const nextStatus = STAGES[nextIdx].id;
      const updated = { ...project, status: nextStatus };
      
      // Auto-set start/end date defaults if moving to active/completed
      if (nextStatus === 'progress' && !project.startDate) {
        updated.startDate = new Date().toISOString().slice(0, 10);
      }
      if (nextStatus === 'completed' && !project.endDate) {
        updated.endDate = new Date().toISOString().slice(0, 10);
      }

      onProjectsChange(projects.map(p => p.id === projectId ? updated : p));
    }
  };

  // Create new project
  const handleCreateJob = (e) => {
    e.preventDefault();
    if (!newJobName || !newClientId) return;

    const newProj = addProject({
      name: newJobName,
      clientId: newClientId,
      status: newStatus,
      laborRate: settings.defaultLaborRate || 85.00,
      markupPercent: settings.defaultMarkupPercent || 20.0,
      taxPercent: settings.defaultTaxPercent || 8.25,
      rooms: [
        {
          name: 'General Scope',
          items: []
        }
      ],
      changeOrders: [],
      checklists: [],
      photos: [],
      startDate: newStatus === 'progress' ? new Date().toISOString().slice(0, 10) : '',
      endDate: ''
    });

    // Refresh state
    onProjectsChange(getProjects());

    // Reset form
    setNewJobName('');
    setNewClientId('');
    setNewStatus('lead');
    setShowAddModal(false);

    // Redirect to build quote if in quoting
    if (newStatus === 'quoting') {
      onEditQuote(newProj.id);
    } else {
      onViewDetails(newProj.id);
    }
  };

  return (
    <div>
      {/* Metrics Row */}
      <div className="metrics-grid">
        <div className="metric-card">
          <div className="metric-label">Quoted Estimate Pipeline</div>
          <div className="metric-value" style={{ color: 'var(--text-primary)' }}>
            {formatCurrency(stats.quotedTotal)}
          </div>
          <div className="metric-change" style={{ color: 'var(--text-secondary)' }}>
            <span>{stats.quoteCount} Estimates Pending</span>
          </div>
        </div>

        <div className="metric-card">
          <div className="metric-label">Active Work Value</div>
          <div className="metric-value" style={{ color: 'var(--accent)' }}>
            {formatCurrency(stats.activeTotal)}
          </div>
          <div className="metric-change" style={{ color: 'var(--text-secondary)' }}>
            <span>{stats.activeCount} Active Contracts</span>
          </div>
        </div>

        <div className="metric-card">
          <div className="metric-label">Invoiced / Completed</div>
          <div className="metric-value" style={{ color: 'var(--success)' }}>
            {formatCurrency(stats.completedTotal)}
          </div>
          <div className="metric-change" style={{ color: 'var(--text-secondary)' }}>
            <span>{stats.completedCount} Finalized Jobs</span>
          </div>
        </div>

        <div className="metric-card">
          <div className="metric-label">Estimate Conversion</div>
          <div className="metric-value" style={{ color: 'var(--info)' }}>
            {stats.winRate}%
          </div>
          <div className="metric-change" style={{ color: 'var(--text-secondary)' }}>
            <span>Jobs Won / Total Leads</span>
          </div>
        </div>
      </div>

      {/* Kanban Pipeline Section */}
      <div className="panel">
        <div className="panel-header">
          <h2 className="panel-title">Active Job Pipeline</h2>
          <button className="btn btn-primary btn-sm" onClick={() => setShowAddModal(true)}>
            <Plus size={14} /> New Lead / Job
          </button>
        </div>

        <div className="kanban-board">
          {STAGES.map((stage) => {
            const stageProjects = projects.filter(p => p.status === stage.id);
            return (
              <div key={stage.id} className="kanban-column">
                <div className="kanban-column-header">
                  <span>{stage.name}</span>
                  <span className="kanban-count">{stageProjects.length}</span>
                </div>
                
                <div className="kanban-cards-container">
                  {stageProjects.length === 0 ? (
                    <div style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: '11px', padding: '24px 0', border: '1px dashed var(--border-color)', margin: '4px 0' }}>
                      No projects
                    </div>
                  ) : (
                    stageProjects.map((p) => {
                      const client = clients.find(c => c.id === p.clientId);
                      const totals = calculateQuoteTotals(p, settings);
                      return (
                        <div key={p.id} className="kanban-card">
                          <div onClick={() => onViewDetails(p.id)}>
                            <div className="kanban-card-title">{p.name}</div>
                            <div className="kanban-card-client">{client?.name || 'Unknown Client'}</div>
                            
                            <div className="kanban-card-footer">
                              <span className="kanban-card-price">{formatCurrency(totals.netTotal)}</span>
                              <span className="kanban-card-date">
                                {p.startDate ? p.startDate.slice(5) : 'No date'}
                              </span>
                            </div>
                          </div>
                          
                          {/* Quick controls to shift status */}
                          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', borderTop: '1px solid var(--border-color)', marginTop: '10px', paddingTop: '8px' }}>
                            {stage.id !== 'lead' && (
                              <button 
                                className="btn btn-sm btn-secondary" 
                                style={{ padding: '2px 6px', fontSize: '10px' }}
                                onClick={() => moveProjectStatus(p.id, -1)}
                                title="Move status back"
                              >
                                <ArrowLeft size={10} />
                              </button>
                            )}
                            
                            <button
                              className="btn btn-primary btn-sm"
                              style={{ padding: '2px 8px', fontSize: '10px' }}
                              onClick={() => onEditQuote(p.id)}
                            >
                              <FileText size={10} style={{ marginRight: '2px' }} /> Estimate
                            </button>

                            {stage.id !== 'completed' && (
                              <button 
                                className="btn btn-sm btn-secondary" 
                                style={{ padding: '2px 6px', fontSize: '10px' }}
                                onClick={() => moveProjectStatus(p.id, 1)}
                                title="Move status forward"
                              >
                                <ArrowRight size={10} />
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* QUICK ADD MODAL */}
      {showAddModal && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <h3 className="panel-title">Add New Project / Lead</h3>
              <button onClick={() => setShowAddModal(false)} style={{ cursor: 'pointer', color: 'var(--text-secondary)' }}>
                <X size={18} />
              </button>
            </div>
            
            <form onSubmit={handleCreateJob}>
              <div className="modal-body">
                <div className="form-group">
                  <label className="form-label">Project Name</label>
                  <input 
                    type="text" 
                    className="input-field" 
                    placeholder="e.g. Master Bath Remodel or Kitchen Refacing"
                    value={newJobName}
                    onChange={(e) => setNewJobName(e.target.value)}
                    required
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Client</label>
                  <select 
                    className="input-field"
                    value={newClientId}
                    onChange={(e) => setNewClientId(e.target.value)}
                    required
                  >
                    <option value="">-- Select Client --</option>
                    {clients.map(c => (
                      <option key={c.id} value={c.id}>
                        {c.name} {c.company ? `(${c.company})` : ''}
                      </option>
                    ))}
                  </select>
                  <div style={{ marginTop: '8px', fontSize: '11px', color: 'var(--text-muted)' }}>
                    Add a client in the Client Directory first if they are not listed here.
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label">Initial Stage</label>
                  <select 
                    className="input-field"
                    value={newStatus}
                    onChange={(e) => setNewStatus(e.target.value)}
                  >
                    <option value="lead">Lead / Inquiry</option>
                    <option value="quoting">Active Estimating</option>
                    <option value="scheduled">Scheduled / Contracted</option>
                    <option value="progress">In Progress</option>
                  </select>
                </div>
              </div>

              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowAddModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  Create Project
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
