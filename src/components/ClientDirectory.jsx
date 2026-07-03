import React, { useState, useEffect } from 'react';
import { Search, Plus, Mail, Phone, MapPin, FileText, Briefcase, Trash2, Edit2, X, Link, Copy, RefreshCw, Send, MessageSquare } from 'lucide-react';
import { addClient, updateClient, deleteClient, calculateQuoteTotals, hydrateFromHost, getClients } from '../utils/dataStore';

// 144 bits of randomness — long enough that a portal link can't be guessed.
const generatePortalToken = () => {
  const bytes = new Uint8Array(18);
  crypto.getRandomValues(bytes);
  return 'pt-' + Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
};

export default function ClientDirectory({
  clients,
  projects,
  onClientsChange,
  onViewProject,
  onEditQuote,
  portalMessages = [],
  onPortalMessagesChange = () => {},
  settings = {}
}) {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedClientId, setSelectedClientId] = useState(clients[0]?.id || null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [replyDraft, setReplyDraft] = useState('');
  const [linkCopied, setLinkCopied] = useState(false);
  const [portalPasswordDraft, setPortalPasswordDraft] = useState('');
  const [portalPushStatus, setPortalPushStatus] = useState('');

  // When a cloud portal is configured, clients get email+password logins there.
  // Without one, the built-in tunnel portal with magic links is used instead.
  const cloudPortal = Boolean((settings.portalUrl || '').trim());

  // Form states
  const [name, setName] = useState('');
  const [company, setCompany] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [notes, setNotes] = useState('');

  // Filter clients based on search. Guard every field — a record missing a
  // field (e.g. an AI-created client without an email) must not crash the view.
  const term = searchTerm.toLowerCase();
  const filteredClients = clients.filter(c =>
    (c.name || '').toLowerCase().includes(term) ||
    (c.company || '').toLowerCase().includes(term) ||
    (c.email || '').toLowerCase().includes(term)
  );

  const selectedClient = clients.find(c => c.id === selectedClientId) || clients[0];

  // Get project history for the selected client
  const clientProjects = selectedClient
    ? projects.filter(p => p.clientId === selectedClient.id)
    : [];

  const clientThread = selectedClient
    ? portalMessages
        .filter(m => m.clientId === selectedClient.id)
        .sort((a, b) => String(a.timestamp).localeCompare(String(b.timestamp)))
    : [];

  const unreadCountFor = (clientId) =>
    portalMessages.filter(m => m.clientId === clientId && m.from === 'client' && !m.read).length;

  // Viewing a client's thread marks their messages as read.
  useEffect(() => {
    if (!selectedClient) return;
    const hasUnread = portalMessages.some(m => m.clientId === selectedClient.id && m.from === 'client' && !m.read);
    if (hasUnread) {
      onPortalMessagesChange(portalMessages.map(m =>
        (m.clientId === selectedClient.id && m.from === 'client' && !m.read) ? { ...m, read: true } : m
      ));
    }
  }, [selectedClient?.id, portalMessages]);

  // Persist portal fields on the client record and refresh the list.
  const savePortalFields = (fields) => {
    updateClient({ ...selectedClient, ...fields });
    onClientsChange(JSON.parse(localStorage.getItem('quote_ai_clients')));
  };

  const portalLink = cloudPortal
    ? (settings.portalUrl || '').trim()
    : (selectedClient?.portalToken ? `${window.location.origin}/portal?token=${selectedClient.portalToken}` : '');

  const setPortalPassword = (e) => {
    e.preventDefault();
    const password = portalPasswordDraft.trim();
    if (password.length < 8) {
      setPortalPushStatus('Password must be at least 8 characters.');
      return;
    }
    savePortalFields({ portalPasswordPending: password });
    setPortalPasswordDraft('');
    setPortalPushStatus('Password queued — applies on the next portal sync.');
  };

  const pushToPortal = async () => {
    setPortalPushStatus('Syncing with portal…');
    try {
      const res = await fetch('/api/portal-sync', { method: 'POST' });
      const data = await res.json();
      if (data.configured === false) {
        setPortalPushStatus('Set the Portal URL and Sync Secret in System Settings first.');
      } else if (!res.ok || data.ok === false) {
        setPortalPushStatus(`Sync failed: ${data.error || res.status}`);
      } else {
        setPortalPushStatus('Synced with portal.');
        // The sync clears bookkeeping fields (like a queued password) on the
        // host's copy — pull the fresh records so our cache matches.
        await hydrateFromHost();
        onClientsChange(getClients());
      }
    } catch (error) {
      setPortalPushStatus(`Sync failed: ${error.message}`);
    }
  };

  const copyPortalLink = async () => {
    try {
      await navigator.clipboard.writeText(portalLink);
      setLinkCopied(true);
      setTimeout(() => setLinkCopied(false), 2000);
    } catch {
      window.prompt('Copy the portal link:', portalLink);
    }
  };

  const sendReply = (e) => {
    e.preventDefault();
    const text = replyDraft.trim();
    if (!text || !selectedClient) return;
    onPortalMessagesChange([
      ...portalMessages,
      {
        id: `pm-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        clientId: selectedClient.id,
        from: 'owner',
        text,
        timestamp: new Date().toISOString(),
        read: true,
      },
    ]);
    setReplyDraft('');
  };

  const handleOpenAddModal = () => {
    setName('');
    setCompany('');
    setEmail('');
    setPhone('');
    setAddress('');
    setNotes('');
    setIsEditing(false);
    setShowAddModal(true);
  };

  const handleOpenEditModal = (client) => {
    setName(client.name);
    setCompany(client.company || '');
    setEmail(client.email);
    setPhone(client.phone);
    setAddress(client.address || '');
    setNotes(client.notes || '');
    setIsEditing(true);
    setShowAddModal(true);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!name) return;

    const clientData = { name, company, email, phone, address, notes };

    if (isEditing && selectedClient) {
      const updated = { ...selectedClient, ...clientData };
      updateClient(updated);
    } else {
      const added = addClient(clientData);
      setSelectedClientId(added.id);
    }

    // Refresh state
    onClientsChange(JSON.parse(localStorage.getItem('quote_ai_clients')));
    setShowAddModal(false);
  };

  const handleDelete = (id) => {
    if (window.confirm('Are you sure you want to delete this client? All projects will remain, but will reference a missing client.')) {
      deleteClient(id);
      const remaining = JSON.parse(localStorage.getItem('quote_ai_clients'));
      onClientsChange(remaining);
      setSelectedClientId(remaining[0]?.id || null);
    }
  };

  return (
    <div className="grid-2" style={{ height: '100%', alignItems: 'stretch' }}>
      {/* LEFT COLUMN: CLIENT LIST & SEARCH */}
      <div className="panel" style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 130px)', marginBottom: 0 }}>
        <div className="panel-header" style={{ marginBottom: '16px' }}>
          <h2 className="panel-title">Clients Directory</h2>
          <button className="btn btn-primary btn-sm" onClick={handleOpenAddModal}>
            <Plus size={14} /> Add Client
          </button>
        </div>

        {/* Search Field */}
        <div className="form-group" style={{ marginBottom: '16px', position: 'relative' }}>
          <div className="input-group">
            <span className="input-addon"><Search size={16} /></span>
            <input 
              type="text" 
              className="input-field" 
              placeholder="Search clients..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>

        {/* Client List */}
        <div style={{ flex: 1, overflowY: 'auto', border: '1px solid var(--border-color)' }}>
          {filteredClients.length === 0 ? (
            <div style={{ padding: '24px', textAlign: 'center', color: 'var(--text-secondary)', fontSize: '13px' }}>
              No clients found.
            </div>
          ) : (
            filteredClients.map(c => (
              <div 
                key={c.id}
                onClick={() => setSelectedClientId(c.id)}
                style={{
                  padding: '16px',
                  borderBottom: '1px solid var(--border-color)',
                  cursor: 'pointer',
                  backgroundColor: selectedClientId === c.id ? 'var(--bg-tertiary)' : 'transparent',
                  borderLeft: selectedClientId === c.id ? '3px solid var(--accent)' : '3px solid transparent',
                  transition: 'all 0.15s ease',
                }}
              >
                <div style={{ fontWeight: '600', fontSize: '14px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  {c.name}
                  {unreadCountFor(c.id) > 0 && (
                    <span style={{ backgroundColor: 'var(--accent)', color: '#fff', fontSize: '10px', fontWeight: 700, padding: '1px 6px', borderRadius: '10px' }}>
                      {unreadCountFor(c.id)}
                    </span>
                  )}
                </div>
                {c.company && (
                  <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '2px' }}>
                    {c.company}
                  </div>
                )}
                <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '6px', fontFamily: 'var(--font-mono)' }}>
                  {c.phone}
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* RIGHT COLUMN: SELECTED CLIENT DETAIL & HISTORY */}
      <div className="panel" style={{ height: 'calc(100vh - 130px)', overflowY: 'auto', marginBottom: 0 }}>
        {selectedClient ? (
          <div>
            <div className="panel-header">
              <h2 className="panel-title">Client Details</h2>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button 
                  className="btn btn-secondary btn-sm"
                  onClick={() => handleOpenEditModal(selectedClient)}
                >
                  <Edit2 size={12} /> Edit
                </button>
                <button 
                  className="btn btn-danger btn-sm"
                  onClick={() => handleDelete(selectedClient.id)}
                >
                  <Trash2 size={12} /> Delete
                </button>
              </div>
            </div>

            {/* General Contact Info Card */}
            <div style={{ border: '1px solid var(--border-color)', padding: '20px', backgroundColor: 'var(--bg-primary)', marginBottom: '24px' }}>
              <h3 style={{ fontSize: '18px', fontWeight: '700', marginBottom: '4px' }}>{selectedClient.name}</h3>
              {selectedClient.company && (
                <div style={{ fontSize: '13px', fontWeight: '500', color: 'var(--accent)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '16px' }}>
                  {selectedClient.company}
                </div>
              )}

              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '16px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '13px' }}>
                  <Mail size={14} style={{ color: 'var(--text-secondary)' }} />
                  <a href={`mailto:${selectedClient.email}`} style={{ color: 'var(--text-primary)', textDecoration: 'none' }}>
                    {selectedClient.email}
                  </a>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '13px' }}>
                  <Phone size={14} style={{ color: 'var(--text-secondary)' }} />
                  <span>{selectedClient.phone}</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', fontSize: '13px' }}>
                  <MapPin size={14} style={{ color: 'var(--text-secondary)', marginTop: '2px' }} />
                  <span>{selectedClient.address || 'No address provided'}</span>
                </div>
              </div>

              {selectedClient.notes && (
                <div style={{ marginTop: '20px', paddingTop: '16px', borderTop: '1px solid var(--border-color)', fontSize: '13px', color: 'var(--text-secondary)' }}>
                  <div style={{ fontWeight: '600', textTransform: 'uppercase', fontSize: '11px', letterSpacing: '0.5px', marginBottom: '6px', color: 'var(--text-muted)' }}>
                    Contractor Notes
                  </div>
                  {selectedClient.notes}
                </div>
              )}
            </div>

            {/* CLIENT PORTAL ACCESS */}
            <div style={{ border: '1px solid var(--border-color)', padding: '20px', backgroundColor: 'var(--bg-primary)', marginBottom: '24px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
                <Link size={14} style={{ color: 'var(--accent)' }} />
                <span style={{ fontWeight: '600', textTransform: 'uppercase', fontSize: '11px', letterSpacing: '0.5px', color: 'var(--text-muted)' }}>
                  Client Portal
                </span>
                {(selectedClient.portalToken || selectedClient.portalEnabled !== undefined) && (
                  <span className={`badge badge-${selectedClient.portalEnabled ? 'progress' : 'lead'}`} style={{ fontSize: '9px' }}>
                    {selectedClient.portalEnabled ? 'active' : 'disabled'}
                  </span>
                )}
              </div>

              {cloudPortal ? (
                !selectedClient.portalEnabled ? (
                  <div>
                    <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '12px' }}>
                      Give this client a login on your cloud portal where they can track their
                      projects, message you, chat with the AI, and pay milestones online.
                    </p>
                    {!selectedClient.email && (
                      <p style={{ fontSize: '12px', color: 'var(--danger, #e53e3e)', marginBottom: '12px' }}>
                        Add an email address to this client first — it becomes their login.
                      </p>
                    )}
                    <button
                      className="btn btn-primary btn-sm"
                      disabled={!selectedClient.email}
                      onClick={() => savePortalFields({ portalEnabled: true })}
                    >
                      <Link size={12} /> Enable Portal Access
                    </button>
                  </div>
                ) : (
                  <div>
                    <div style={{ fontSize: '13px', marginBottom: '10px' }}>
                      Login email: <strong style={{ fontFamily: 'var(--font-mono)', fontSize: '12px' }}>{selectedClient.email}</strong>
                    </div>
                    <div style={{ display: 'flex', gap: '8px', marginBottom: '10px' }}>
                      <input
                        type="text"
                        className="input-field"
                        readOnly
                        value={portalLink}
                        style={{ flex: 1, fontFamily: 'var(--font-mono)', fontSize: '11px' }}
                        onFocus={(e) => e.target.select()}
                      />
                      <button className="btn btn-secondary btn-sm" onClick={copyPortalLink}>
                        <Copy size={12} /> {linkCopied ? 'Copied!' : 'Copy'}
                      </button>
                    </div>

                    <form onSubmit={setPortalPassword} style={{ display: 'flex', gap: '8px', marginBottom: '10px' }}>
                      <input
                        type="text"
                        className="input-field"
                        placeholder={selectedClient.portalPasswordPending
                          ? 'Password queued for next sync'
                          : selectedClient.portalPasswordSetAt
                            ? 'Set a new password (optional)'
                            : 'Set their password (min 8 characters)'}
                        value={portalPasswordDraft}
                        onChange={(e) => setPortalPasswordDraft(e.target.value)}
                        style={{ flex: 1 }}
                      />
                      <button type="submit" className="btn btn-primary btn-sm" disabled={!portalPasswordDraft.trim()}>
                        Set Password
                      </button>
                    </form>

                    {!selectedClient.portalPasswordPending && !selectedClient.portalPasswordSetAt && (
                      <div style={{ fontSize: '11px', color: 'var(--danger, #e53e3e)', marginBottom: '10px' }}>
                        No password yet — the client can't sign in until you set one.
                      </div>
                    )}
                    {selectedClient.portalPasswordSetAt && !selectedClient.portalPasswordPending && (
                      <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '10px' }}>
                        Password last set {new Date(selectedClient.portalPasswordSetAt).toLocaleString(undefined, { dateStyle: 'short', timeStyle: 'short' })}.
                      </div>
                    )}

                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
                      <button className="btn btn-secondary btn-sm" onClick={pushToPortal}>
                        <RefreshCw size={12} /> Sync Portal Now
                      </button>
                      <button className="btn btn-secondary btn-sm" onClick={() => savePortalFields({ portalEnabled: false })}>
                        Disable Access
                      </button>
                      {portalPushStatus && (
                        <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{portalPushStatus}</span>
                      )}
                    </div>
                  </div>
                )
              ) : !selectedClient.portalToken ? (
                <div>
                  <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '12px' }}>
                    Give this client a private link where they can track their projects, message you,
                    chat with the AI, and pay milestones online.
                  </p>
                  <button
                    className="btn btn-primary btn-sm"
                    onClick={() => savePortalFields({ portalToken: generatePortalToken(), portalEnabled: true })}
                  >
                    <Link size={12} /> Enable Portal Access
                  </button>
                </div>
              ) : (
                <div>
                  <div style={{ display: 'flex', gap: '8px', marginBottom: '10px' }}>
                    <input
                      type="text"
                      className="input-field"
                      readOnly
                      value={portalLink}
                      style={{ flex: 1, fontFamily: 'var(--font-mono)', fontSize: '11px' }}
                      onFocus={(e) => e.target.select()}
                    />
                    <button className="btn btn-secondary btn-sm" onClick={copyPortalLink}>
                      <Copy size={12} /> {linkCopied ? 'Copied!' : 'Copy'}
                    </button>
                  </div>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '12px' }}>
                    Share this link only with {selectedClient.name}. Copy it while the app is open on your
                    public (tunnel) address so the link works outside your network.
                  </div>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    {selectedClient.portalEnabled === false ? (
                      <button className="btn btn-primary btn-sm" onClick={() => savePortalFields({ portalEnabled: true })}>
                        Re-enable Access
                      </button>
                    ) : (
                      <button className="btn btn-secondary btn-sm" onClick={() => savePortalFields({ portalEnabled: false })}>
                        Disable Access
                      </button>
                    )}
                    <button
                      className="btn btn-secondary btn-sm"
                      onClick={() => {
                        if (window.confirm('Generate a new link? The old link will stop working immediately.')) {
                          savePortalFields({ portalToken: generatePortalToken(), portalEnabled: true });
                        }
                      }}
                    >
                      <RefreshCw size={12} /> Regenerate Link
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* PORTAL MESSAGES THREAD */}
            {(selectedClient.portalToken || selectedClient.portalEnabled || clientThread.length > 0) && (
              <div style={{ border: '1px solid var(--border-color)', padding: '20px', backgroundColor: 'var(--bg-primary)', marginBottom: '24px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
                  <MessageSquare size={14} style={{ color: 'var(--accent)' }} />
                  <span style={{ fontWeight: '600', textTransform: 'uppercase', fontSize: '11px', letterSpacing: '0.5px', color: 'var(--text-muted)' }}>
                    Portal Messages ({clientThread.length})
                  </span>
                </div>

                {clientThread.length === 0 ? (
                  <div style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '12px' }}>
                    No messages yet. Anything the client sends from their portal shows up here.
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '260px', overflowY: 'auto', marginBottom: '12px' }}>
                    {clientThread.map(m => (
                      <div
                        key={m.id}
                        style={{
                          alignSelf: m.from === 'owner' ? 'flex-end' : 'flex-start',
                          maxWidth: '80%',
                          padding: '8px 12px',
                          fontSize: '13px',
                          whiteSpace: 'pre-wrap',
                          backgroundColor: m.from === 'owner' ? 'var(--accent)' : 'var(--bg-secondary)',
                          color: m.from === 'owner' ? '#fff' : 'var(--text-primary)',
                          border: m.from === 'owner' ? 'none' : '1px solid var(--border-color)',
                        }}
                      >
                        <div style={{ fontSize: '10px', opacity: 0.7, marginBottom: '2px' }}>
                          {m.from === 'owner' ? 'You' : selectedClient.name} · {new Date(m.timestamp).toLocaleString(undefined, { dateStyle: 'short', timeStyle: 'short' })}
                        </div>
                        {m.text}
                      </div>
                    ))}
                  </div>
                )}

                <form onSubmit={sendReply} style={{ display: 'flex', gap: '8px' }}>
                  <input
                    type="text"
                    className="input-field"
                    placeholder={`Reply to ${selectedClient.name}… (shown in their portal)`}
                    value={replyDraft}
                    onChange={(e) => setReplyDraft(e.target.value)}
                    style={{ flex: 1 }}
                  />
                  <button type="submit" className="btn btn-primary btn-sm" disabled={!replyDraft.trim()}>
                    <Send size={12} /> Reply
                  </button>
                </form>
              </div>
            )}

            {/* Project History List */}
            <div>
              <div className="panel-header" style={{ marginBottom: '12px' }}>
                <h3 className="panel-title" style={{ fontSize: '12px' }}>Project History ({clientProjects.length})</h3>
              </div>

              {clientProjects.length === 0 ? (
                <div style={{ border: '1px dashed var(--border-color)', padding: '24px', textAlign: 'center', color: 'var(--text-secondary)', fontSize: '13px' }}>
                  No active or past projects for this client.
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {clientProjects.map(p => {
                    const totals = calculateQuoteTotals(p, JSON.parse(localStorage.getItem('quote_ai_settings') || '{}'));
                    return (
                      <div 
                        key={p.id} 
                        style={{
                          border: '1px solid var(--border-color)',
                          padding: '16px',
                          backgroundColor: 'var(--bg-primary)',
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                        }}
                      >
                        <div>
                          <div style={{ fontWeight: '600', fontSize: '14px' }}>{p.name}</div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '6px' }}>
                            <span className={`badge badge-${p.status}`} style={{ fontSize: '9px' }}>
                              {p.status}
                            </span>
                            <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                              Start: {p.startDate || 'Not scheduled'}
                            </span>
                          </div>
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                          <div style={{ textAlign: 'right' }}>
                            <div style={{ fontFamily: 'var(--font-mono)', fontWeight: '600', color: 'var(--accent)' }}>
                              {new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(totals.netTotal)}
                            </div>
                            <div style={{ fontSize: '10px', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                              EST. VALUE
                            </div>
                          </div>

                          <div style={{ display: 'flex', gap: '4px' }}>
                            <button 
                              className="btn btn-secondary btn-sm"
                              style={{ padding: '4px 8px' }}
                              onClick={() => onViewProject(p.id)}
                              title="Open Project Workspace"
                            >
                              <Briefcase size={12} />
                            </button>
                            <button 
                              className="btn btn-primary btn-sm"
                              style={{ padding: '4px 8px' }}
                              onClick={() => onEditQuote(p.id)}
                              title="Edit Quote"
                            >
                              <FileText size={12} />
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        ) : (
          <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-secondary)' }}>
            Select a client or add a new one to view details
          </div>
        )}
      </div>

      {/* ADD / EDIT CLIENT MODAL */}
      {showAddModal && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <h3 className="panel-title">{isEditing ? 'Edit Client Record' : 'Add New Client'}</h3>
              <button onClick={() => setShowAddModal(false)} style={{ cursor: 'pointer', color: 'var(--text-secondary)' }}>
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSubmit}>
              <div className="modal-body">
                <div className="form-group">
                  <label className="form-label">Full Name</label>
                  <input 
                    type="text" 
                    className="input-field" 
                    placeholder="e.g. Sarah Jenkins"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Company Name (Optional)</label>
                  <input 
                    type="text" 
                    className="input-field" 
                    placeholder="e.g. Jenkins Holdings"
                    value={company}
                    onChange={(e) => setCompany(e.target.value)}
                  />
                </div>

                <div className="grid-2">
                  <div className="form-group">
                    <label className="form-label">Email Address</label>
                    <input 
                      type="email" 
                      className="input-field" 
                      placeholder="e.g. sarah@example.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Phone Number</label>
                    <input 
                      type="text" 
                      className="input-field" 
                      placeholder="e.g. (512) 555-0199"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      required
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label">Site / Billing Address</label>
                  <input 
                    type="text" 
                    className="input-field" 
                    placeholder="e.g. 100 Main St, Austin, TX 78701"
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Contractor Notes</label>
                  <textarea 
                    className="input-field" 
                    placeholder="General client preferences, project background, budget limits..."
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                  />
                </div>
              </div>

              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowAddModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  {isEditing ? 'Save Changes' : 'Create Record'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
