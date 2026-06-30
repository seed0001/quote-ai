import React, { useState, useMemo } from 'react';
import { CalendarDays, Plus, ChevronLeft, ChevronRight, X, Edit2, Trash2, Bell, BellOff, Mail } from 'lucide-react';
import { addTask, updateTask, deleteTask, getTasks } from '../utils/dataStore';

const STATUS_OPTIONS = [
  { value: 'todo', label: 'To Do' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'done', label: 'Completed' },
];
const STATUS_BADGE = { todo: 'badge-lead', in_progress: 'badge-quoting', done: 'badge-completed' };

const todayStr = () => new Date().toISOString().slice(0, 10);

const EMPTY_FORM = {
  title: '', description: '', date: todayStr(), time: '',
  status: 'todo', projectId: '', clientId: '',
  assigneeName: '', assigneeEmail: '',
  customerOptIn: false, reminderLeadDays: 1,
};

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export default function CalendarView({ tasks = [], projects = [], clients = [], settings = {}, onTasksChange }) {
  const [viewDate, setViewDate] = useState(() => { const d = new Date(); d.setDate(1); return d; });
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);

  const team = Array.isArray(settings.team) ? settings.team : [];
  const remindersOn = Boolean(settings.resendConfigured);

  // Tasks grouped by their date string for quick day lookups.
  const tasksByDate = useMemo(() => {
    const map = {};
    tasks.forEach(t => {
      const key = t.date || 'unscheduled';
      (map[key] = map[key] || []).push(t);
    });
    return map;
  }, [tasks]);

  const upcoming = useMemo(
    () => [...tasks]
      .filter(t => t.status !== 'done')
      .sort((a, b) => (a.date || '9999').localeCompare(b.date || '9999')),
    [tasks]
  );

  // Build the month grid: leading blanks + each day cell.
  const cells = useMemo(() => {
    const year = viewDate.getFullYear();
    const month = viewDate.getMonth();
    const firstWeekday = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const out = [];
    for (let i = 0; i < firstWeekday; i += 1) out.push(null);
    for (let day = 1; day <= daysInMonth; day += 1) {
      const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      out.push({ day, dateStr });
    }
    return out;
  }, [viewDate]);

  const projectName = (id) => projects.find(p => p.id === id)?.name || '';
  const clientName = (id) => clients.find(c => c.id === id)?.name || '';

  const handleField = (field, val) => {
    setForm(prev => {
      const next = { ...prev, [field]: val };
      // Auto-fill assignee email when a known team member is picked by name.
      if (field === 'assigneeName') {
        const member = team.find(m => m.name === val);
        if (member?.email) next.assigneeEmail = member.email;
      }
      // Linking a project pre-fills its client so customer updates can route.
      if (field === 'projectId') {
        const proj = projects.find(p => p.id === val);
        if (proj?.clientId) next.clientId = proj.clientId;
      }
      return next;
    });
  };

  const openAdd = (dateStr) => {
    setForm({ ...EMPTY_FORM, date: dateStr || todayStr() });
    setEditingId(null);
    setShowModal(true);
  };

  const openEdit = (task) => {
    setForm({
      title: task.title || '',
      description: task.description || '',
      date: task.date || todayStr(),
      time: task.time || '',
      status: task.status || 'todo',
      projectId: task.projectId || '',
      clientId: task.clientId || '',
      assigneeName: task.assigneeName || '',
      assigneeEmail: task.assigneeEmail || '',
      customerOptIn: Boolean(task.customerOptIn),
      reminderLeadDays: task.reminderLeadDays ?? 1,
    });
    setEditingId(task.id);
    setShowModal(true);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!form.title.trim()) return;
    const payload = {
      title: form.title.trim(),
      description: form.description.trim(),
      date: form.date,
      time: form.time,
      status: form.status,
      projectId: form.projectId,
      clientId: form.clientId,
      assigneeName: form.assigneeName.trim(),
      assigneeEmail: form.assigneeEmail.trim(),
      customerOptIn: Boolean(form.customerOptIn),
      reminderLeadDays: parseInt(form.reminderLeadDays, 10) || 0,
    };
    if (editingId) updateTask({ id: editingId, ...payload });
    else addTask(payload);
    onTasksChange(getTasks());
    setShowModal(false);
  };

  const quickStatus = (task, status) => {
    updateTask({ id: task.id, status });
    onTasksChange(getTasks());
  };

  const handleDelete = (id) => {
    if (window.confirm('Delete this task?')) {
      deleteTask(id);
      onTasksChange(getTasks());
    }
  };

  const monthLabel = `${MONTHS[viewDate.getMonth()]} ${viewDate.getFullYear()}`;
  const shiftMonth = (delta) => setViewDate(prev => new Date(prev.getFullYear(), prev.getMonth() + delta, 1));

  return (
    <div className="panel" style={{ display: 'flex', flexDirection: 'column', minHeight: 'calc(100vh - 130px)', marginBottom: 0 }}>
      <div className="panel-header">
        <div>
          <h2 className="panel-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <CalendarDays size={16} style={{ color: 'var(--accent)' }} /> Calendar &amp; Tasks
          </h2>
          <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px', display: 'flex', alignItems: 'center', gap: '6px' }}>
            {remindersOn ? (
              <><Bell size={12} style={{ color: 'var(--accent)' }} /> Autonomous email reminders are active.</>
            ) : (
              <><BellOff size={12} /> Add a Resend API key in Settings to enable autonomous email reminders.</>
            )}
          </div>
        </div>
        <button className="btn btn-primary btn-sm" onClick={() => openAdd()}>
          <Plus size={14} /> New Task
        </button>
      </div>

      {/* Month controls */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', margin: '16px 0' }}>
        <button className="btn btn-secondary btn-sm" onClick={() => shiftMonth(-1)}><ChevronLeft size={14} /></button>
        <div style={{ fontWeight: 600 }}>{monthLabel}</div>
        <button className="btn btn-secondary btn-sm" onClick={() => shiftMonth(1)}><ChevronRight size={14} /></button>
      </div>

      {/* Month grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '6px' }}>
        {WEEKDAYS.map(d => (
          <div key={d} style={{ textAlign: 'center', fontSize: '11px', color: 'var(--text-muted)', fontWeight: 600 }}>{d}</div>
        ))}
        {cells.map((cell, idx) => {
          if (!cell) return <div key={`b-${idx}`} />;
          const dayTasks = tasksByDate[cell.dateStr] || [];
          const isToday = cell.dateStr === todayStr();
          return (
            <div
              key={cell.dateStr}
              onClick={() => openAdd(cell.dateStr)}
              style={{
                minHeight: '84px', border: '1px solid var(--border-color)', borderRadius: '6px',
                padding: '4px 5px', cursor: 'pointer',
                background: isToday ? 'var(--bg-tertiary)' : 'transparent',
                outline: isToday ? '1px solid var(--accent)' : 'none',
              }}
            >
              <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginBottom: '2px' }}>{cell.day}</div>
              {dayTasks.slice(0, 3).map(t => (
                <div
                  key={t.id}
                  onClick={(e) => { e.stopPropagation(); openEdit(t); }}
                  title={t.title}
                  style={{
                    fontSize: '10.5px', padding: '2px 4px', marginBottom: '2px', borderRadius: '4px',
                    background: 'var(--bg-secondary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                    textDecoration: t.status === 'done' ? 'line-through' : 'none',
                    opacity: t.status === 'done' ? 0.6 : 1,
                  }}
                >
                  {t.time ? `${t.time} ` : ''}{t.title}
                </div>
              ))}
              {dayTasks.length > 3 && (
                <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>+{dayTasks.length - 3} more</div>
              )}
            </div>
          );
        })}
      </div>

      {/* Upcoming list */}
      <h3 className="panel-title" style={{ fontSize: '13px', marginTop: '24px', marginBottom: '8px' }}>Upcoming &amp; Open Tasks</h3>
      <div className="table-container" style={{ border: '1px solid var(--border-color)' }}>
        <table className="app-table" style={{ fontSize: '13px' }}>
          <thead>
            <tr>
              <th>Task</th>
              <th style={{ width: '12%' }}>Date</th>
              <th style={{ width: '14%' }}>Assignee</th>
              <th style={{ width: '14%' }}>Linked</th>
              <th style={{ width: '13%' }}>Status</th>
              <th style={{ width: '9%' }}>Customer</th>
              <th style={{ width: '8%' }}></th>
            </tr>
          </thead>
          <tbody>
            {upcoming.length === 0 ? (
              <tr><td colSpan={7} style={{ padding: '28px', textAlign: 'center', color: 'var(--text-secondary)' }}>No open tasks. Click a day or “New Task” to schedule one.</td></tr>
            ) : upcoming.map(t => (
              <tr key={t.id}>
                <td>
                  <div style={{ fontWeight: 600 }}>{t.title}</div>
                  {t.description && <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{t.description}</div>}
                </td>
                <td style={{ color: 'var(--text-secondary)' }}>{t.date || '—'}{t.time ? ` ${t.time}` : ''}</td>
                <td style={{ color: 'var(--text-secondary)' }}>{t.assigneeName || '—'}</td>
                <td style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>{projectName(t.projectId) || clientName(t.clientId) || '—'}</td>
                <td>
                  <select
                    className="input-field"
                    style={{ padding: '4px 6px', fontSize: '12px' }}
                    value={t.status || 'todo'}
                    onChange={(e) => quickStatus(t, e.target.value)}
                  >
                    {STATUS_OPTIONS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                  </select>
                </td>
                <td>
                  {t.customerOptIn
                    ? <span title="Customer receives updates" style={{ color: 'var(--accent)', display: 'inline-flex', alignItems: 'center', gap: '3px', fontSize: '11px' }}><Mail size={12} /> On</span>
                    : <span style={{ color: 'var(--text-muted)', fontSize: '11px' }}>Off</span>}
                </td>
                <td>
                  <div style={{ display: 'flex', gap: '4px', justifyContent: 'flex-end' }}>
                    <button className="btn btn-secondary btn-sm" style={{ padding: '4px 8px' }} onClick={() => openEdit(t)} title="Edit"><Edit2 size={12} /></button>
                    <button className="btn btn-secondary btn-sm" style={{ padding: '4px 8px', color: 'var(--danger)' }} onClick={() => handleDelete(t.id)} title="Delete"><Trash2 size={12} /></button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Add / Edit Modal */}
      {showModal && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <h3 className="panel-title">{editingId ? 'Edit Task' : 'New Task'}</h3>
              <button onClick={() => setShowModal(false)} style={{ cursor: 'pointer', color: 'var(--text-secondary)' }}><X size={18} /></button>
            </div>
            <form onSubmit={handleSubmit}>
              <div className="modal-body">
                <div className="form-group">
                  <label className="form-label">Task Title</label>
                  <input type="text" className="input-field" placeholder="e.g. Site visit, Deliver quote, Start demolition" value={form.title} onChange={(e) => handleField('title', e.target.value)} required />
                </div>

                <div className="grid-2">
                  <div className="form-group">
                    <label className="form-label">Date</label>
                    <input type="date" className="input-field" value={form.date} onChange={(e) => handleField('date', e.target.value)} required />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Time (optional)</label>
                    <input type="time" className="input-field" value={form.time} onChange={(e) => handleField('time', e.target.value)} />
                  </div>
                </div>

                <div className="grid-2">
                  <div className="form-group">
                    <label className="form-label">Assignee Name</label>
                    <input type="text" className="input-field" list="team-members" placeholder="Employee name" value={form.assigneeName} onChange={(e) => handleField('assigneeName', e.target.value)} />
                    <datalist id="team-members">
                      {team.map(m => <option key={m.email || m.name} value={m.name} />)}
                    </datalist>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Assignee Email</label>
                    <input type="email" className="input-field" placeholder="for reminders" value={form.assigneeEmail} onChange={(e) => handleField('assigneeEmail', e.target.value)} />
                  </div>
                </div>

                <div className="grid-2">
                  <div className="form-group">
                    <label className="form-label">Linked Project (optional)</label>
                    <select className="input-field" value={form.projectId} onChange={(e) => handleField('projectId', e.target.value)}>
                      <option value="">None</option>
                      {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Linked Customer (optional)</label>
                    <select className="input-field" value={form.clientId} onChange={(e) => handleField('clientId', e.target.value)}>
                      <option value="">None</option>
                      {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                  </div>
                </div>

                <div className="grid-2">
                  <div className="form-group">
                    <label className="form-label">Status</label>
                    <select className="input-field" value={form.status} onChange={(e) => handleField('status', e.target.value)}>
                      {STATUS_OPTIONS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Remind (days before)</label>
                    <input type="number" min="0" className="input-field" value={form.reminderLeadDays} onChange={(e) => handleField('reminderLeadDays', e.target.value)} />
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label">Notes / Description</label>
                  <textarea className="input-field" placeholder="Details for the assignee..." value={form.description} onChange={(e) => handleField('description', e.target.value)} />
                </div>

                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', cursor: 'pointer' }}>
                  <input type="checkbox" checked={form.customerOptIn} onChange={(e) => handleField('customerOptIn', e.target.checked)} />
                  Send status updates &amp; reminders to the linked customer (opt-in)
                </label>
                {form.customerOptIn && !form.clientId && (
                  <div style={{ fontSize: '11px', color: 'var(--warning, #d69e2e)', marginTop: '6px' }}>
                    Link a customer above so updates have somewhere to go.
                  </div>
                )}
              </div>

              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary">{editingId ? 'Save Task' : 'Create Task'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
