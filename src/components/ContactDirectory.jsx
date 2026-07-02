import React, { useState } from 'react';
import { Search, Plus, Phone, Mail, MapPin, Globe, BookUser, Edit2, Trash2 } from 'lucide-react';
import { addContact, updateContact, deleteContact } from '../utils/dataStore';

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
  const [notes, setNotes] = useState('');

  const filteredContacts = (contacts || []).filter(c => 
    c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (c.email && c.email.toLowerCase().includes(searchTerm.toLowerCase())) ||
    (c.notes && c.notes.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const resetForm = () => {
    setName('');
    setPhone('');
    setEmail('');
    setAddress('');
    setWebsite('');
    setNotes('');
    setEditingContactId(null);
    setShowForm(false);
  };

  const handleEdit = (contact) => {
    setName(contact.name || '');
    setPhone(contact.phone || '');
    setEmail(contact.email || '');
    setAddress(contact.address || '');
    setWebsite(contact.website || '');
    setNotes(contact.notes || '');
    setEditingContactId(contact.id);
    setShowForm(true);
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
        notes
      });
    } else {
      addContact({
        name,
        phone,
        email,
        address,
        website,
        notes
      });
    }
    onContactsChange();
    resetForm();
  };

  const handleDelete = (id) => {
    if (window.confirm('Are you sure you want to delete this contact?')) {
      deleteContact(id);
      onContactsChange();
    }
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
          <button className="btn btn-primary" onClick={() => setShowForm(true)}>
            <Plus size={16} /> Add Contact
          </button>
        )}
      </div>

      {!showForm && (
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

            <div style={{ display: 'flex', gap: '16px' }}>
              <div className="form-group" style={{ flex: 1 }}>
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
              <div className="form-group" style={{ flex: 1 }}>
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
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '16px' }}>
          {filteredContacts.length === 0 ? (
            <div style={{ gridColumn: '1 / -1', padding: '48px', textAlign: 'center', backgroundColor: 'var(--bg-secondary)', borderRadius: '8px', border: '1px dashed var(--border-color)', color: 'var(--text-secondary)' }}>
              <BookUser size={32} style={{ margin: '0 auto 16px auto', opacity: 0.5 }} />
              <p>No contacts found. Your address book is empty.</p>
            </div>
          ) : (
            filteredContacts.map(contact => (
              <div key={contact.id} className="panel" style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <h3 style={{ fontSize: '18px', fontWeight: 'bold', color: 'var(--text-primary)' }}>{contact.name}</h3>
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

                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '13px', color: 'var(--text-secondary)' }}>
                  {contact.phone && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <Phone size={14} style={{ color: 'var(--text-muted)' }} />
                      <a href={`tel:${contact.phone}`} style={{ color: 'var(--accent)', textDecoration: 'none' }}>{contact.phone}</a>
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
    </div>
  );
}
