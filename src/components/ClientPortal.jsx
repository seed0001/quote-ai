import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Briefcase,
  MessageSquare,
  Sparkles,
  Send,
  CreditCard,
  CheckCircle,
  Circle,
  Clock,
  RefreshCw,
  AlertTriangle,
} from 'lucide-react';

const formatCurrency = (val) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(Number(val) || 0);

const formatDate = (iso) => {
  if (!iso) return '';
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
};

const STATUS_LABELS = {
  lead: 'New Inquiry',
  quoting: 'Preparing Quote',
  scheduled: 'Scheduled',
  progress: 'In Progress',
  completed: 'Completed',
};

// Standalone client-facing portal rendered at /portal?token=… — it deliberately
// talks ONLY to the token-scoped /api/portal endpoints, never /api/data.
export default function ClientPortal({ token }) {
  const [session, setSession] = useState(null);
  const [loadError, setLoadError] = useState('');
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('projects');
  const [paymentBanner, setPaymentBanner] = useState(null); // { kind: 'success'|'pending'|'error', text }

  // Messages tab state
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const messagesEndRef = useRef(null);

  // AI chat tab state
  const [chatHistory, setChatHistory] = useState([]);
  const [chatDraft, setChatDraft] = useState('');
  const [chatBusy, setChatBusy] = useState(false);
  const chatEndRef = useRef(null);

  const loadSession = useCallback(async () => {
    try {
      const res = await fetch(`/api/portal/session?token=${encodeURIComponent(token)}`, { cache: 'no-store' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Unable to load your portal.');
      setSession(data);
      setLoadError('');
    } catch (e) {
      setLoadError(e.message);
    } finally {
      setLoading(false);
    }
  }, [token]);

  // On first load: if we just came back from Stripe, verify the payment with
  // the server before rendering, then clean the URL.
  useEffect(() => {
    const boot = async () => {
      const params = new URLSearchParams(window.location.search);
      const paidSession = params.get('paid_session');
      if (paidSession) {
        try {
          const res = await fetch('/api/portal/verify-payment', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ token, sessionId: paidSession }),
          });
          const data = await res.json();
          if (res.ok && data.paid) {
            setPaymentBanner({ kind: 'success', text: 'Payment received — thank you! Your milestone is now marked as paid.' });
          } else if (res.ok) {
            setPaymentBanner({ kind: 'pending', text: 'Your payment is still processing. It will be reflected here once it clears.' });
          } else {
            setPaymentBanner({ kind: 'error', text: data.error || 'We could not confirm the payment. Please contact us.' });
          }
        } catch {
          setPaymentBanner({ kind: 'error', text: 'We could not confirm the payment. Please contact us.' });
        }
        window.history.replaceState(null, '', `/portal?token=${encodeURIComponent(token)}`);
      }
      await loadSession();
    };
    boot();
  }, [token, loadSession]);

  // Light polling keeps the message thread fresh while the portal is open.
  const sessionLoaded = Boolean(session);
  useEffect(() => {
    if (!sessionLoaded) return undefined;
    const timer = setInterval(async () => {
      try {
        const res = await fetch(`/api/portal/messages?token=${encodeURIComponent(token)}`, { cache: 'no-store' });
        if (!res.ok) return;
        const data = await res.json();
        setSession((current) => (current ? { ...current, messages: data.messages } : current));
      } catch {
        /* transient network hiccup — next poll retries */
      }
    }, 45000);
    return () => clearInterval(timer);
  }, [sessionLoaded, token]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [session?.messages?.length, activeTab]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatHistory.length, chatBusy]);

  const sendMessage = async (e) => {
    e.preventDefault();
    const text = draft.trim();
    if (!text || sending) return;
    setSending(true);
    try {
      const res = await fetch('/api/portal/message', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, text }),
      });
      const saved = await res.json();
      if (!res.ok) throw new Error(saved.error || 'Message failed to send.');
      setSession((current) => ({ ...current, messages: [...(current.messages || []), saved] }));
      setDraft('');
    } catch (err) {
      alert(err.message);
    } finally {
      setSending(false);
    }
  };

  const sendChat = async (e) => {
    e.preventDefault();
    const text = chatDraft.trim();
    if (!text || chatBusy) return;
    const nextHistory = [...chatHistory, { role: 'user', content: text }];
    setChatHistory(nextHistory);
    setChatDraft('');
    setChatBusy(true);
    try {
      const res = await fetch('/api/portal/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, messages: nextHistory }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'The assistant is unavailable.');
      setChatHistory((h) => [...h, { role: 'assistant', content: data.reply || '(no reply)' }]);
    } catch (err) {
      setChatHistory((h) => [...h, { role: 'assistant', content: `Sorry — ${err.message}`, error: true }]);
    } finally {
      setChatBusy(false);
    }
  };

  const payMilestone = async (projectId, milestoneId) => {
    try {
      const res = await fetch('/api/portal/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, projectId, milestoneId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Unable to start checkout.');
      window.location.href = data.url;
    } catch (err) {
      alert(err.message);
    }
  };

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-secondary)' }}>
        Loading your portal…
      </div>
    );
  }

  if (loadError || !session) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px' }}>
        <div className="panel" style={{ maxWidth: '440px', textAlign: 'center' }}>
          <AlertTriangle size={32} style={{ color: 'var(--danger, #e53e3e)', margin: '0 auto 12px' }} />
          <h2 style={{ fontSize: '18px', fontWeight: 700, marginBottom: '8px' }}>Portal unavailable</h2>
          <p style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
            {loadError || 'This portal link is invalid or has been disabled.'} If you believe this is a mistake,
            please contact us for a fresh link.
          </p>
        </div>
      </div>
    );
  }

  const { business, client, projects, messages } = session;

  const tabButton = (id, icon, label) => (
    <button
      className="btn btn-secondary"
      style={{
        borderBottom: activeTab === id ? '2px solid var(--accent)' : 'none',
        backgroundColor: activeTab === id ? 'var(--bg-secondary)' : 'transparent',
        borderColor: 'transparent',
        display: 'flex',
        alignItems: 'center',
        gap: '6px',
      }}
      onClick={() => setActiveTab(id)}
    >
      {icon} {label}
    </button>
  );

  return (
    <div style={{ minHeight: '100vh', backgroundColor: 'var(--bg-primary)' }}>
      <div style={{ maxWidth: '960px', margin: '0 auto', padding: '24px 16px 64px' }}>
        {/* HEADER */}
        <header style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px', marginBottom: '24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            {business.companyLogo ? (
              <img src={business.companyLogo} alt="" style={{ height: '40px', width: '40px', objectFit: 'contain' }} />
            ) : (
              <Briefcase size={28} style={{ color: 'var(--accent)' }} />
            )}
            <div>
              <div style={{ fontSize: '18px', fontWeight: 700 }}>{business.companyName}</div>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '1px' }}>
                Client Portal
              </div>
            </div>
          </div>
          <div style={{ textAlign: 'right', fontSize: '13px', color: 'var(--text-secondary)' }}>
            Welcome back, <strong style={{ color: 'var(--text-primary)' }}>{client.name}</strong>
            {client.company ? <div style={{ fontSize: '11px' }}>{client.company}</div> : null}
          </div>
        </header>

        {/* PAYMENT RESULT BANNER */}
        {paymentBanner && (
          <div
            className="panel"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              marginBottom: '20px',
              borderLeft: `3px solid ${paymentBanner.kind === 'success' ? 'var(--success, #38a169)' : paymentBanner.kind === 'pending' ? 'var(--accent)' : 'var(--danger, #e53e3e)'}`,
            }}
          >
            {paymentBanner.kind === 'success' ? <CheckCircle size={18} style={{ color: 'var(--success, #38a169)' }} /> : <Clock size={18} />}
            <span style={{ fontSize: '13px' }}>{paymentBanner.text}</span>
          </div>
        )}

        {/* TABS */}
        <div style={{ display: 'flex', borderBottom: '1px solid var(--border-color)', marginBottom: '24px' }}>
          {tabButton('projects', <Briefcase size={15} />, `Your Projects (${projects.length})`)}
          {tabButton('messages', <MessageSquare size={15} />, 'Messages')}
          {session.aiEnabled && tabButton('chat', <Sparkles size={15} />, 'Ask our AI')}
        </div>

        {/* PROJECTS TAB */}
        {activeTab === 'projects' && (
          projects.length === 0 ? (
            <div className="panel" style={{ textAlign: 'center', color: 'var(--text-secondary)', fontSize: '13px' }}>
              No projects yet. Once we start working together, everything will show up here.
            </div>
          ) : (
            projects.map((p) => {
              const paidTotal = p.milestones.filter((m) => m.status === 'paid').reduce((s, m) => s + m.amount, 0);
              const dueTotal = p.milestones.filter((m) => m.status !== 'paid').reduce((s, m) => s + m.amount, 0);
              return (
                <div key={p.id} className="panel" style={{ marginBottom: '20px' }}>
                  <div className="panel-header" style={{ marginBottom: '12px' }}>
                    <div>
                      <h2 className="panel-title" style={{ fontSize: '15px' }}>{p.name}</h2>
                      {(p.startDate || p.endDate) && (
                        <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px', fontFamily: 'var(--font-mono)' }}>
                          {p.startDate && <>Start: {p.startDate}</>} {p.endDate && <> · Target: {p.endDate}</>}
                        </div>
                      )}
                    </div>
                    <span className={`badge badge-${p.status}`}>{STATUS_LABELS[p.status] || p.status}</span>
                  </div>

                  {p.summary && (
                    <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '16px', whiteSpace: 'pre-wrap' }}>
                      {p.summary}
                    </p>
                  )}

                  {p.checklistProgress.total > 0 && (
                    <div style={{ marginBottom: '16px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: 'var(--text-muted)', marginBottom: '4px' }}>
                        <span>WORK PROGRESS</span>
                        <span>{p.checklistProgress.done} / {p.checklistProgress.total} steps</span>
                      </div>
                      <div style={{ height: '6px', backgroundColor: 'var(--border-color)' }}>
                        <div style={{ height: '100%', width: `${Math.round((p.checklistProgress.done / p.checklistProgress.total) * 100)}%`, backgroundColor: 'var(--accent)' }} />
                      </div>
                    </div>
                  )}

                  {/* MILESTONES / PAYMENTS */}
                  {p.milestones.length > 0 && (
                    <div style={{ border: '1px solid var(--border-color)', padding: '16px', marginBottom: '16px', backgroundColor: 'var(--bg-secondary)' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                        <h3 style={{ fontSize: '12px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                          Payment Milestones
                        </h3>
                        <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                          Paid {formatCurrency(paidTotal)} · Remaining {formatCurrency(dueTotal)}
                        </div>
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                        {p.milestones.map((m) => (
                          <div key={m.id} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '10px 12px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-primary)' }}>
                            {m.status === 'paid'
                              ? <CheckCircle size={18} style={{ color: 'var(--success, #38a169)', flexShrink: 0 }} />
                              : <Circle size={18} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />}
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ fontSize: '13px', fontWeight: 600 }}>{m.name}</div>
                              {m.description && <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>{m.description}</div>}
                              {m.status === 'paid' && m.paidAt && (
                                <div style={{ fontSize: '11px', color: 'var(--success, #38a169)' }}>Paid {formatDate(m.paidAt)}</div>
                              )}
                            </div>
                            <div style={{ fontFamily: 'var(--font-mono)', fontWeight: 600, fontSize: '13px' }}>
                              {formatCurrency(m.amount)}
                            </div>
                            {m.status !== 'paid' && m.amount > 0 && session.paymentsEnabled && (
                              <button className="btn btn-primary btn-sm" onClick={() => payMilestone(p.id, m.id)}>
                                <CreditCard size={13} /> Pay now
                              </button>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* PHOTOS */}
                  {p.photos.length > 0 && (
                    <div style={{ marginBottom: '16px' }}>
                      <h3 style={{ fontSize: '12px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '10px' }}>
                        Photos
                      </h3>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: '10px' }}>
                        {p.photos.map((ph) => (
                          <figure key={ph.id} style={{ margin: 0 }}>
                            <img src={ph.url} alt={ph.title} style={{ width: '100%', height: '110px', objectFit: 'cover', border: '1px solid var(--border-color)' }} />
                            <figcaption style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>
                              {ph.title} {ph.date ? `· ${ph.date}` : ''}
                            </figcaption>
                          </figure>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* ACTIVITY LOG */}
                  {p.logs.length > 0 && (
                    <div>
                      <h3 style={{ fontSize: '12px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '10px' }}>
                        Latest Updates
                      </h3>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '260px', overflowY: 'auto' }}>
                        {[...p.logs].reverse().map((log) => (
                          <div key={log.id} style={{ fontSize: '12px', borderLeft: '2px solid var(--border-color)', paddingLeft: '10px' }}>
                            <div style={{ color: 'var(--text-muted)', fontSize: '10px', fontFamily: 'var(--font-mono)' }}>{formatDate(log.timestamp)}</div>
                            <div style={{ color: 'var(--text-secondary)', whiteSpace: 'pre-wrap' }}>{log.message}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              );
            })
          )
        )}

        {/* MESSAGES TAB */}
        {activeTab === 'messages' && (
          <div className="panel" style={{ display: 'flex', flexDirection: 'column', height: '60vh' }}>
            <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '10px', paddingBottom: '12px' }}>
              {(messages || []).length === 0 ? (
                <div style={{ textAlign: 'center', color: 'var(--text-secondary)', fontSize: '13px', marginTop: '40px' }}>
                  Questions, requests, or updates for us? Send a message below — we get notified right away.
                </div>
              ) : (
                messages.map((m) => (
                  <div
                    key={m.id}
                    style={{
                      alignSelf: m.from === 'client' ? 'flex-end' : 'flex-start',
                      maxWidth: '75%',
                      padding: '10px 14px',
                      fontSize: '13px',
                      whiteSpace: 'pre-wrap',
                      backgroundColor: m.from === 'client' ? 'var(--accent)' : 'var(--bg-secondary)',
                      color: m.from === 'client' ? '#fff' : 'var(--text-primary)',
                      border: m.from === 'client' ? 'none' : '1px solid var(--border-color)',
                    }}
                  >
                    <div style={{ fontSize: '10px', opacity: 0.7, marginBottom: '4px' }}>
                      {m.from === 'client' ? 'You' : business.companyName} · {formatDate(m.timestamp)}
                    </div>
                    {m.text}
                  </div>
                ))
              )}
              <div ref={messagesEndRef} />
            </div>
            <form onSubmit={sendMessage} style={{ display: 'flex', gap: '8px', borderTop: '1px solid var(--border-color)', paddingTop: '12px' }}>
              <input
                className="input-field"
                style={{ flex: 1 }}
                placeholder="Write a message to our team…"
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                maxLength={4000}
              />
              <button type="submit" className="btn btn-primary" disabled={sending || !draft.trim()}>
                {sending ? <RefreshCw size={14} className="spin" /> : <Send size={14} />} Send
              </button>
            </form>
          </div>
        )}

        {/* AI CHAT TAB */}
        {activeTab === 'chat' && session.aiEnabled && (
          <div className="panel" style={{ display: 'flex', flexDirection: 'column', height: '60vh' }}>
            <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '10px', paddingBottom: '12px' }}>
              {chatHistory.length === 0 && (
                <div style={{ textAlign: 'center', color: 'var(--text-secondary)', fontSize: '13px', marginTop: '40px' }}>
                  <Sparkles size={20} style={{ color: 'var(--accent)', marginBottom: '8px' }} />
                  <div>Ask about your project status, our services, or what happens next.</div>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '6px' }}>
                    The assistant can't make bookings or commitments — use Messages for that.
                  </div>
                </div>
              )}
              {chatHistory.map((m, i) => (
                <div
                  key={i}
                  style={{
                    alignSelf: m.role === 'user' ? 'flex-end' : 'flex-start',
                    maxWidth: '80%',
                    padding: '10px 14px',
                    fontSize: '13px',
                    whiteSpace: 'pre-wrap',
                    backgroundColor: m.role === 'user' ? 'var(--accent)' : 'var(--bg-secondary)',
                    color: m.role === 'user' ? '#fff' : m.error ? 'var(--danger, #e53e3e)' : 'var(--text-primary)',
                    border: m.role === 'user' ? 'none' : '1px solid var(--border-color)',
                  }}
                >
                  {m.content}
                </div>
              ))}
              {chatBusy && (
                <div style={{ alignSelf: 'flex-start', fontSize: '12px', color: 'var(--text-muted)', padding: '6px 2px' }}>
                  Thinking…
                </div>
              )}
              <div ref={chatEndRef} />
            </div>
            <form onSubmit={sendChat} style={{ display: 'flex', gap: '8px', borderTop: '1px solid var(--border-color)', paddingTop: '12px' }}>
              <input
                className="input-field"
                style={{ flex: 1 }}
                placeholder="Ask the assistant anything about your project…"
                value={chatDraft}
                onChange={(e) => setChatDraft(e.target.value)}
                maxLength={4000}
                disabled={chatBusy}
              />
              <button type="submit" className="btn btn-primary" disabled={chatBusy || !chatDraft.trim()}>
                <Send size={14} /> Ask
              </button>
            </form>
          </div>
        )}

        <footer style={{ marginTop: '32px', textAlign: 'center', fontSize: '11px', color: 'var(--text-muted)' }}>
          {business.companyName}
          {business.phone ? ` · ${business.phone}` : ''}
          {business.email ? ` · ${business.email}` : ''}
        </footer>
      </div>
    </div>
  );
}
