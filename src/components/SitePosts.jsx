import React, { useState } from 'react';
import { Newspaper, Plus, Trash2, Edit, Save, X, Image as ImageIcon, Globe, EyeOff, UploadCloud } from 'lucide-react';

const TAG_LABELS = {
  project: 'Project Highlight',
  roadmap: 'Roadmap',
  news: 'News',
};

const emptyForm = () => ({
  title: '',
  tag: 'news',
  date: new Date().toISOString().slice(0, 10),
  body: '',
  images: [],
  published: false,
});

// Author the public website's "From the Workshop" posts. Only posts marked
// Published are pushed to the cloud portal on the next sync.
export default function SitePosts({ sitePosts, onSitePostsChange }) {
  const [editingId, setEditingId] = useState(null);
  const [isAdding, setIsAdding] = useState(false);
  const [formData, setFormData] = useState(emptyForm());
  const [imageError, setImageError] = useState('');
  const [syncStatus, setSyncStatus] = useState('');

  const sortedPosts = [...sitePosts].sort((a, b) => String(b.date).localeCompare(String(a.date)));

  const startAdd = () => {
    setIsAdding(true);
    setEditingId(null);
    setFormData(emptyForm());
    setImageError('');
  };

  const startEdit = (post) => {
    setEditingId(post.id);
    setIsAdding(false);
    setFormData({
      title: post.title || '',
      tag: post.tag || 'news',
      date: post.date || new Date().toISOString().slice(0, 10),
      body: post.body || '',
      images: post.images || [],
      published: Boolean(post.published),
    });
    setImageError('');
  };

  const handleSave = () => {
    if (!formData.title.trim()) return;
    if (isAdding) {
      const newPost = { id: `post-${Date.now()}`, ...formData, title: formData.title.trim() };
      onSitePostsChange([...sitePosts, newPost]);
    } else {
      onSitePostsChange(sitePosts.map(p => (p.id === editingId ? { ...p, ...formData, title: formData.title.trim() } : p)));
    }
    setEditingId(null);
    setIsAdding(false);
  };

  const handleDelete = (id) => {
    if (window.confirm('Delete this post? If it was published, it disappears from the website on the next sync.')) {
      onSitePostsChange(sitePosts.filter(p => p.id !== id));
    }
  };

  const togglePublished = (post) => {
    onSitePostsChange(sitePosts.map(p => (p.id === post.id ? { ...p, published: !p.published } : p)));
  };

  const handleImageUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (file.size > 1500000) {
      setImageError('Image is too large (limit 1.5MB). Resize it and try again.');
      return;
    }
    if ((formData.images || []).length >= 4) {
      setImageError('Maximum of 4 images per post.');
      return;
    }
    setImageError('');
    const reader = new FileReader();
    reader.onloadend = () => {
      setFormData(current => ({
        ...current,
        images: [...(current.images || []), { id: `pimg-${Date.now()}`, url: reader.result }],
      }));
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const removeImage = (id) => {
    setFormData(current => ({ ...current, images: (current.images || []).filter(im => im.id !== id) }));
  };

  const syncNow = async () => {
    setSyncStatus('Publishing to website…');
    try {
      const res = await fetch('/api/portal-sync', { method: 'POST' });
      const data = await res.json();
      if (data.configured === false) setSyncStatus('Set the Portal URL and Sync Secret in System Settings first.');
      else if (!res.ok || data.ok === false) setSyncStatus(`Sync failed: ${data.error || res.status}`);
      else setSyncStatus('Published — the website is up to date.');
    } catch (error) {
      setSyncStatus(`Sync failed: ${error.message}`);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', gap: '16px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h2 style={{ fontSize: '24px', fontWeight: 'bold', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Newspaper style={{ color: 'var(--accent)' }} /> Website Posts
          </h2>
          <p style={{ color: 'var(--text-secondary)' }}>
            Project highlights, roadmap updates, and news for the public website. Published posts go live on the next sync.
          </p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {syncStatus && <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>{syncStatus}</span>}
          <button className="btn btn-secondary" onClick={syncNow}>
            <UploadCloud size={16} /> Publish Now
          </button>
          {!isAdding && !editingId && (
            <button className="btn btn-primary" onClick={startAdd}>
              <Plus size={16} /> New Post
            </button>
          )}
        </div>
      </div>

      {(isAdding || editingId) ? (
        <div className="panel" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px', flex: 1, overflowY: 'auto' }}>
          <h3>{isAdding ? 'New Post' : 'Edit Post'}</h3>

          <div className="grid-2">
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <label style={{ fontSize: '12px', fontWeight: 'bold', color: 'var(--text-secondary)' }}>Title</label>
              <input
                className="input-field"
                value={formData.title}
                onChange={e => setFormData({ ...formData, title: e.target.value })}
                placeholder="e.g., Just wrapped: kitchen remodel in Edmond"
              />
            </div>
            <div style={{ display: 'flex', gap: '12px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', flex: 1 }}>
                <label style={{ fontSize: '12px', fontWeight: 'bold', color: 'var(--text-secondary)' }}>Type</label>
                <select
                  className="input-field"
                  value={formData.tag}
                  onChange={e => setFormData({ ...formData, tag: e.target.value })}
                >
                  <option value="project">Project Highlight</option>
                  <option value="roadmap">Roadmap</option>
                  <option value="news">News</option>
                </select>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <label style={{ fontSize: '12px', fontWeight: 'bold', color: 'var(--text-secondary)' }}>Date</label>
                <input
                  type="date"
                  className="input-field"
                  value={formData.date}
                  onChange={e => setFormData({ ...formData, date: e.target.value })}
                />
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', flex: 1 }}>
            <label style={{ fontSize: '12px', fontWeight: 'bold', color: 'var(--text-secondary)' }}>Post</label>
            <textarea
              className="input-field"
              style={{ flex: 1, minHeight: '180px', resize: 'vertical' }}
              value={formData.body}
              onChange={e => setFormData({ ...formData, body: e.target.value })}
              placeholder="Write the post. Blank lines create paragraphs on the website."
            />
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <label style={{ fontSize: '12px', fontWeight: 'bold', color: 'var(--text-secondary)' }}>
              Photos ({(formData.images || []).length}/4)
            </label>
            <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center' }}>
              {(formData.images || []).map(im => (
                <div key={im.id} style={{ position: 'relative' }}>
                  <img src={im.url} alt="" style={{ width: '90px', height: '70px', objectFit: 'cover', border: '1px solid var(--border-color)' }} />
                  <button
                    onClick={() => removeImage(im.id)}
                    title="Remove image"
                    style={{ position: 'absolute', top: '-6px', right: '-6px', width: '20px', height: '20px', borderRadius: '50%', border: 'none', backgroundColor: 'var(--danger, #e53e3e)', color: '#fff', cursor: 'pointer', display: 'grid', placeItems: 'center' }}
                  >
                    <X size={12} />
                  </button>
                </div>
              ))}
              <label className="btn btn-secondary btn-sm" style={{ cursor: 'pointer' }}>
                <ImageIcon size={14} /> Add Photo
                <input type="file" accept="image/*" style={{ display: 'none' }} onChange={handleImageUpload} />
              </label>
            </div>
            {imageError && <span style={{ fontSize: '12px', color: 'var(--danger, #e53e3e)' }}>{imageError}</span>}
          </div>

          <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={formData.published}
              onChange={e => setFormData({ ...formData, published: e.target.checked })}
            />
            Published — show this post on the public website
          </label>

          <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
            <button className="btn btn-secondary" onClick={() => { setIsAdding(false); setEditingId(null); }}>
              <X size={16} /> Cancel
            </button>
            <button className="btn btn-primary" onClick={handleSave} disabled={!formData.title.trim()}>
              <Save size={16} /> Save Post
            </button>
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', flex: 1, overflowY: 'auto' }}>
          {sortedPosts.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '48px', color: 'var(--text-secondary)', border: '1px dashed var(--border-color)' }}>
              <Newspaper size={32} style={{ margin: '0 auto 8px', opacity: 0.5 }} />
              <p>No posts yet. Share a finished project, a roadmap item, or news — it becomes your website's "From the Workshop" page.</p>
            </div>
          ) : (
            sortedPosts.map(post => (
              <div key={post.id} className="panel" style={{ padding: '20px', display: 'flex', gap: '16px', alignItems: 'flex-start' }}>
                {(post.images || [])[0] && (
                  <img src={post.images[0].url} alt="" style={{ width: '110px', height: '82px', objectFit: 'cover', border: '1px solid var(--border-color)', flexShrink: 0 }} />
                )}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                    <h3 style={{ margin: 0, fontSize: '16px' }}>{post.title}</h3>
                    <span className={`badge badge-${post.tag === 'project' ? 'progress' : post.tag === 'roadmap' ? 'scheduled' : 'quoting'}`} style={{ fontSize: '9px' }}>
                      {TAG_LABELS[post.tag] || post.tag}
                    </span>
                    <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>{post.date}</span>
                  </div>
                  <p style={{ margin: '8px 0 0', fontSize: '13px', color: 'var(--text-secondary)', overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
                    {post.body}
                  </p>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', alignItems: 'flex-end', flexShrink: 0 }}>
                  <button
                    className={`btn btn-sm ${post.published ? 'btn-primary' : 'btn-secondary'}`}
                    onClick={() => togglePublished(post)}
                    title={post.published ? 'Live on the website — click to unpublish' : 'Draft — click to publish on next sync'}
                  >
                    {post.published ? <><Globe size={12} /> Live</> : <><EyeOff size={12} /> Draft</>}
                  </button>
                  <div style={{ display: 'flex', gap: '4px' }}>
                    <button className="btn btn-secondary btn-sm" style={{ padding: '4px 8px' }} onClick={() => startEdit(post)} title="Edit">
                      <Edit size={12} />
                    </button>
                    <button className="btn btn-danger btn-sm" style={{ padding: '4px 8px' }} onClick={() => handleDelete(post.id)} title="Delete">
                      <Trash2 size={12} />
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
