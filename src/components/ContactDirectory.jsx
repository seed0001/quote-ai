import React, { useState } from 'react';
import { Search, Plus, Phone, Mail, MapPin, Globe, BookUser, Edit2, Trash2, MessageSquare, CheckSquare, Square } from 'lucide-react';
import { addContact, updateContact, deleteContact, sendSMS } from '../utils/dataStore';
import { playClick, playSuccess, playWarning } from '../utils/soundEngine';

export default function ContactDirectory({ contacts, onContactsChange }) {
  const [searchTerm, setSearchTerm] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editingContactId, setEditingContactId] = useState(null);

  // Form states
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [address, setAddress] = useState('');
  const [website, setWebsite] = useState('');
  const [carrier, setCarrier] = useState('');
  const [notes, setNotes] = useState('');

  // Selection & SMS Broadcast States
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [showSMSModal, setShowSMSModal] = useState(false);
  const [smsRecipients, setSmsRecipients] = useState([]);
  const [smsMessage, setSmsMessage] = useState('');

  const filteredContacts = (contacts || []).filter(c => 
    c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (c.email && c.email.toLowerCase().includes(searchTerm.toLowerCase())) ||
    (c.phone && c.phone.includes(searchTerm)) ||
    (c.notes && c.notes.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const resetForm = () => {
    setName('');
    setPhone('');
    setEmail('');
    setAddress('');
    setWebsite('');
    setCarrier('');
    setNotes('');
    setEditingContactId(null);
    setShowForm(false);
    playClick();
  };

  const handleEdit = (contact) => {
    setName(contact.name || '');
    setPhone(contact.phone || '');
    setEmail(contact.email || '');
    setAddress(contact.address || '');
    setWebsite(contact.website || '');
    setCarrier(contact.carrier || '');
    setNotes(contact.notes || '');
    setEditingContactId(contact.id);
    setShowForm(true);
    playClick();
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!name.trim()) return;

    if (editingContactId) {
      updateContact({
        id: editingContactId,
        name,
        phone,
        email,
        address,
        website,
        carrier,
        notes
      });
    } else {
      addContact({
        name,
        phone,
        email,
        address,
        website,
        carrier,
        notes
      });
    }
    onContactsChange();
    resetForm();
    playSuccess();
  };

  const handleDelete = (id) => {
    playWarning();
    if (window.confirm('Are you sure you want to delete this contact?')) {
      deleteContact(id);
      setSelectedIds(prev => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
      onContactsChange();
      playSuccess();
    } else {
      playClick();
    }
  };

  // SMS Broadcast Actions
  const toggleSelect = (id) => {
    playClick();
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const toggleSelectAll = () => {
    playClick();
    setSelectedIds(prev => {
      const visibleIds = filteredContacts.map(c => c.id);
      const allSelected = visibleIds.every(id => prev.has(id));
      if (allSelected) {
        const next = new Set(prev);
        visibleIds.forEach(id => next.delete(id));
        return next;
      } else {
        const next = new Set(prev);
        visibleIds.forEach(id => next.add(id));
        return next;
      }
    });
  };

  const openSMSForSingle = (contact) => {
    setSmsRecipients([contact]);
    setSmsMessage('');
    setShowSMSModal(true);
    playClick();
  };

  const openSMSForSelected = () => {
    const recipients = contacts.filter(c => selectedIds.has(c.id));
    if (recipients.length === 0) return;
    setSmsRecipients(recipients);
    setSmsMessage('');
    setShowSMSModal(true);
    playClick();
  };

  const handleSendSMS = (e) => {
    e.preventDefault();
    if (!smsMessage.trim() || smsRecipients.length === 0) return;

    // Check for missing phone or carrier
    const missingInfo = smsRecipients.filter(r => !r.phone || !r.carrier);
    if (missingInfo.length > 0) {
      playWarning();
      alert(`Cannot send. The following contacts are missing a phone number or mobile carrier setting:\n${missingInfo.map(r => `• ${r.name}`).join('\n')}`);
      return;
    }

    sendSMS({
      to: smsRecipients.map(r => r.id),
      message: smsMessage.trim()
    });

    playSuccess();
    setShowSMSModal(false);
    setSmsMessage('');
    setSelectedIds(new Set()); // Clear selection on success
    alert(`SMS sent successfully to ${smsRecipients.length} recipient(s).`);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', height: '100%' }}>
      
      {/* Header and Search */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h2 style={{ fontSize: '24px', fontWeight: 'bold', color: 'var(--text-primary)', marginBottom: '8px' }}>
            Contacts Directory
          </h2>
          <p style={{ color: 'var(--text-secondary)' }}>
            Manage your personal address book: friends, family, and vendors.
          </p>
        </div>
        {!showForm && (
          <button className="btn btn-primary" onClick={() => { setShowForm(true); playClick(); }}>
            <Plus size={16} /> Add Contact
          </button>
        )}
      </div>

      {/* Broadcast Banner */}
      {selectedIds.size > 0 && !showForm && (
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          backgroundColor: 'var(--accent-dim)',
          padding: '12px 18px',
          borderRadius: '8px',
          border: '1px solid var(--border-color-active)',
          animation: 'pulse 2s infinite'
        }}>
          <span style={{ fontSize: '13px', fontWeight: '600', color: 'var(--text-primary)' }}>
            {selectedIds.size} Contact{selectedIds.size > 1 ? 's' : ''} Selected
          </span>
          <div style={{ display: 'flex', gap: '10px' }}>
            <button 
              className="btn btn-secondary btn-sm" 
              onClick={() => { setSelectedIds(new Set()); playClick(); }}
            >
              Clear Selection
            </button>
            <button className="btn btn-primary btn-sm" onClick={openSMSForSelected}>
              <MessageSquare size={14} style={{ marginRight: '6px' }} /> Broadcast SMS
            </button>
          </div>
        </div>
      )}

      {!showForm && (
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
          <div style={{ position: 'relative', width: '300px' }}>
            <Search size={16} style={{ position: 'absolute', left: '12px', top: '10px', color: 'var(--text-muted)' }} />
            <input 
              type="text" 
              className="input-field"
              placeholder="Search contacts..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              style={{ paddingLeft: '36px' }}
            />
          </div>
          {filteredContacts.length > 0 && (
            <button 
              className="btn btn-secondary btn-sm"
              onClick={toggleSelectAll}
              style={{ height: '38px' }}
            >
              {filteredContacts.every(c => selectedIds.has(c.id)) ? 'Deselect All' : 'Select All'}
            </button>
          )}
        </div>
      )}

      {/* Editor Form */}
      {showForm && (
        <div className="panel slide-in">
          <h3 className="panel-title">{editingContactId ? 'Edit Contact' : 'New Contact'}</h3>
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div className="form-group">
              <label className="form-label">Full Name *</label>
              <input 
                type="text" 
                className="input-field" 
                value={name} 
                onChange={(e) => setName(e.target.value)} 
                required 
                placeholder="Jane Doe"
              />
            </div>

            <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
              <div className="form-group" style={{ flex: 1, minWidth: '200px' }}>
                <label className="form-label">Phone Number</label>
                <div style={{ position: 'relative' }}>
                  <Phone size={14} style={{ position: 'absolute', left: '12px', top: '11px', color: 'var(--text-muted)' }} />
                  <input 
                    type="tel" 
                    className="input-field" 
                    value={phone} 
                    onChange={(e) => setPhone(e.target.value)} 
                    style={{ paddingLeft: '34px' }}
                    placeholder="(555) 123-4567"
                  />
                </div>
              </div>

              <div className="form-group" style={{ flex: 1, minWidth: '200px' }}>
                <label className="form-label">Mobile Carrier (Needed for SMS)</label>
                <select 
                  className="input-field" 
                  value={carrier} 
                  onChange={(e) => setCarrier(e.target.value)}
                >
                  <option value="">Select a carrier...</option>
                  <option value="AT&T">AT&T</option>
                  <option value="Verizon">Verizon</option>
                  <option value="T-Mobile">T-Mobile</option>
                  <option value="Sprint">Sprint</option>
                  <option value="Boost Mobile">Boost Mobile</option>
                  <option value="Cricket">Cricket</option>
                  <option value="MetroPCS">MetroPCS</option>
                  <option value="Virgin Mobile">Virgin Mobile</option>
                </select>
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Email Address</label>
              <div style={{ position: 'relative' }}>
                <Mail size={14} style={{ position: 'absolute', left: '12px', top: '11px', color: 'var(--text-muted)' }} />
                <input 
                  type="email" 
                  className="input-field" 
                  value={email} 
                  onChange={(e) => setEmail(e.target.value)} 
                  style={{ paddingLeft: '34px' }}
                  placeholder="jane@example.com"
                />
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Physical Address</label>
              <div style={{ position: 'relative' }}>
                <MapPin size={14} style={{ position: 'absolute', left: '12px', top: '11px', color: 'var(--text-muted)' }} />
                <input 
                  type="text" 
                  className="input-field" 
                  value={address} 
                  onChange={(e) => setAddress(e.target.value)} 
                  style={{ paddingLeft: '34px' }}
                  placeholder="123 Main St, City, State"
                />
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Website</label>
              <div style={{ position: 'relative' }}>
                <Globe size={14} style={{ position: 'absolute', left: '12px', top: '11px', color: 'var(--text-muted)' }} />
                <input 
                  type="url" 
                  className="input-field" 
                  value={website} 
                  onChange={(e) => setWebsite(e.target.value)} 
                  style={{ paddingLeft: '34px' }}
                  placeholder="https://example.com"
                />
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Notes</label>
              <textarea 
                className="input-field" 
                value={notes} 
                onChange={(e) => setNotes(e.target.value)} 
                rows={3}
                placeholder="Relationship, reminders, or special notes..."
              />
            </div>

            <div style={{ display: 'flex', gap: '12px', marginTop: '8px' }}>
              <button type="submit" className="btn btn-primary">
                {editingContactId ? 'Save Changes' : 'Add Contact'}
              </button>
              <button type="button" className="btn btn-secondary" onClick={resetForm}>
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Grid of Contacts */}
      {!showForm && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: '16px' }}>
          {filteredContacts.length === 0 ? (
            <div style={{ gridColumn: '1 / -1', padding: '48px', textAlign: 'center', backgroundColor: 'var(--bg-secondary)', borderRadius: '8px', border: '1px dashed var(--border-color)', color: 'var(--text-secondary)' }}>
              <BookUser size={32} style={{ margin: '0 auto 16px auto', opacity: 0.5 }} />
              <p>No contacts found. Your address book is empty.</p>
            </div>
          ) : (
            filteredContacts.map(contact => (
              <div key={contact.id} className="panel" style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '12px', border: selectedIds.has(contact.id) ? '1px solid var(--border-color-active)' : '1px solid var(--border-color)', position: 'relative' }}>
                
                {/* Checkbox and Name Header */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <button 
                      onClick={() => toggleSelect(contact.id)} 
                      style={{
                        background: 'none',
                        border: 'none',
                        padding: 0,
                        cursor: 'pointer',
                        color: selectedIds.has(contact.id) ? 'var(--accent)' : 'var(--text-muted)',
                        display: 'flex',
                        alignItems: 'center'
                      }}
                    >
                      {selectedIds.has(contact.id) ? <CheckSquare size={18} /> : <Square size={18} />}
                    </button>
                    <h3 style={{ fontSize: '18px', fontWeight: 'bold', color: 'var(--text-primary)' }}>
                      {contact.name}
                    </h3>
                  </div>
                  <div style={{ display: 'flex', gap: '4px' }}>
                    <button 
                      className="btn btn-secondary btn-sm" 
                      style={{ padding: '6px', borderColor: 'transparent' }}
                      onClick={() => handleEdit(contact)}
                      title="Edit Contact"
                    >
                      <Edit2 size={14} />
                    </button>
                    <button 
                      className="btn btn-secondary btn-sm" 
                      style={{ padding: '6px', borderColor: 'transparent', color: 'var(--danger)' }}
                      onClick={() => handleDelete(contact.id)}
                      title="Delete Contact"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>

                {/* Info Fields */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '13px', color: 'var(--text-secondary)' }}>
                  {contact.phone && (
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <Phone size={14} style={{ color: 'var(--text-muted)' }} />
                        <a href={`tel:${contact.phone}`} style={{ color: 'var(--accent)', textDecoration: 'none' }}>{contact.phone}</a>
                        {contact.carrier && (
                          <span style={{ fontSize: '10px', backgroundColor: 'var(--bg-secondary)', padding: '2px 6px', borderRadius: '4px', border: '1px solid var(--border-color)', color: 'var(--text-secondary)', fontWeight: '500' }}>
                            {contact.carrier}
                          </span>
                        )}
                      </div>
                      {contact.phone && (
                        <button
                          className="btn btn-secondary btn-sm"
                          style={{ padding: '4px 8px', display: 'flex', alignItems: 'center', gap: '4px', fontSize: '11px', height: '26px' }}
                          onClick={() => openSMSForSingle(contact)}
                          title="Send Text Message"
                        >
                          <MessageSquare size={12} /> SMS
                        </button>
                      )}
                    </div>
                  )}
                  {contact.email && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <Mail size={14} style={{ color: 'var(--text-muted)' }} />
                      <a href={`mailto:${contact.email}`} style={{ color: 'var(--accent)', textDecoration: 'none' }}>{contact.email}</a>
                    </div>
                  )}
                  {contact.address && (
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
                      <MapPin size={14} style={{ color: 'var(--text-muted)', marginTop: '2px' }} />
                      <span>{contact.address}</span>
                    </div>
                  )}
                  {contact.website && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <Globe size={14} style={{ color: 'var(--text-muted)' }} />
                      <a href={contact.website.startsWith('http') ? contact.website : `https://${contact.website}`} target="_blank" rel="noreferrer" style={{ color: 'var(--accent)', textDecoration: 'none' }}>
                        {contact.website}
                      </a>
                    </div>
                  )}
                </div>

                {contact.notes && (
                  <div style={{ marginTop: 'auto', paddingTop: '12px', borderTop: '1px solid var(--border-color)', fontSize: '12px', color: 'var(--text-muted)', whiteSpace: 'pre-wrap' }}>
                    {contact.notes}
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      )}

      {/* SMS Modal Dialog */}
      {showSMSModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.65)',
          backdropFilter: 'blur(4px)',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          zIndex: 1000,
          padding: '16px'
        }}>
          <div className="panel slide-in" style={{
            width: '100%',
            maxWidth: '500px',
            backgroundColor: 'var(--bg-secondary)',
            border: '1px solid var(--border-color)',
            boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
            padding: '24px',
            display: 'flex',
            flexDirection: 'column',
            gap: '16px'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-color)', paddingBottom: '12px' }}>
              <h3 style={{ fontSize: '18px', fontWeight: 'bold', color: 'var(--text-primary)' }}>
                Send SMS Text Message
              </h3>
              <button 
                className="btn btn-secondary btn-sm" 
                onClick={() => { setShowSMSModal(false); playClick(); }}
                style={{ padding: '4px 8px' }}
              >
                ✕
              </button>
            </div>

            <div style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
              <strong>Recipients:</strong>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '6px', maxHeight: '80px', overflowY: 'auto', padding: '6px', backgroundColor: 'var(--bg-primary)', borderRadius: '4px', border: '1px solid var(--border-color)' }}>
                {smsRecipients.map(r => (
                  <span key={r.id} style={{
                    fontSize: '11px',
                    backgroundColor: 'var(--accent-dim)',
                    color: 'var(--text-primary)',
                    padding: '2px 8px',
                    borderRadius: '12px',
                    border: '1px solid var(--border-color-active)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px'
                  }}>
                    {r.name} {r.carrier ? `(${r.carrier})` : <span style={{ color: 'var(--danger)' }}>(No Carrier)</span>}
                  </span>
                ))}
              </div>
            </div>

            <form onSubmit={handleSendSMS} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div className="form-group">
                <label className="form-label">Message Text</label>
                <textarea
                  className="input-field"
                  value={smsMessage}
                  onChange={(e) => setSmsMessage(e.target.value)}
                  placeholder="Type your message here..."
                  rows={4}
                  required
                  maxLength={500}
                  style={{ resize: 'vertical' }}
                />
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>
                  <span>Gateway: Carrier Email-to-SMS Gateway</span>
                  <span style={{ color: smsMessage.length > 160 ? 'var(--warning)' : 'var(--text-muted)' }}>
                    {smsMessage.length} / 160 characters {smsMessage.length > 160 && '(split message)'}
                  </span>
                </div>
              </div>

              <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', marginTop: '8px' }}>
                <button type="button" className="btn btn-secondary" onClick={() => { setShowSMSModal(false); playClick(); }}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={smsMessage.trim().length === 0}>
                  Send Message
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
