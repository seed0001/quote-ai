import React, { useState } from 'react';
import { Brain, Plus, Trash2, Edit, Save, X, Search, Tag, Zap, BookMarked, History, Eraser } from 'lucide-react';
import { newMemoryRecord, MEMORY_TYPES } from '../utils/dataStore';

const TYPE_META = {
  short: { label: 'Short-term', icon: Zap, hint: 'Scratch notes and recent activity. Expires automatically after a week.', badge: 'quoting' },
  long: { label: 'Long-term', icon: BookMarked, hint: 'Durable facts, preferences, corrections, and standing rules.', badge: 'progress' },
  episodic: { label: 'Episodic', icon: History, hint: 'A journal of meaningful events, decisions, and outcomes.', badge: 'scheduled' },
};

const SOURCE_LABELS = { ai: 'Saved by AI', user: 'Saved by you', system: 'Auto-logged' };

const formatWhen = (iso) => {
  if (!iso) return '';
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
};

// Manage the assistant's persistent memory: what it knows (long-term), what
// it experienced (episodic), and what it's holding onto right now (short-term).
export default function MemoryCenter({ aiMemory, onAiMemoryChange }) {
  const [filter, setFilter] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [editingId, setEditingId] = useState(null);
  const [isAdding, setIsAdding] = useState(false);
  const [formData, setFormData] = useState({ type: 'long', content: '', tags: '' });

  const counts = MEMORY_TYPES.reduce((acc, type) => ({ ...acc, [type]: aiMemory.filter(m => m.type === type).length }), {});

  const term = searchTerm.toLowerCase();
  const visible = aiMemory
    .filter(m => filter === 'all' || m.type === filter)
    .filter(m =>
      !term
      || (m.content || '').toLowerCase().includes(term)
      || (m.tags || []).some(t => String(t).toLowerCase().includes(term))
    )
    .sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')));

  const startAdd = () => {
    setIsAdding(true);
    setEditingId(null);
    setFormData({ type: filter === 'all' ? 'long' : filter, content: '', tags: '' });
  };

  const startEdit = (memory) => {
    setEditingId(memory.id);
    setIsAdding(false);
    setFormData({ type: memory.type, content: memory.content, tags: (memory.tags || []).join(', ') });
  };

  const handleSave = () => {
    if (!formData.content.trim()) return;
    const tags = formData.tags ? formData.tags.split(',').map(t => t.trim()).filter(Boolean) : [];
    if (isAdding) {
      onAiMemoryChange([...aiMemory, newMemoryRecord({ type: formData.type, content: formData.content.trim(), tags, source: 'user' })]);
    } else {
      onAiMemoryChange(aiMemory.map(m => m.id === editingId
        ? { ...m, type: formData.type, content: formData.content.trim(), tags, updatedAt: new Date().toISOString() }
        : m));
    }
    setIsAdding(false);
    setEditingId(null);
  };

  const handleDelete = (id) => {
    if (window.confirm('Forget this memory? The AI will no longer see it.')) {
      onAiMemoryChange(aiMemory.filter(m => m.id !== id));
    }
  };

  const clearType = (type) => {
    const meta = TYPE_META[type];
    if (window.confirm(`Forget ALL ${meta.label.toLowerCase()} memories (${counts[type]})? This cannot be undone.`)) {
      onAiMemoryChange(aiMemory.filter(m => m.type !== type));
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', gap: '16px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h2 style={{ fontSize: '24px', fontWeight: 'bold', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Brain style={{ color: 'var(--accent)' }} /> AI Memory
          </h2>
          <p style={{ color: 'var(--text-secondary)' }}>
            Everything the assistant remembers across conversations. It reads all of this every turn and maintains it itself — you can correct it here.
          </p>
        </div>
        {!isAdding && !editingId && (
          <button className="btn btn-primary" onClick={startAdd}>
            <Plus size={16} /> Add Memory
          </button>
        )}
      </div>

      {/* Type summary cards */}
      <div className="metrics-grid">
        {MEMORY_TYPES.map(type => {
          const meta = TYPE_META[type];
          const Icon = meta.icon;
          return (
            <div
              key={type}
              className="metric-card"
              onClick={() => setFilter(filter === type ? 'all' : type)}
              style={{ cursor: 'pointer', outline: filter === type ? '2px solid var(--accent)' : 'none' }}
            >
              <div className="metric-label" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Icon size={13} /> {meta.label}
              </div>
              <div className="metric-value">{counts[type]}</div>
              <div className="metric-change" style={{ color: 'var(--text-secondary)' }}>{meta.hint}</div>
            </div>
          );
        })}
      </div>

      {(isAdding || editingId) ? (
        <div className="panel" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px', flex: 1 }}>
          <h3>{isAdding ? 'New Memory' : 'Edit Memory'}</h3>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', maxWidth: '280px' }}>
            <label style={{ fontSize: '12px', fontWeight: 'bold', color: 'var(--text-secondary)' }}>Type</label>
            <select
              className="input-field"
              value={formData.type}
              onChange={e => setFormData({ ...formData, type: e.target.value })}
            >
              {MEMORY_TYPES.map(type => (
                <option key={type} value={type}>{TYPE_META[type].label}</option>
              ))}
            </select>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', flex: 1 }}>
            <label style={{ fontSize: '12px', fontWeight: 'bold', color: 'var(--text-secondary)' }}>Memory</label>
            <textarea
              className="input-field"
              style={{ flex: 1, minHeight: '160px', resize: 'vertical' }}
              value={formData.content}
              onChange={e => setFormData({ ...formData, content: e.target.value })}
              placeholder="e.g., Travis never adds 3D printing items to the main catalog — handyman, automotive, and tech support only."
            />
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <label style={{ fontSize: '12px', fontWeight: 'bold', color: 'var(--text-secondary)' }}>Tags (comma separated)</label>
            <input
              className="input-field"
              value={formData.tags}
              onChange={e => setFormData({ ...formData, tags: e.target.value })}
              placeholder="e.g., catalog, rules"
            />
          </div>

          <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
            <button className="btn btn-secondary" onClick={() => { setIsAdding(false); setEditingId(null); }}>
              <X size={16} /> Cancel
            </button>
            <button className="btn btn-primary" onClick={handleSave} disabled={!formData.content.trim()}>
              <Save size={16} /> Save Memory
            </button>
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', flex: 1, minHeight: 0 }}>
          <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
            <div style={{ position: 'relative', flex: 1, minWidth: '220px', maxWidth: '400px' }}>
              <Search size={16} style={{ position: 'absolute', left: '12px', top: '10px', color: 'var(--text-secondary)' }} />
              <input
                className="input-field"
                style={{ paddingLeft: '36px', width: '100%' }}
                placeholder="Search memories..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            {filter !== 'all' && counts[filter] > 0 && (
              <button className="btn btn-secondary btn-sm" onClick={() => clearType(filter)} style={{ color: 'var(--danger)' }}>
                <Eraser size={13} /> Forget all {TYPE_META[filter].label.toLowerCase()}
              </button>
            )}
            <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
              {visible.length} shown{filter !== 'all' ? ` · ${TYPE_META[filter].label}` : ''}
            </span>
          </div>

          <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {visible.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '48px', color: 'var(--text-secondary)', border: '1px dashed var(--border-color)' }}>
                <Brain size={32} style={{ margin: '0 auto 8px', opacity: 0.5 }} />
                <p>No memories {filter === 'all' ? 'yet' : `of this type`}. The AI saves them as you work together, or add one yourself.</p>
              </div>
            ) : (
              visible.map(memory => {
                const meta = TYPE_META[memory.type] || TYPE_META.long;
                const Icon = meta.icon;
                return (
                  <div key={memory.id} className="panel" style={{ padding: '16px 20px', display: 'flex', gap: '14px', alignItems: 'flex-start' }}>
                    <Icon size={18} style={{ color: 'var(--accent)', marginTop: '3px', flexShrink: 0 }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', marginBottom: '6px' }}>
                        <span className={`badge badge-${meta.badge}`} style={{ fontSize: '9px' }}>{meta.label}</span>
                        <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                          {SOURCE_LABELS[memory.source] || 'Saved'} · {formatWhen(memory.createdAt)}
                          {memory.updatedAt && memory.updatedAt !== memory.createdAt ? ` · edited ${formatWhen(memory.updatedAt)}` : ''}
                        </span>
                      </div>
                      <div style={{ fontSize: '13px', color: 'var(--text-primary)', whiteSpace: 'pre-wrap', lineHeight: 1.55 }}>
                        {memory.content}
                      </div>
                      {(memory.tags || []).length > 0 && (
                        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginTop: '8px' }}>
                          {memory.tags.map(tag => (
                            <span key={tag} style={{ fontSize: '10px', padding: '2px 8px', backgroundColor: 'var(--bg-tertiary)', borderRadius: '10px', color: 'var(--text-secondary)', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                              <Tag size={9} /> {tag}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                    <div style={{ display: 'flex', gap: '4px', flexShrink: 0 }}>
                      <button className="btn btn-secondary btn-sm" style={{ padding: '4px 8px' }} onClick={() => startEdit(memory)} title="Edit memory">
                        <Edit size={12} />
                      </button>
                      <button className="btn btn-secondary btn-sm" style={{ padding: '4px 8px', color: 'var(--danger)' }} onClick={() => handleDelete(memory.id)} title="Forget memory">
                        <Trash2 size={12} />
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
