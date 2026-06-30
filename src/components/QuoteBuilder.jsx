import React, { useState, useMemo } from 'react';
import {
  Plus,
  Trash2,
  ChevronRight,
  Settings as SettingsIcon,
  Calculator,
  Printer,
  ArrowLeft,
  FileText,
  Copy,
  Download,
  Mail
} from 'lucide-react';
import { ESTIMATOR_TEMPLATES, CATEGORIES } from '../utils/templates';
import { calculateQuoteTotals } from '../utils/dataStore';

export default function QuoteBuilder({ 
  project, 
  clients, 
  settings, 
  onUpdateProject, 
  onClose 
}) {
  const [activeRoomIndex, setActiveRoomIndex] = useState(0);
  const [showAddRoom, setShowAddRoom] = useState(false);
  const [newRoomName, setNewRoomName] = useState('');
  
  // Template insert state
  const [selectedCategory, setSelectedCategory] = useState(CATEGORIES[0]);
  const [selectedTemplateId, setSelectedTemplateId] = useState('');
  
  // Printing state
  const [printPreviewMode, setPrintPreviewMode] = useState(false);

  const client = clients.find(c => c.id === project.clientId);

  // Dynamic calculations based on current state
  const totals = useMemo(() => {
    return calculateQuoteTotals(project, settings);
  }, [project, settings]);

  // Handle setting general project metrics
  const updateProjectMetric = (field, value) => {
    onUpdateProject({
      ...project,
      [field]: parseFloat(value) || 0
    });
  };

  // Add a new room section
  const handleAddRoom = (e) => {
    e.preventDefault();
    if (!newRoomName) return;
    
    const updatedRooms = [...project.rooms, { name: newRoomName, items: [] }];
    onUpdateProject({
      ...project,
      rooms: updatedRooms
    });
    
    setNewRoomName('');
    setShowAddRoom(false);
    setActiveRoomIndex(updatedRooms.length - 1);
  };

  // Delete a room section
  const handleDeleteRoom = (roomIdx) => {
    if (window.confirm(`Are you sure you want to delete the entire section "${project.rooms[roomIdx].name}"?`)) {
      const updatedRooms = project.rooms.filter((_, idx) => idx !== roomIdx);
      onUpdateProject({
        ...project,
        rooms: updatedRooms
      });
      setActiveRoomIndex(Math.max(0, roomIdx - 1));
    }
  };

  // Update a single item's field
  const handleUpdateItem = (roomIdx, itemIdx, field, val) => {
    const updatedRooms = [...project.rooms];
    const item = { ...updatedRooms[roomIdx].items[itemIdx] };
    
    if (field === 'quantity') item.quantity = parseFloat(val) || 0;
    else if (field === 'materialCost') item.materialCost = parseFloat(val) || 0;
    else if (field === 'laborHours') item.laborHours = parseFloat(val) || 0;
    else item[field] = val;

    updatedRooms[roomIdx].items[itemIdx] = item;
    onUpdateProject({
      ...project,
      rooms: updatedRooms
    });
  };

  // Add item from template
  const handleInsertTemplate = () => {
    if (!selectedTemplateId) return;
    const template = ESTIMATOR_TEMPLATES.find(t => t.id === selectedTemplateId);
    if (!template) return;

    const newItem = {
      id: `item-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
      category: template.category,
      name: template.name,
      unit: template.unit,
      quantity: 1,
      materialCost: template.materialCost,
      laborHours: template.laborHours
    };

    const updatedRooms = [...project.rooms];
    if (updatedRooms.length === 0) {
      updatedRooms.push({ name: 'General Scope', items: [newItem] });
      setActiveRoomIndex(0);
    } else {
      updatedRooms[activeRoomIndex].items.push(newItem);
    }

    onUpdateProject({
      ...project,
      rooms: updatedRooms
    });
    
    setSelectedTemplateId('');
  };

  // Add custom manual item
  const handleInsertCustomItem = () => {
    const newItem = {
      id: `item-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
      category: 'Other',
      name: 'Custom Quote Item',
      unit: 'each',
      quantity: 1,
      materialCost: 0,
      laborHours: 0
    };

    const updatedRooms = [...project.rooms];
    if (updatedRooms.length === 0) {
      updatedRooms.push({ name: 'General Scope', items: [newItem] });
      setActiveRoomIndex(0);
    } else {
      updatedRooms[activeRoomIndex].items.push(newItem);
    }

    onUpdateProject({
      ...project,
      rooms: updatedRooms
    });
  };

  // Remove an item
  const handleRemoveItem = (roomIdx, itemIdx) => {
    const updatedRooms = [...project.rooms];
    updatedRooms[roomIdx].items = updatedRooms[roomIdx].items.filter((_, idx) => idx !== itemIdx);
    
    onUpdateProject({
      ...project,
      rooms: updatedRooms
    });
  };

  // Filter templates list based on category selection
  const categoryTemplates = ESTIMATOR_TEMPLATES.filter(t => t.category === selectedCategory);

  // Trigger browser print dialog
  const handleTriggerPrint = () => {
    window.print();
  };

  // One-click branded PDF download (no browser print dialog). jsPDF is loaded
  // lazily so it never weighs down the initial app load.
  const handleDownloadPdf = async () => {
    const { generateProposalPdf } = await import('../utils/generateProposalPdf');
    generateProposalPdf(project, client, settings);
  };

  const [isEmailing, setIsEmailing] = useState(false);

  const handleEmailQuote = async () => {
    if (!client?.email) {
      alert("This client does not have an email address set. Please update the client record.");
      return;
    }
    const confirm = window.confirm(`Generate Stripe Checkout and email this quote to ${client.email}?`);
    if (!confirm) return;
    
    setIsEmailing(true);
    try {
      const checkoutRes = await fetch('/api/stripe/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectName: project.name,
          total: totals.netTotal,
          email: client.email
        })
      });
      const checkoutData = await checkoutRes.json();
      if (!checkoutRes.ok) throw new Error(checkoutData.error || 'Failed to create checkout session');
      
      const htmlBody = `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; color: #333;">
          <h2 style="color: #2b6cb0;">Quote for ${project.name}</h2>
          <p>Hi ${client.name},</p>
          <p>Thank you for the opportunity to quote this project. Your grand total for this phase is <strong>${new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(totals.netTotal)}</strong>.</p>
          <p>When you are ready to proceed, you can securely pay online using the button below:</p>
          <a href="${checkoutData.url}" style="display: inline-block; padding: 12px 24px; background-color: #6772e5; color: #fff; text-decoration: none; border-radius: 4px; font-weight: bold; margin: 20px 0;">Approve & Pay via Stripe</a>
          <p>If you have any questions, please let us know.</p>
          <p>Thank you,<br>${settings.companyName || 'Our Team'}</p>
        </div>
      `;
      
      const emailRes = await fetch('/api/email/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clientEmail: client.email,
          projectName: project.name,
          htmlBody: htmlBody
        })
      });
      const emailData = await emailRes.json();
      if (!emailRes.ok) throw new Error(emailData.error || 'Failed to send email');
      
      alert("Quote and checkout link successfully emailed to client!");
    } catch (e) {
      alert("Error: " + e.message);
    } finally {
      setIsEmailing(false);
    }
  };

  // --- PRINT / CLIENT VIEW RENDER ---
  if (printPreviewMode) {
    return (
      <div className="panel" style={{ backgroundColor: '#ffffff', color: '#000000', border: '1px solid #ddd', padding: '40px', maxWidth: '850px', margin: '0 auto', minHeight: '1000px' }}>
        {/* Print Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '2px solid #000', paddingBottom: '20px', marginBottom: '30px' }} className="no-print">
          <div style={{ display: 'flex', gap: '10px' }}>
            <button className="btn btn-secondary btn-sm" onClick={() => setPrintPreviewMode(false)}>
              <ArrowLeft size={12} /> Back to Editor
            </button>
            <button className="btn btn-primary btn-sm" onClick={handleDownloadPdf}>
              <Download size={12} /> Download PDF
            </button>
            <button className="btn btn-primary btn-sm" onClick={handleEmailQuote} disabled={isEmailing} style={{ backgroundColor: '#6772e5', borderColor: '#6772e5' }}>
              <Mail size={12} /> {isEmailing ? 'Sending...' : 'Email & Checkout'}
            </button>
            <button className="btn btn-secondary btn-sm" onClick={handleTriggerPrint}>
              <Printer size={12} /> Print
            </button>
          </div>
          <span style={{ fontSize: '12px', color: '#666', fontWeight: 'bold' }}>CLIENT PROPOSAL PREVIEW</span>
        </div>

        {/* Company and Client info block */}
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '40px', fontSize: '13px' }}>
          <div style={{ display: 'flex', gap: '16px', alignItems: 'flex-start' }}>
            {settings.companyLogo && (
              <img src={settings.companyLogo} alt="Company logo" style={{ width: '64px', height: '64px', objectFit: 'contain' }} />
            )}
            <div>
              <h1 style={{ fontSize: '24px', fontWeight: '800', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '8px' }}>
                {settings.companyName || 'My Business'}
              </h1>
              <div style={{ whiteSpace: 'pre-line', color: '#444' }}>
                {settings.address}
                {`\nPhone: ${settings.phone}`}
                {`\nEmail: ${settings.email}`}
              </div>
            </div>
          </div>
          
          <div style={{ textAlign: 'right' }}>
            <h2 style={{ fontSize: '18px', fontWeight: '700', textTransform: 'uppercase', color: 'var(--accent)', marginBottom: '8px' }}>PROPOSAL</h2>
            <div style={{ fontFamily: 'var(--font-mono)' }}>
              <div><strong>Project ID:</strong> {project.id.toUpperCase()}</div>
              <div><strong>Date:</strong> {new Date().toLocaleDateString()}</div>
              <div><strong>Valid Until:</strong> {new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toLocaleDateString()}</div>
            </div>
          </div>
        </div>

        <div style={{ borderTop: '1px solid #ddd', borderBottom: '1px solid #ddd', padding: '16px 0', marginBottom: '40px', display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
          <div>
            <strong style={{ textTransform: 'uppercase', fontSize: '10px', color: '#666', display: 'block', marginBottom: '4px' }}>Prepared For:</strong>
            <strong>{client?.name}</strong>
            {client?.company && <div>{client?.company}</div>}
            <div>{client?.address || project.name}</div>
          </div>
          <div>
            <strong style={{ textTransform: 'uppercase', fontSize: '10px', color: '#666', display: 'block', marginBottom: '4px' }}>Project Location / Scope:</strong>
            <strong>{project.name}</strong>
            {project.startDate && <div>Estimated Start: {project.startDate}</div>}
          </div>
        </div>

        {/* Room by Room scope list (Client views with markup built-in, hiding hour breakdowns) */}
        {project.rooms.map((room, roomIdx) => {
          if (room.items.length === 0) return null;
          return (
            <div key={roomIdx} style={{ marginBottom: '30px' }}>
              <h3 style={{ fontSize: '14px', fontWeight: '800', borderBottom: '1px solid #000', paddingBottom: '6px', marginBottom: '12px', textTransform: 'uppercase' }}>
                {room.name}
              </h3>
              
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid #444', textAlign: 'left' }}>
                    <th style={{ padding: '8px 4px', width: '60%' }}>Scope Item Description</th>
                    <th style={{ padding: '8px 4px', textAlign: 'center', width: '10%' }}>Qty</th>
                    <th style={{ padding: '8px 4px', textAlign: 'center', width: '10%' }}>Unit</th>
                    <th style={{ padding: '8px 4px', textAlign: 'right', width: '20%' }}>Total</th>
                  </tr>
                </thead>
                <tbody>
                  {room.items.map((item, itemIdx) => {
                    // Calculate item cost with built-in labor rate and markup
                    const itemLaborCost = item.laborHours * (project.laborRate || settings.defaultLaborRate || 85.00);
                    const itemDirect = item.materialCost + itemLaborCost;
                    const itemMarkedUp = itemDirect * (1 + (project.markupPercent !== undefined ? project.markupPercent : (settings.defaultMarkupPercent || 20.0)) / 100);
                    const totalMarkedUp = itemMarkedUp * item.quantity;
                    
                    return (
                      <tr key={itemIdx} style={{ borderBottom: '1px solid #eee' }}>
                        <td style={{ padding: '10px 4px' }}>
                          <strong style={{ fontSize: '11px', textTransform: 'uppercase', color: '#666', display: 'block' }}>{item.category}</strong>
                          {item.name}
                        </td>
                        <td style={{ padding: '10px 4px', textAlign: 'center' }}>{item.quantity}</td>
                        <td style={{ padding: '10px 4px', textAlign: 'center', color: '#666' }}>{item.unit}</td>
                        <td style={{ padding: '10px 4px', textAlign: 'right', fontFamily: 'var(--font-mono)' }}>
                          {new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(totalMarkedUp)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          );
        })}

        {/* Change Orders approved */}
        {project.changeOrders.filter(co => co.status === 'approved').length > 0 && (
          <div style={{ marginBottom: '30px' }}>
            <h3 style={{ fontSize: '14px', fontWeight: '800', borderBottom: '1px solid #000', paddingBottom: '6px', marginBottom: '12px', textTransform: 'uppercase' }}>
              Approved Change Orders
            </h3>
            
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid #444', textAlign: 'left' }}>
                  <th style={{ padding: '8px 4px', width: '80%' }}>Change Order Title & Description</th>
                  <th style={{ padding: '8px 4px', textAlign: 'right', width: '20%' }}>Total</th>
                </tr>
              </thead>
              <tbody>
                {project.changeOrders.filter(co => co.status === 'approved').map((co, coIdx) => {
                  let coMaterials = 0;
                  let coHours = 0;
                  co.items.forEach(item => {
                    coMaterials += item.materialCost * item.quantity;
                    coHours += item.laborHours * item.quantity;
                  });
                  const coDirect = coMaterials + (coHours * (project.laborRate || settings.defaultLaborRate || 85.00));
                  const coMarkedUp = coDirect * (1 + (project.markupPercent !== undefined ? project.markupPercent : (settings.defaultMarkupPercent || 20.0)) / 100);
                  const coTax = coMaterials * ((project.taxPercent !== undefined ? project.taxPercent : (settings.defaultTaxPercent || 8.25)) / 100);
                  const coTotal = coMarkedUp + coTax;

                  return (
                    <tr key={coIdx} style={{ borderBottom: '1px solid #eee' }}>
                      <td style={{ padding: '10px 4px' }}>
                        <strong>{co.title}</strong>
                        <div style={{ fontSize: '11px', color: '#666', marginTop: '2px' }}>{co.description}</div>
                      </td>
                      <td style={{ padding: '10px 4px', textAlign: 'right', fontFamily: 'var(--font-mono)', verticalAlign: 'top' }}>
                        {new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(coTotal)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Pricing Summary */}
        <div style={{ marginTop: '50px', borderTop: '2px solid #000', paddingTop: '20px', display: 'flex', justifyContent: 'flex-end' }}>
          <div style={{ width: '300px', fontSize: '13px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0' }}>
              <span>Base Project Proposal:</span>
              <span style={{ fontFamily: 'var(--font-mono)' }}>
                {new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(totals.baseTotal)}
              </span>
            </div>
            
            {totals.approvedChangeOrdersTotal > 0 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid #ddd' }}>
                <span>Approved Change Orders:</span>
                <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--accent)' }}>
                  + {new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(totals.approvedChangeOrdersTotal)}
                </span>
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 0 6px 0', fontSize: '18px', fontWeight: '800' }}>
              <span>Grand Total:</span>
              <span style={{ fontFamily: 'var(--font-mono)' }}>
                {new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(totals.netTotal)}
              </span>
            </div>
            <div style={{ fontSize: '10px', color: '#666', marginTop: '8px', textAlign: 'right' }}>
              Includes applicable sales tax.
            </div>
          </div>
        </div>

        {/* Deposit & Terms */}
        {(parseFloat(settings.depositPercent) > 0 || settings.proposalTerms) && (
          <div style={{ marginTop: '24px', fontSize: '12px', color: '#444' }}>
            {parseFloat(settings.depositPercent) > 0 && (
              <div style={{ fontWeight: '700', color: '#000', marginBottom: '6px' }}>
                Deposit due on acceptance ({settings.depositPercent}%):{' '}
                {new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(totals.netTotal * parseFloat(settings.depositPercent) / 100)}
              </div>
            )}
            {settings.proposalTerms && (
              <div style={{ whiteSpace: 'pre-line', fontSize: '11px', color: '#666' }}>{settings.proposalTerms}</div>
            )}
          </div>
        )}

        {/* Signatures */}
        <div style={{ marginTop: '100px', display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
          <div style={{ width: '45%', borderTop: '1px solid #000', paddingTop: '10px' }}>
            <strong>{settings.companyName || 'Business'} Representative</strong>
            <div style={{ color: '#666', fontSize: '11px', marginTop: '4px' }}>Signature & Date</div>
          </div>
          <div style={{ width: '45%', borderTop: '1px solid #000', paddingTop: '10px' }}>
            <strong>Client Acceptance ({client?.name})</strong>
            <div style={{ color: '#666', fontSize: '11px', marginTop: '4px' }}>Signature & Date</div>
          </div>
        </div>
      </div>
    );
  }

  // --- STANDARD ESTIMATOR VIEW ---
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      
      {/* Top action header panel */}
      <div className="panel" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 0 }}>
        <div style={{ display: 'flex', gap: '10px' }}>
          <button className="btn btn-secondary btn-sm" onClick={onClose}>
            <ArrowLeft size={14} /> Back
          </button>
          <button className="btn btn-secondary btn-sm" onClick={() => setPrintPreviewMode(true)}>
            <FileText size={14} /> Proposal Preview
          </button>
          <button className="btn btn-primary btn-sm" onClick={handleDownloadPdf}>
            <Download size={14} /> Download PDF
          </button>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
            Client: <strong>{client?.name || 'Loading client...'}</strong>
          </span>
        </div>
      </div>

      <div className="grid-2" style={{ alignItems: 'flex-start' }}>
        
        {/* LEFT COLUMN: ESTIMATING MATRIX */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          
          {/* Room Selection tabs */}
          <div className="panel" style={{ marginBottom: 0 }}>
            <div className="panel-header" style={{ marginBottom: '16px' }}>
              <h2 className="panel-title">Estimate Sections / Workstreams</h2>
              <button className="btn btn-secondary btn-sm" onClick={() => setShowAddRoom(true)}>
                <Plus size={14} /> New Section
              </button>
            </div>

            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
              {project.rooms.map((room, idx) => (
                <button
                  key={idx}
                  className={`btn btn-sm ${activeRoomIndex === idx ? 'btn-primary' : 'btn-secondary'}`}
                  onClick={() => setActiveRoomIndex(idx)}
                >
                  {room.name} ({room.items.length})
                </button>
              ))}
            </div>

            {showAddRoom && (
              <form onSubmit={handleAddRoom} style={{ marginTop: '16px', display: 'flex', gap: '10px' }}>
                <input
                  type="text"
                  className="input-field"
                  placeholder="e.g. Discovery, Design, Equipment, Delivery"
                  value={newRoomName}
                  onChange={(e) => setNewRoomName(e.target.value)}
                  style={{ flex: 1, padding: '6px 12px', fontSize: '13px' }}
                  required
                />
                <button type="submit" className="btn btn-primary btn-sm">Add</button>
                <button type="button" className="btn btn-secondary btn-sm" onClick={() => setShowAddRoom(false)}>Cancel</button>
              </form>
            )}
          </div>

          {/* Core Item List Matrix for selected room */}
          {project.rooms[activeRoomIndex] && (
            <div className="panel" style={{ marginBottom: 0 }}>
              <div className="panel-header" style={{ borderBottom: 'none', marginBottom: '8px' }}>
                <div>
                  <h2 className="panel-title">{project.rooms[activeRoomIndex].name} Scope</h2>
                  <p style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '4px' }}>
                    Edit items directly in the fields below. Values update pricing instantly.
                  </p>
                </div>
                <button 
                  className="btn btn-danger btn-sm" 
                  onClick={() => handleDeleteRoom(activeRoomIndex)}
                  disabled={project.rooms.length <= 1}
                >
                  <Trash2 size={12} /> Delete Section
                </button>
              </div>

              {/* Items Table */}
              <div className="table-container" style={{ border: '1px solid var(--border-color)', margin: '16px 0 24px 0' }}>
                <table className="app-table">
                  <thead>
                    <tr>
                      <th style={{ width: '40%' }}>Task / Scope Item</th>
                      <th style={{ width: '12%' }}>Qty</th>
                      <th style={{ width: '10%' }}>Unit</th>
                      <th style={{ width: '16%' }}>Mat Cost ($)</th>
                      <th style={{ width: '16%' }}>Service / Labor Hours</th>
                      <th style={{ width: '6%', textAlign: 'center' }}></th>
                    </tr>
                  </thead>
                  <tbody>
                    {project.rooms[activeRoomIndex].items.length === 0 ? (
                      <tr>
                        <td colSpan="6" style={{ textAlign: 'center', padding: '32px', color: 'var(--text-secondary)' }}>
                          No line items in this scope yet. Add items using the template library below or add a custom item.
                        </td>
                      </tr>
                    ) : (
                      project.rooms[activeRoomIndex].items.map((item, idx) => (
                        <tr key={item.id}>
                          <td>
                            <input 
                              type="text" 
                              className="input-field" 
                              style={{ padding: '6px', fontSize: '13px', backgroundColor: 'transparent', border: 'none' }}
                              value={item.name}
                              onChange={(e) => handleUpdateItem(activeRoomIndex, idx, 'name', e.target.value)}
                            />
                            <div style={{ fontSize: '9px', textTransform: 'uppercase', color: 'var(--text-muted)', marginLeft: '6px' }}>
                              {item.category}
                            </div>
                          </td>
                          <td>
                            <input 
                              type="number" 
                              className="input-field" 
                              style={{ padding: '6px', fontSize: '13px', textAlign: 'center', fontFamily: 'var(--font-mono)' }}
                              value={item.quantity}
                              onChange={(e) => handleUpdateItem(activeRoomIndex, idx, 'quantity', e.target.value)}
                              step="any"
                            />
                          </td>
                          <td>
                            <input 
                              type="text" 
                              className="input-field" 
                              style={{ padding: '6px', fontSize: '13px', textAlign: 'center', color: 'var(--text-secondary)' }}
                              value={item.unit}
                              onChange={(e) => handleUpdateItem(activeRoomIndex, idx, 'unit', e.target.value)}
                            />
                          </td>
                          <td>
                            <div className="input-group">
                              <span className="input-addon" style={{ padding: '0 6px', fontSize: '12px' }}>$</span>
                              <input 
                                type="number" 
                                className="input-field" 
                                style={{ padding: '6px', fontSize: '13px', fontFamily: 'var(--font-mono)' }}
                                value={item.materialCost}
                                onChange={(e) => handleUpdateItem(activeRoomIndex, idx, 'materialCost', e.target.value)}
                                step="any"
                              />
                            </div>
                          </td>
                          <td>
                            <div className="input-group">
                              <input 
                                type="number" 
                                className="input-field" 
                                style={{ padding: '6px', fontSize: '13px', fontFamily: 'var(--font-mono)' }}
                                value={item.laborHours}
                                onChange={(e) => handleUpdateItem(activeRoomIndex, idx, 'laborHours', e.target.value)}
                                step="any"
                              />
                              <span className="input-addon" style={{ padding: '0 6px', fontSize: '11px' }}>hrs</span>
                            </div>
                          </td>
                          <td style={{ textAlign: 'center' }}>
                            <button 
                              className="btn btn-secondary btn-sm" 
                              style={{ padding: '4px', borderColor: 'transparent', color: 'var(--danger)' }}
                              onClick={() => handleRemoveItem(activeRoomIndex, idx)}
                            >
                              <Trash2 size={14} />
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              {/* Inserters row */}
              <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '20px', display: 'flex', gap: '16px', flexWrap: 'wrap', alignItems: 'flex-end' }}>
                <div style={{ flex: 1, minWidth: '200px' }}>
                  <label className="form-label" style={{ fontSize: '10px' }}>Insert Template Category</label>
                  <select
                    className="input-field"
                    style={{ padding: '8px 12px', fontSize: '13px' }}
                    value={selectedCategory}
                    onChange={(e) => {
                      setSelectedCategory(e.target.value);
                      setSelectedTemplateId('');
                    }}
                  >
                    {CATEGORIES.map(c => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </div>

                <div style={{ flex: 1.5, minWidth: '240px' }}>
                  <label className="form-label" style={{ fontSize: '10px' }}>Select Scope Item</label>
                  <select
                    className="input-field"
                    style={{ padding: '8px 12px', fontSize: '13px' }}
                    value={selectedTemplateId}
                    onChange={(e) => setSelectedTemplateId(e.target.value)}
                  >
                    <option value="">-- Choose Template Item --</option>
                    {categoryTemplates.map(t => (
                      <option key={t.id} value={t.id}>
                        {t.name} (Unit: ${t.materialCost} / Time: {t.laborHours}h)
                      </option>
                    ))}
                  </select>
                </div>

                <button className="btn btn-primary btn-sm" onClick={handleInsertTemplate} disabled={!selectedTemplateId}>
                  <Plus size={14} /> Add Item
                </button>

                <button className="btn btn-secondary btn-sm" onClick={handleInsertCustomItem}>
                  Add Custom Item
                </button>
              </div>

            </div>
          )}
        </div>

        {/* RIGHT COLUMN: DYNAMIC CALCULATORS SUMMARY */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          
          {/* Parameters Setting */}
          <div className="panel">
            <h2 className="panel-title" style={{ marginBottom: '16px' }}>Project Financial Parameters</h2>
            
            <div className="form-group">
              <label className="form-label">Service / Labor Rate ($/Hour)</label>
              <div className="input-group">
                <span className="input-addon">$</span>
                <input 
                  type="number" 
                  className="input-field" 
                  value={project.laborRate !== undefined ? project.laborRate : settings.defaultLaborRate}
                  onChange={(e) => updateProjectMetric('laborRate', e.target.value)}
                  style={{ fontFamily: 'var(--font-mono)' }}
                />
              </div>
            </div>

            <div className="form-group">
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                <label className="form-label" style={{ marginBottom: 0 }}>Project Markup & Margin</label>
                <span style={{ fontSize: '12px', fontWeight: 'bold', fontFamily: 'var(--font-mono)', color: 'var(--accent)' }}>
                  {project.markupPercent !== undefined ? project.markupPercent : settings.defaultMarkupPercent}%
                </span>
              </div>
              <input 
                type="range" 
                min="0" 
                max="100" 
                step="0.5"
                value={project.markupPercent !== undefined ? project.markupPercent : settings.defaultMarkupPercent}
                onChange={(e) => updateProjectMetric('markupPercent', e.target.value)}
                style={{ width: '100%', cursor: 'pointer', accentColor: 'var(--accent)' }}
              />
              <div style={{ fontSize: '10px', color: 'var(--text-secondary)', display: 'flex', justifyContent: 'space-between', marginTop: '4px' }}>
                <span>0% Direct Cost</span>
                <span>50% Luxury Margin</span>
                <span>100% Double</span>
              </div>
            </div>

            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Material Sales Tax (%)</label>
              <div className="input-group">
                <input 
                  type="number" 
                  className="input-field" 
                  value={project.taxPercent !== undefined ? project.taxPercent : settings.defaultTaxPercent}
                  onChange={(e) => updateProjectMetric('taxPercent', e.target.value)}
                  style={{ fontFamily: 'var(--font-mono)' }}
                />
                <span className="input-addon">%</span>
              </div>
            </div>
          </div>

          {/* Pricing Ledger Card */}
          <div className="quote-totals-panel" style={{ marginTop: 0 }}>
            <h2 className="panel-title" style={{ borderBottom: '1px solid var(--border-color)', paddingBottom: '12px', marginBottom: '16px' }}>
              Pricing Estimate Summary
            </h2>
            
            <div className="totals-row">
              <span>Products / Services Subtotal:</span>
              <span style={{ fontFamily: 'var(--font-mono)' }}>
                {new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(totals.materials)}
              </span>
            </div>

            <div className="totals-row">
              <span>Service / Labor Estimate ({totals.laborHours.toFixed(1)} hrs):</span>
              <span style={{ fontFamily: 'var(--font-mono)' }}>
                {new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(totals.laborCost)}
              </span>
            </div>

            <div style={{ borderTop: '1px dashed var(--border-color)', margin: '8px 0' }}></div>

            <div className="totals-row">
              <span>Direct Project Cost:</span>
              <span style={{ fontFamily: 'var(--font-mono)', fontWeight: '600' }}>
                {new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(totals.directCost)}
              </span>
            </div>

            <div className="totals-row">
              <span>Overhead & Profit ({totals.markupPercent}%):</span>
              <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--success)' }}>
                + {new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(totals.markupAmount)}
              </span>
            </div>

            <div className="totals-row">
              <span>Taxable Items ({totals.taxPercent}%):</span>
              <span style={{ fontFamily: 'var(--font-mono)' }}>
                + {new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(totals.taxAmount)}
              </span>
            </div>

            <div className="totals-row grand-total">
              <span>Base Job Estimate:</span>
              <span style={{ fontFamily: 'var(--font-mono)' }}>
                {new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(totals.baseTotal)}
              </span>
            </div>

            {totals.approvedChangeOrdersTotal > 0 && (
              <>
                <div className="totals-row" style={{ marginTop: '12px' }}>
                  <span>Approved Change Orders:</span>
                  <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--accent)' }}>
                    + {new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(totals.approvedChangeOrdersTotal)}
                  </span>
                </div>
                
                <div className="totals-row grand-total" style={{ borderTop: '1px solid var(--border-color)', paddingTop: '10px' }}>
                  <span>Net Job Contract:</span>
                  <span style={{ fontFamily: 'var(--font-mono)' }}>
                    {new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(totals.netTotal)}
                  </span>
                </div>
              </>
            )}

            {totals.pendingChangeOrdersTotal > 0 && (
              <div style={{ marginTop: '16px', padding: '10px', backgroundColor: 'var(--accent-muted)', borderLeft: '3px solid var(--accent)', fontSize: '11px', color: 'var(--text-secondary)' }}>
                <strong>Note:</strong> There are pending change orders totaling <strong>{new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(totals.pendingChangeOrdersTotal)}</strong> not included in the totals above.
              </div>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}
