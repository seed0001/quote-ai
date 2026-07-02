import React, { useState } from 'react';
import { BookOpen, Plus, Trash2, Edit, Save, X, Search, Tag } from 'lucide-react';

export default function KnowledgeBase({ knowledgeBase, onKnowledgeBaseChange }) {
  const [searchTerm, setSearchTerm] = useState('');
  const [editingId, setEditingId] = useState(null);
  const [formData, setFormData] = useState({ title: '', content: '', tags: '' });
  const [isAdding, setIsAdding] = useState(false);

  const filteredArticles = knowledgeBase.filter(a => 
    a.title.toLowerCase().includes(searchTerm.toLowerCase()) || 
    a.content.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (a.tags && a.tags.some(t => t.toLowerCase().includes(searchTerm.toLowerCase())))
  );

  const handleSave = () => {
    const tagsArray = formData.tags
      ? formData.tags.split(',').map(t => t.trim()).filter(Boolean)
      : [];
      
    if (isAdding) {
      const newArticle = {
        id: `kb-${Date.now()}`,
        title: formData.title || 'Untitled SOP',
        content: formData.content,
        tags: tagsArray
      };
      onKnowledgeBaseChange([...knowledgeBase, newArticle]);
    } else {
      onKnowledgeBaseChange(knowledgeBase.map(a => 
        a.id === editingId ? { ...a, title: formData.title, content: formData.content, tags: tagsArray } : a
      ));
    }
    setEditingId(null);
    setIsAdding(false);
  };

  const handleDelete = (id) => {
    if (confirm('Are you sure you want to delete this knowledge article?')) {
      onKnowledgeBaseChange(knowledgeBase.filter(a => a.id !== id));
    }
  };

  const startEdit = (article) => {
    setEditingId(article.id);
    setIsAdding(false);
    setFormData({
      title: article.title,
      content: article.content,
      tags: article.tags ? article.tags.join(', ') : ''
    });
  };

  const startAdd = () => {
    setIsAdding(true);
    setEditingId(null);
    setFormData({ title: '', content: '', tags: '' });
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', gap: '16px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h2 style={{ fontSize: '24px', fontWeight: 'bold', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <BookOpen style={{ color: 'var(--accent)' }} /> Knowledge Base
          </h2>
          <p style={{ color: 'var(--text-secondary)' }}>
            Standard Operating Procedures (SOPs) and rules the AI will follow.
          </p>
        </div>
        {!isAdding && !editingId && (
          <button className="btn btn-primary" onClick={startAdd} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Plus size={16} /> Add Article
          </button>
        )}
      </div>

      {(isAdding || editingId) ? (
        <div className="panel" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px', flex: 1 }}>
          <h3>{isAdding ? 'New Knowledge Article' : 'Edit Article'}</h3>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <label style={{ fontSize: '12px', fontWeight: 'bold', color: 'var(--text-secondary)' }}>Title</label>
            <input 
              className="input-field" 
              value={formData.title} 
              onChange={e => setFormData({ ...formData, title: e.target.value })} 
              placeholder="e.g., How to deploy the website"
            />
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <label style={{ fontSize: '12px', fontWeight: 'bold', color: 'var(--text-secondary)' }}>Tags (comma separated)</label>
            <input 
              className="input-field" 
              value={formData.tags} 
              onChange={e => setFormData({ ...formData, tags: e.target.value })} 
              placeholder="e.g., engineering, deployment, admin"
            />
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', flex: 1 }}>
            <label style={{ fontSize: '12px', fontWeight: 'bold', color: 'var(--text-secondary)' }}>Content (SOP Details)</label>
            <textarea 
              className="input-field" 
              style={{ flex: 1, minHeight: '200px', resize: 'vertical' }}
              value={formData.content} 
              onChange={e => setFormData({ ...formData, content: e.target.value })} 
              placeholder="Detail the steps, rules, or instructions here. The AI will read this to learn how to perform tasks."
            />
          </div>

          <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', marginTop: '16px' }}>
            <button className="btn btn-secondary" onClick={() => { setIsAdding(false); setEditingId(null); }} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <X size={16} /> Cancel
            </button>
            <button className="btn btn-primary" onClick={handleSave} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Save size={16} /> Save Article
            </button>
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', flex: 1 }}>
          <div style={{ position: 'relative' }}>
            <Search size={16} style={{ position: 'absolute', left: '12px', top: '10px', color: 'var(--text-secondary)' }} />
            <input 
              className="input-field"
              style={{ paddingLeft: '36px', width: '100%', maxWidth: '400px' }}
              placeholder="Search articles..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '16px', overflowY: 'auto' }}>
            {filteredArticles.length === 0 ? (
              <div style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '40px', color: 'var(--text-secondary)', backgroundColor: 'var(--bg-panel)', borderRadius: '8px' }}>
                <BookOpen size={32} style={{ margin: '0 auto 8px auto', opacity: 0.5 }} />
                <p>No knowledge articles found.</p>
              </div>
            ) : (
              filteredArticles.map(article => (
                <div key={article.id} className="panel" style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <h3 style={{ margin: 0, fontSize: '18px', color: 'var(--text-primary)' }}>{article.title}</h3>
                    <div style={{ display: 'flex', gap: '4px' }}>
                      <button className="icon-btn" onClick={() => startEdit(article)} title="Edit"><Edit size={14} /></button>
                      <button className="icon-btn" onClick={() => handleDelete(article.id)} title="Delete" style={{ color: 'var(--danger)' }}><Trash2 size={14} /></button>
                    </div>
                  </div>
                  
                  {article.tags && article.tags.length > 0 && (
                    <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                      {article.tags.map(tag => (
                        <span key={tag} style={{ fontSize: '11px', padding: '2px 8px', backgroundColor: 'var(--bg-body)', borderRadius: '12px', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <Tag size={10} /> {tag}
                        </span>
                      ))}
                    </div>
                  )}

                  <div style={{ fontSize: '13px', color: 'var(--text-secondary)', flex: 1, whiteSpace: 'pre-wrap', overflow: 'hidden', textOverflow: 'ellipsis', display: '-webkit-box', WebkitLineClamp: 5, WebkitBoxOrient: 'vertical' }}>
                    {article.content}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
