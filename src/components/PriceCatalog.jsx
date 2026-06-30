import React, { useState, useMemo } from 'react';
import { Search, Plus, Edit2, Trash2, X, Package } from 'lucide-react';
import { addCatalogItem, updateCatalogItem, deleteCatalogItem, getCatalog } from '../utils/dataStore';

// Suggestions only — the fields accept any custom value the user types.
const SUGGESTED_CATEGORIES = ['Products', 'Services', 'Labor', 'Consulting', 'Design', 'Equipment', 'Rentals', 'Travel', 'Shipping', 'Licenses & Fees', 'Subcontractors', 'Other'];
const SUGGESTED_UNITS = ['each', 'hour', 'day', 'week', 'month', 'project', 'package', 'session', 'mile', 'sq ft', 'linear ft', 'box'];

const EMPTY_FORM = { name: '', category: '', unit: 'each', price: '', store: '', description: '' };

export default function PriceCatalog({ catalog, onCatalogChange }) {
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);

  // Distinct categories present in the catalog, for the filter dropdown.
  const categories = useMemo(() => {
    const set = new Set(catalog.map(i => i.category).filter(Boolean));
    return Array.from(set).sort();
  }, [catalog]);

  const term = searchTerm.toLowerCase();
  const filtered = catalog.filter(i => {
    const matchesSearch =
      (i.name || '').toLowerCase().includes(term) ||
      (i.category || '').toLowerCase().includes(term) ||
      (i.store || '').toLowerCase().includes(term) ||
      (i.description || '').toLowerCase().includes(term);
    const matchesCat = categoryFilter === 'all' || i.category === categoryFilter;
    return matchesSearch && matchesCat;
  });

  const openAdd = () => {
    setForm(EMPTY_FORM);
    setEditingId(null);
    setShowModal(true);
  };

  const openEdit = (item) => {
    setForm({
      name: item.name || '',
      category: item.category || '',
      unit: item.unit || 'each',
      price: item.price ?? '',
      store: item.store || '',
      description: item.description || ''
    });
    setEditingId(item.id);
    setShowModal(true);
  };

  const handleField = (field, val) => setForm(prev => ({ ...prev, [field]: val }));

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!form.name.trim()) return;

    const payload = {
      name: form.name.trim(),
      category: form.category.trim() || 'Other',
      unit: form.unit.trim() || 'each',
      price: parseFloat(form.price) || 0,
      store: form.store.trim(),
      description: form.description.trim()
    };

    if (editingId) {
      updateCatalogItem({ id: editingId, ...payload });
    } else {
      addCatalogItem(payload);
    }
    onCatalogChange(getCatalog());
    setShowModal(false);
  };

  const handleDelete = (id) => {
    if (window.confirm('Remove this product from the catalog?')) {
      deleteCatalogItem(id);
      onCatalogChange(getCatalog());
    }
  };

  const formatPrice = (val) =>
    new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(val || 0);

  return (
    <div className="panel" style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 130px)', marginBottom: 0 }}>
      {/* Header */}
      <div className="panel-header">
        <div>
          <h2 className="panel-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Package size={16} style={{ color: 'var(--accent)' }} /> Price Catalog
          </h2>
          <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>
            Generalized ballpark pricing — fully editable. Live price tracking integration planned for later.
          </div>
        </div>
        <button className="btn btn-primary btn-sm" onClick={openAdd}>
          <Plus size={14} /> Add Catalog Item
        </button>
      </div>

      {/* Controls */}
      <div style={{ display: 'flex', gap: '12px', margin: '16px 0', flexWrap: 'wrap' }}>
        <div className="input-group" style={{ flex: 1, minWidth: '240px' }}>
          <span className="input-addon"><Search size={16} /></span>
          <input
            type="text"
            className="input-field"
            placeholder="Search products, services, vendors, descriptions..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <select
          className="input-field"
          style={{ width: '200px' }}
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
        >
          <option value="all">All Categories ({catalog.length})</option>
          {categories.map(c => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
      </div>

      {/* Product Table */}
      <div className="table-container" style={{ flex: 1, overflowY: 'auto', border: '1px solid var(--border-color)' }}>
        <table className="app-table" style={{ fontSize: '13px' }}>
          <thead>
            <tr>
              <th>Product / Service</th>
              <th style={{ width: '14%' }}>Category</th>
              <th style={{ width: '9%' }}>Unit</th>
              <th style={{ width: '11%', textAlign: 'right' }}>Price</th>
              <th style={{ width: '18%' }}>Vendor / Source</th>
              <th style={{ width: '8%' }}></th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={6} style={{ padding: '32px', textAlign: 'center', color: 'var(--text-secondary)' }}>
                  No products match. Adjust your search or add a new product.
                </td>
              </tr>
            ) : (
              filtered.map(item => (
                <tr key={item.id}>
                  <td>
                    <div style={{ fontWeight: '600' }}>{item.name}</div>
                    {item.description && (
                      <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>
                        {item.description}
                      </div>
                    )}
                  </td>
                  <td>
                    <span className="badge badge-quoting" style={{ fontSize: '10px' }}>{item.category}</span>
                  </td>
                  <td style={{ color: 'var(--text-secondary)' }}>{item.unit}</td>
                  <td style={{ textAlign: 'right', fontFamily: 'var(--font-mono)', fontWeight: '600', color: 'var(--accent)' }}>
                    {formatPrice(item.price)}
                  </td>
                  <td style={{ color: 'var(--text-secondary)', fontSize: '12px' }}>{item.store || '—'}</td>
                  <td>
                    <div style={{ display: 'flex', gap: '4px', justifyContent: 'flex-end' }}>
                      <button
                        className="btn btn-secondary btn-sm"
                        style={{ padding: '4px 8px' }}
                        onClick={() => openEdit(item)}
                        title="Edit product"
                      >
                        <Edit2 size={12} />
                      </button>
                      <button
                        className="btn btn-secondary btn-sm"
                        style={{ padding: '4px 8px', color: 'var(--danger)' }}
                        onClick={() => handleDelete(item.id)}
                        title="Delete product"
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Add / Edit Modal */}
      {showModal && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <h3 className="panel-title">{editingId ? 'Edit Catalog Item' : 'Add Catalog Item'}</h3>
              <button onClick={() => setShowModal(false)} style={{ cursor: 'pointer', color: 'var(--text-secondary)' }}>
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSubmit}>
              <div className="modal-body">
                <div className="form-group">
                  <label className="form-label">Product / Service Name</label>
                  <input
                    type="text"
                    className="input-field"
                    placeholder="e.g. Strategy Session, Equipment Rental, Premium Package"
                    value={form.name}
                    onChange={(e) => handleField('name', e.target.value)}
                    required
                  />
                </div>

                <div className="grid-2">
                  <div className="form-group">
                    <label className="form-label">Category</label>
                    <input
                      type="text"
                      className="input-field"
                      list="catalog-categories"
                      placeholder="e.g. Services"
                      value={form.category}
                      onChange={(e) => handleField('category', e.target.value)}
                    />
                    <datalist id="catalog-categories">
                      {SUGGESTED_CATEGORIES.map(c => <option key={c} value={c} />)}
                    </datalist>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Unit</label>
                    <input
                      type="text"
                      className="input-field"
                      list="catalog-units"
                      placeholder="e.g. each"
                      value={form.unit}
                      onChange={(e) => handleField('unit', e.target.value)}
                    />
                    <datalist id="catalog-units">
                      {SUGGESTED_UNITS.map(u => <option key={u} value={u} />)}
                    </datalist>
                  </div>
                </div>

                <div className="grid-2">
                  <div className="form-group">
                    <label className="form-label">Price ($ per unit)</label>
                    <input
                      type="number"
                      step="any"
                      min="0"
                      className="input-field"
                      placeholder="0.00"
                      value={form.price}
                      onChange={(e) => handleField('price', e.target.value)}
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Vendor / Source</label>
                    <input
                      type="text"
                      className="input-field"
                      placeholder="Optional supplier, partner, or source"
                      value={form.store}
                      onChange={(e) => handleField('store', e.target.value)}
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label">Description</label>
                  <textarea
                    className="input-field"
                    placeholder="Scope, specifications, tier, or internal pricing notes..."
                    value={form.description}
                    onChange={(e) => handleField('description', e.target.value)}
                  />
                </div>
              </div>

              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  {editingId ? 'Save Changes' : 'Add Catalog Item'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
