import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  ArrowRight,
  BriefcaseBusiness,
  CalendarDays,
  Check,
  CheckCircle2,
  Circle,
  Clock3,
  Cpu,
  CreditCard,
  Hammer,
  Home,
  LoaderCircle,
  LockKeyhole,
  LogOut,
  Mail,
  MapPin,
  Menu,
  MessageCircle,
  Phone,
  Plus,
  Send,
  ShieldCheck,
  Sparkles,
  Users,
  Wrench,
  X,
} from 'lucide-react'
import workshopHero from './workshop-hero.png'
import serviceHome from './assets/service-home.jpg'
import serviceAuto from './assets/service-auto.jpg'
import serviceTech from './assets/service-tech.jpg'

const STATUS_LABELS = {
  lead: 'New inquiry',
  quoting: 'Quote in progress',
  scheduled: 'Scheduled',
  progress: 'In progress',
  completed: 'Completed',
}

const formatCurrency = (value) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(Number(value) || 0)

const formatDate = (value, withTime = false) => {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleString(undefined, withTime
    ? { dateStyle: 'medium', timeStyle: 'short' }
    : { dateStyle: 'medium' })
}

const POST_TAGS = {
  project: 'Project highlight',
  roadmap: 'Roadmap',
  news: 'News',
}

const bootPaidSession = new URLSearchParams(window.location.search).get('paid_session') || ''
if (bootPaidSession) window.history.replaceState(null, '', '/')

// Custom mark: a hex nut (automotive/hardware) holding a roofline (home)
// whose post branches into circuit nodes (technology) — the three trades.
function LogoMark({ size = 24 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" fill="none" aria-hidden="true">
      <path d="M44 24 L34 41.32 L14 41.32 L4 24 L14 6.68 L34 6.68 Z" stroke="currentColor" strokeWidth="2.5" strokeLinejoin="round" />
      <path d="M11 21 L24 12 L37 21" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M24 15.5 V30.5" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
      <path d="M17.5 25 H30.5" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
      <circle cx="15" cy="25" r="2.2" fill="currentColor" />
      <circle cx="33" cy="25" r="2.2" fill="currentColor" />
      <circle cx="24" cy="33.5" r="2.2" fill="currentColor" />
    </svg>
  )
}

function BrandMark({ compact = false }) {
  return (
    <div className={`brand-mark ${compact ? 'brand-mark--compact' : ''}`} aria-label="Travis's Creations">
      <span className="brand-mark__icon"><LogoMark size={compact ? 21 : 26} /></span>
      <span>
        <strong>TRAVIS'S</strong>
        <small>CREATIONS</small>
      </span>
    </div>
  )
}

function ServiceStrip() {
  return (
    <div className="service-strip">
      <span><Hammer size={16} /> Home & remodel</span>
      <span><Wrench size={16} /> Automotive</span>
      <span><Cpu size={16} /> Technology</span>
    </div>
  )
}

function PostCard({ post, full = false }) {
  const paragraphs = (post.body || '').split(/\n\s*\n/).filter(Boolean)
  return (
    <article className="post-card">
      <div className="post-card__meta">
        <span className={`post-tag post-tag--${post.tag || 'news'}`}>{POST_TAGS[post.tag] || 'News'}</span>
        {post.date && <time>{formatDate(post.date)}</time>}
      </div>
      <h3>{post.title}</h3>
      {(full ? paragraphs : paragraphs.slice(0, 2)).map((paragraph, index) => <p key={index}>{paragraph}</p>)}
      {!full && paragraphs.length > 2 && <p className="post-card__more">…</p>}
      {(post.images || []).length > 0 && (
        <div className="post-card__photos">
          {post.images.map((image) => <img key={image.id} src={image.url} alt="" loading="lazy" />)}
        </div>
      )}
    </article>
  )
}

function PublicSite({ onSignIn }) {
  const [site, setSite] = useState(null)
  const [page, setPage] = useState('home')
  const [lead, setLead] = useState({ name: '', email: '', phone: '', interest: '', message: '' })
  const [leadBusy, setLeadBusy] = useState(false)
  const [leadDone, setLeadDone] = useState(false)
  const [leadError, setLeadError] = useState('')
  const [selection, setSelection] = useState({}) // catalog item id -> quantity

  useEffect(() => {
    fetch('/api/public/site')
      .then((response) => response.json())
      .then(setSite)
      .catch(() => setSite({ business: {}, catalog: [] }))
  }, [])

  const business = site?.business || {}
  const catalog = site?.catalog || []
  const posts = site?.posts || []
  const categories = [...new Set(catalog.map((item) => item.category || 'Services'))]

  // Nav works from both pages: jump home first if needed, then scroll.
  const goAnchor = (id) => {
    if (page !== 'home') {
      setPage('home')
      setTimeout(() => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' }), 60)
    } else {
      document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' })
    }
  }

  const goWorkshop = () => {
    setPage('workshop')
    window.scrollTo(0, 0)
  }

  // ---- Build-your-own quote request ----
  const selectedItems = Object.entries(selection)
    .map(([id, qty]) => {
      const item = catalog.find((entry) => entry.id === id)
      return item ? { ...item, qty } : null
    })
    .filter(Boolean)

  const estimateTotal = selectedItems.reduce((sum, item) => sum + (Number(item.price) > 0 ? Number(item.price) * item.qty : 0), 0)
  const hasQuotedOnly = selectedItems.some((item) => !(Number(item.price) > 0))

  const toggleItem = (id) => {
    setSelection((current) => {
      const next = { ...current }
      if (next[id]) delete next[id]
      else next[id] = 1
      return next
    })
  }

  const setItemQty = (id, qty) => {
    const clean = Math.min(Math.max(Math.round(Number(qty)) || 1, 1), 999)
    setSelection((current) => ({ ...current, [id]: clean }))
  }

  const setField = (field) => (event) => setLead((current) => ({ ...current, [field]: event.target.value }))

  const submitLead = async (event) => {
    event.preventDefault()
    if (leadBusy) return
    setLeadBusy(true)
    setLeadError('')
    try {
      const response = await fetch('/api/public/lead', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...lead,
          items: Object.entries(selection).map(([id, qty]) => ({ id, qty })),
        }),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Something went wrong — please try again.')
      setLeadDone(true)
      setSelection({})
    } catch (error) {
      setLeadError(error.message)
    } finally {
      setLeadBusy(false)
    }
  }

  return (
    <div className="site-shell">
      <header className="site-header">
        <BrandMark compact />
        <nav className="site-nav">
          <button onClick={() => goAnchor('services')}>Services</button>
          <button onClick={() => goAnchor('catalog')}>Pricing</button>
          <button className={page === 'workshop' ? 'active' : ''} onClick={goWorkshop}>Workshop</button>
          <button onClick={() => goAnchor('quote')}>Request a quote</button>
        </nav>
        <button className="site-signin" onClick={onSignIn}><LockKeyhole size={15} /> Client sign in</button>
      </header>

      {page === 'workshop' ? (
        <section className="site-section">
          <div className="site-section__head">
            <span className="eyebrow">From the workshop</span>
            <h2>Projects, roadmap & news</h2>
            <p>What we're building, what we just finished, and what's coming next.</p>
          </div>
          {posts.length ? (
            <div className="post-list">
              {posts.map((post) => <PostCard post={post} full key={post.id} />)}
            </div>
          ) : (
            <p className="catalog-empty">Nothing posted yet — check back soon.</p>
          )}
        </section>
      ) : (
      <>
      <section className="site-hero" style={{ backgroundImage: `url(${workshopHero})` }}>
        <div className="site-hero__shade" />
        <div className="site-hero__content">
          <span className="eyebrow eyebrow--light">Built. Fixed. Connected.</span>
          <h1>One capable partner.<br />Whatever the project.</h1>
          <p>{business.businessDescription || 'Handyman, automotive, and technology services — one partner from the first conversation to the final handoff.'}</p>
          <div className="site-hero__actions">
            <a className="hero-action hero-action--inline" href="#quote">Request a free quote <ArrowRight size={18} /></a>
            <ServiceStrip />
          </div>
        </div>
      </section>

      <section className="site-section" id="services">
        <div className="site-section__head">
          <span className="eyebrow">What we do</span>
          <h2>Three trades. One standard of work.</h2>
        </div>
        <div className="service-cards">
          <div className="service-card">
            <div className="service-card__img"><img src={serviceHome} alt="Remodel work in progress with a drill on site" loading="lazy" /></div>
            <div className="service-card__body">
              <h3>Home & remodel</h3>
              <p>Repairs, upgrades, installs, and remodel work — planned clearly and done right.</p>
            </div>
          </div>
          <div className="service-card">
            <div className="service-card__img"><img src={serviceAuto} alt="Engine bay with belts and pulleys during service" loading="lazy" /></div>
            <div className="service-card__body">
              <h3>Automotive</h3>
              <p>Diagnostics, brakes, cooling systems, fluid service, and general repair.</p>
            </div>
          </div>
          <div className="service-card">
            <div className="service-card__img"><img src={serviceTech} alt="Close-up of a computer circuit board" loading="lazy" /></div>
            <div className="service-card__body">
              <h3>Technology</h3>
              <p>PC builds and repair, smart home setups, and practical tech support.</p>
            </div>
          </div>
        </div>
      </section>

      <section className="site-section site-section--alt" id="catalog">
        <div className="site-section__head">
          <span className="eyebrow">Straightforward pricing</span>
          <h2>Services & rates</h2>
          <p>Real rates from our live catalog. Add the services you need to build a quote request, then tell us about your project below — we'll follow up with a written quote.</p>
        </div>
        {catalog.length ? (
          <div className="catalog-groups">
            {categories.map((category) => (
              <div className="catalog-group" key={category}>
                <h3>{category}</h3>
                <div className="catalog-items">
                  {catalog.filter((item) => (item.category || 'Services') === category).map((item) => (
                    <div className="catalog-item" key={item.id}>
                      <strong>{item.name}</strong>
                      <span>{Number(item.price) > 0 ? <>from <b>{formatCurrency(item.price)}</b>{item.unit ? ` / ${item.unit}` : ''}</> : 'quoted'}</span>
                      {item.description && <p>{item.description}</p>}
                      <div className="catalog-item__actions">
                        {selection[item.id] ? (
                          <button className="pick-btn pick-btn--on" onClick={() => toggleItem(item.id)}>
                            <Check size={14} /> Added to request — remove
                          </button>
                        ) : (
                          <button className="pick-btn" onClick={() => toggleItem(item.id)}>
                            <Plus size={14} /> Add to quote request
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="catalog-empty">Our full rate list is being published — tell us what you need below and we'll quote it.</p>
        )}
      </section>

      {posts.length > 0 && (
        <section className="site-section">
          <div className="site-section__head">
            <span className="eyebrow">From the workshop</span>
            <h2>Recent work & updates</h2>
          </div>
          <div className="post-list post-list--grid">
            {posts.slice(0, 2).map((post) => <PostCard post={post} key={post.id} />)}
          </div>
          <button className="see-all-posts" onClick={goWorkshop}>See all updates <ArrowRight size={16} /></button>
        </section>
      )}

      <section className="site-section site-section--alt" id="quote">
        <div className="lead-panel">
          <div className="lead-panel__pitch">
            <span className="eyebrow">Start a project</span>
            <h2>Tell us what you need.</h2>
            <p>Describe the job and how to reach you. You'll hear back with next steps and a clear quote — no obligation.</p>
            <div className="contact-details">
              {business.phone && <a href={`tel:${business.phone}`}><Phone size={15} /> {business.phone}</a>}
              {business.email && <a href={`mailto:${business.email}`}><Mail size={15} /> {business.email}</a>}
              <span><MapPin size={15} /> Oklahoma</span>
            </div>
          </div>

          {leadDone ? (
            <div className="lead-success">
              <CheckCircle2 size={30} />
              <h3>Request received.</h3>
              <p>Thanks, {lead.name.split(' ')[0] || 'friend'} — we'll reach out shortly to talk through your project.</p>
            </div>
          ) : (
            <form className="lead-form" onSubmit={submitLead}>
              {selectedItems.length > 0 ? (
                <div className="request-items">
                  <div className="request-items__head">Your selected services</div>
                  {selectedItems.map((item) => (
                    <div className="request-item" key={item.id}>
                      <div className="request-item__name">
                        <strong>{item.name}</strong>
                        {item.unit && <small>per {item.unit}</small>}
                      </div>
                      <input
                        type="number"
                        min="1"
                        max="999"
                        value={item.qty}
                        onChange={(event) => setItemQty(item.id, event.target.value)}
                        aria-label={`Quantity for ${item.name}`}
                      />
                      <span>{Number(item.price) > 0 ? formatCurrency(item.price * item.qty) : 'quoted'}</span>
                      <button type="button" onClick={() => toggleItem(item.id)} aria-label={`Remove ${item.name}`}><X size={15} /></button>
                    </div>
                  ))}
                  <div className="request-items__total">
                    <span>Starting estimate{hasQuotedOnly ? ' (plus quoted items)' : ''}</span>
                    <strong>{formatCurrency(estimateTotal)}{hasQuotedOnly ? '+' : ''}</strong>
                  </div>
                  <small className="request-items__note">
                    A starting point, not a bill — you'll get a written quote before any work begins.
                  </small>
                </div>
              ) : (
                <div className="request-items request-items--empty">
                  Tip: add services from the catalog above and they'll attach to your request.
                </div>
              )}

              <label className="field">
                <span>Your name</span>
                <div className="field__control"><Users size={17} /><input value={lead.name} onChange={setField('name')} placeholder="Jane Smith" required /></div>
              </label>
              <div className="lead-form__row">
                <label className="field">
                  <span>Email</span>
                  <div className="field__control"><Mail size={17} /><input type="email" value={lead.email} onChange={setField('email')} placeholder="you@example.com" /></div>
                </label>
                <label className="field">
                  <span>Phone</span>
                  <div className="field__control"><Phone size={17} /><input value={lead.phone} onChange={setField('phone')} placeholder="(555) 555-0100" /></div>
                </label>
              </div>
              <label className="field">
                <span>What do you need?</span>
                <div className="field__control">
                  <Wrench size={17} />
                  <select value={lead.interest} onChange={setField('interest')}>
                    <option value="">Choose a service…</option>
                    {(categories.length ? categories : ['Home & remodel', 'Automotive', 'Technology']).map((category) => (
                      <option key={category} value={category}>{category}</option>
                    ))}
                    <option value="Something else">Something else</option>
                  </select>
                </div>
              </label>
              <label className="field">
                <span>Tell us about the job</span>
                <textarea className="lead-form__message" value={lead.message} onChange={setField('message')} rows={4} placeholder="What's going on, and when do you need it done?" />
              </label>
              {leadError && <div className="form-error">{leadError}</div>}
              <button className="primary-action" type="submit" disabled={leadBusy}>
                {leadBusy ? <LoaderCircle className="spin" size={18} /> : <>Send my request <Send size={17} /></>}
              </button>
            </form>
          )}
        </div>
      </section>

      {selectedItems.length > 0 && !leadDone && (
        <div className="request-bar">
          <span>
            <strong>{selectedItems.length}</strong> service{selectedItems.length === 1 ? '' : 's'} in your quote request
            {estimateTotal > 0 && <> · from {formatCurrency(estimateTotal)}{hasQuotedOnly ? '+' : ''}</>}
          </span>
          <button onClick={() => goAnchor('quote')}>Review & send <ArrowRight size={15} /></button>
        </div>
      )}
      </>
      )}

      <footer className="site-footer">
        <BrandMark compact />
        <p>Craftsmanship meets practical technology.</p>
        <span>© {new Date().getFullYear()} {business.companyName || "Travis's Creations"}</span>
      </footer>
    </div>
  )
}

function Login({ email, setEmail, password, setPassword, error, busy, onSubmit, googleEnabled, googleButtonRef, onBack }) {
  return (
    <main className="login-page">
      <section className="login-story" style={{ backgroundImage: `url(${workshopHero})` }}>
        <div className="login-story__shade" />
        <div className="login-story__top"><BrandMark /></div>
        <div className="login-story__copy">
          <span className="eyebrow eyebrow--light">Built. Fixed. Connected.</span>
          <h1>One capable partner.<br />Whatever the project.</h1>
          <p>
            Follow the work, see what comes next, share details, and stay connected
            with Travis's Creations from the first conversation through the final handoff.
          </p>
          <ServiceStrip />
        </div>
        <div className="login-story__foot">
          <span><MapPin size={14} /> Oklahoma</span>
          <span>Craftsmanship meets practical technology.</span>
        </div>
      </section>

      <section className="login-access">
        <div className="mobile-brand"><BrandMark /></div>
        <button type="button" className="login-back" onClick={onBack}>← Back to the website</button>
        <form className="login-card" onSubmit={onSubmit}>
          <span className="eyebrow">Private client access</span>
          <h2>Welcome back.</h2>
          <p className="login-card__intro">Sign in to see your project, updates, messages, and payments.</p>

          <label className="field">
            <span>Email address</span>
            <div className="field__control">
              <Mail size={17} />
              <input
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                autoComplete="email"
                placeholder="you@example.com"
                required
              />
            </div>
          </label>

          <label className="field">
            <span>Password</span>
            <div className="field__control">
              <ShieldCheck size={17} />
              <input
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                autoComplete="current-password"
                placeholder="Your portal password"
                required
              />
            </div>
          </label>

          {error && <div className="form-error">{error}</div>}

          <button className="primary-action" type="submit" disabled={busy}>
            {busy ? <LoaderCircle className="spin" size={18} /> : <>Open my portal <ArrowRight size={18} /></>}
          </button>

          {googleEnabled && (
            <div className="google-access">
              <div className="login-divider"><span>or continue with</span></div>
              <div className="google-button" ref={googleButtonRef} />
            </div>
          )}

          <div className="login-help">
            <strong>Need access or forgot your password?</strong>
            <span>Contact Travis and we'll get you taken care of.</span>
          </div>
        </form>
        <p className="access-note"><ShieldCheck size={14} /> Your project information is private and securely protected.</p>
      </section>
    </main>
  )
}

function AdminPortal({ session, onLogout }) {
  const { admin, business, stats, clients, projects, recentMessages } = session
  return (
    <div className="admin-shell">
      <header className="admin-header">
        <BrandMark compact />
        <span className="admin-badge"><LockKeyhole size={14} /> Administrator</span>
        <div className="admin-account">
          <div><strong>{admin.name || 'Administrator'}</strong><small>{admin.email}</small></div>
          <button onClick={onLogout}><LogOut size={17} /> Sign out</button>
        </div>
      </header>

      <main className="admin-main">
        <section className="admin-welcome">
          <div><span className="eyebrow">Business command center</span><h1>{business.companyName || "Travis's Creations"}</h1><p>Customer portal activity, project visibility, and client communication at a glance.</p></div>
          <span className="admin-secure"><ShieldCheck size={18} /> Secure administrator session</span>
        </section>

        <section className="admin-stats">
          <div><span><Users size={20} /></span><small>Active clients</small><strong>{stats.clients}</strong></div>
          <div><span><BriefcaseBusiness size={20} /></span><small>All projects</small><strong>{stats.projects}</strong></div>
          <div><span><Wrench size={20} /></span><small>Active projects</small><strong>{stats.activeProjects}</strong></div>
          <div><span><MessageCircle size={20} /></span><small>New messages</small><strong>{stats.unreadMessages}</strong></div>
        </section>

        <div className="admin-grid">
          <section className="admin-panel">
            <div className="admin-panel__head"><div><span className="eyebrow">Portal access</span><h2>Clients</h2></div><small>{clients.length} total</small></div>
            {clients.length ? (
              <div className="admin-list">
                {clients.map((client) => (
                  <div className="admin-list__row" key={client.id}>
                    <span className="admin-avatar">{client.name?.charAt(0) || 'C'}</span>
                    <div><strong>{client.name}</strong><small>{client.company || client.email}</small></div>
                    <div className="admin-list__meta"><strong>{client.project_count}</strong><small>projects</small></div>
                    <span className={client.active ? 'access-pill access-pill--active' : 'access-pill'}>{client.active ? 'Active' : 'Disabled'}</span>
                  </div>
                ))}
              </div>
            ) : <div className="admin-empty">No clients have been published to the portal yet.</div>}
          </section>

          <section className="admin-panel">
            <div className="admin-panel__head"><div><span className="eyebrow">Recent activity</span><h2>Messages</h2></div></div>
            {recentMessages.length ? (
              <div className="admin-message-list">
                {recentMessages.slice(0, 8).map((message) => (
                  <div key={message.id}>
                    <span>{message.sender === 'client' ? message.client_name || 'Client' : 'You'}</span>
                    <p>{message.text}</p>
                    <small>{formatDate(message.created_at, true)}</small>
                  </div>
                ))}
              </div>
            ) : <div className="admin-empty">No customer messages yet.</div>}
          </section>
        </div>

        <section className="admin-panel admin-projects">
          <div className="admin-panel__head"><div><span className="eyebrow">Published work</span><h2>Projects</h2></div><small>{projects.length} total</small></div>
          {projects.length ? (
            <div className="admin-project-table">
              <div className="admin-project-table__head"><span>Project</span><span>Status</span><span>Last updated</span></div>
              {projects.map((project) => (
                <div className="admin-project-table__row" key={project.id}>
                  <div><strong>{project.name}</strong><small>{project.summary || 'No public summary'}</small></div>
                  <span className={`status status--${project.status}`}><span /> {STATUS_LABELS[project.status] || project.status}</span>
                  <time>{formatDate(project.updated_at, true)}</time>
                </div>
              ))}
            </div>
          ) : <div className="admin-empty">No projects have been published to the portal yet.</div>}
        </section>
      </main>
    </div>
  )
}

function EmptyProjects({ onMessage }) {
  return (
    <div className="empty-state">
      <span className="empty-state__icon"><BriefcaseBusiness size={28} /></span>
      <h3>Your project space is ready.</h3>
      <p>Once your first project is published, its schedule, progress, photos, and payment milestones will appear here.</p>
      <button className="secondary-action" onClick={onMessage}><MessageCircle size={17} /> Send Travis a message</button>
    </div>
  )
}

function ProjectCard({ project, paymentsEnabled, onPay }) {
  const total = project.milestones.reduce((sum, item) => sum + (Number(item.amount) || 0), 0)
  const paid = project.milestones
    .filter((item) => item.status === 'paid')
    .reduce((sum, item) => sum + (Number(item.amount) || 0), 0)
  const progress = project.checklistProgress.total
    ? Math.round((project.checklistProgress.done / project.checklistProgress.total) * 100)
    : null

  return (
    <article className="project-card">
      <div className="project-card__heading">
        <div>
          <span className={`status status--${project.status || 'lead'}`}>
            <span /> {STATUS_LABELS[project.status] || project.status}
          </span>
          <h3>{project.name}</h3>
          {project.summary && <p>{project.summary}</p>}
        </div>
        {(project.startDate || project.endDate) && (
          <div className="project-dates">
            <CalendarDays size={18} />
            <div>
              {project.startDate && <span>Started <strong>{formatDate(project.startDate)}</strong></span>}
              {project.endDate && <span>Target <strong>{formatDate(project.endDate)}</strong></span>}
            </div>
          </div>
        )}
      </div>

      {progress !== null && (
        <div className="progress-block">
          <div><strong>Project progress</strong><span>{progress}% complete</span></div>
          <div className="progress-track"><span style={{ width: `${progress}%` }} /></div>
          <small>{project.checklistProgress.done} of {project.checklistProgress.total} tracked steps complete</small>
        </div>
      )}

      <div className="project-grid">
        <section className="project-section">
          <div className="section-title"><Clock3 size={17} /><h4>Latest updates</h4></div>
          {project.logs.length ? (
            <div className="timeline">
              {[...project.logs].reverse().slice(0, 6).map((log, index) => (
                <div className="timeline__item" key={log.id}>
                  <span className={index === 0 ? 'timeline__dot timeline__dot--active' : 'timeline__dot'} />
                  <div><p>{log.message}</p><small>{formatDate(log.timestamp, true)}</small></div>
                </div>
              ))}
            </div>
          ) : <p className="muted-copy">Updates will appear here as work moves forward.</p>}
        </section>

        <section className="project-section">
          <div className="section-title"><CreditCard size={17} /><h4>Payments</h4></div>
          {project.milestones.length ? (
            <>
              <div className="payment-summary">
                <div><span>Paid</span><strong>{formatCurrency(paid)}</strong></div>
                <div><span>Remaining</span><strong>{formatCurrency(total - paid)}</strong></div>
              </div>
              <div className="milestones">
                {project.milestones.map((milestone) => (
                  <div className="milestone" key={milestone.id}>
                    {milestone.status === 'paid'
                      ? <CheckCircle2 className="success" size={19} />
                      : <Circle size={19} />}
                    <div>
                      <strong>{milestone.name}</strong>
                      <span>{milestone.description || (milestone.status === 'paid' ? 'Payment received' : 'Upcoming payment')}</span>
                    </div>
                    <b>{formatCurrency(milestone.amount)}</b>
                    {milestone.status !== 'paid' && Number(milestone.amount) > 0 && paymentsEnabled && (
                      <button onClick={() => onPay(project.id, milestone.id)}>Pay</button>
                    )}
                  </div>
                ))}
              </div>
            </>
          ) : <p className="muted-copy">Payment milestones will appear here when they are ready.</p>}
        </section>
      </div>

      {project.photos.length > 0 && (
        <section className="photo-section">
          <div className="section-title"><Sparkles size={17} /><h4>Project gallery</h4></div>
          <div className="photo-grid">
            {project.photos.map((photo) => (
              <figure key={photo.id}>
                <img src={photo.url} alt={photo.title || 'Project update'} />
                {(photo.title || photo.date) && <figcaption>{photo.title} {photo.date && `· ${formatDate(photo.date)}`}</figcaption>}
              </figure>
            ))}
          </div>
        </section>
      )}
    </article>
  )
}

function Messages({ messages, draft, setDraft, busy, onSubmit, endRef }) {
  return (
    <div className="conversation-card">
      <div className="conversation-card__head">
        <span><MessageCircle size={21} /></span>
        <div><h3>Message Travis</h3><p>Questions, details, or a quick update—send it here.</p></div>
      </div>
      <div className="conversation">
        {messages.length === 0 && (
          <div className="conversation-empty"><MessageCircle size={26} /><p>No messages yet. Start the conversation whenever you're ready.</p></div>
        )}
        {messages.map((message) => (
          <div className={`bubble-row bubble-row--${message.sender === 'client' ? 'client' : 'business'}`} key={message.id}>
            <div className="bubble">
              <p>{message.text}</p>
              <small>{message.sender === 'client' ? 'You' : 'Travis'} · {formatDate(message.created_at, true)}</small>
            </div>
          </div>
        ))}
        <div ref={endRef} />
      </div>
      <form className="composer" onSubmit={onSubmit}>
        <textarea value={draft} onChange={(event) => setDraft(event.target.value)} placeholder="Write a message…" rows={2} />
        <button type="submit" disabled={busy || !draft.trim()}>{busy ? <LoaderCircle className="spin" size={18} /> : <Send size={18} />}</button>
      </form>
    </div>
  )
}

function AiChat({ history, draft, setDraft, busy, onSubmit, endRef }) {
  return (
    <div className="conversation-card">
      <div className="conversation-card__head conversation-card__head--ai">
        <span><Sparkles size={21} /></span>
        <div><h3>Project assistant</h3><p>Get quick answers based on the information in your project.</p></div>
      </div>
      <div className="conversation">
        {history.length === 0 && (
          <div className="conversation-empty"><Sparkles size={26} /><p>Ask about your schedule, progress, milestones, or recent updates.</p></div>
        )}
        {history.map((message, index) => (
          <div className={`bubble-row bubble-row--${message.role === 'user' ? 'client' : 'business'}`} key={`${message.role}-${index}`}>
            <div className={`bubble ${message.error ? 'bubble--error' : ''}`}><p>{message.content}</p></div>
          </div>
        ))}
        {busy && <div className="typing"><span /><span /><span /></div>}
        <div ref={endRef} />
      </div>
      <form className="composer" onSubmit={onSubmit}>
        <textarea value={draft} onChange={(event) => setDraft(event.target.value)} placeholder="Ask about your project…" rows={2} />
        <button type="submit" disabled={busy || !draft.trim()}><Send size={18} /></button>
      </form>
    </div>
  )
}

export default function App() {
  const [phase, setPhase] = useState('loading')
  const [session, setSession] = useState(null)
  const [activeTab, setActiveTab] = useState('overview')
  const [mobileNav, setMobileNav] = useState(false)
  const [banner, setBanner] = useState(null)
  const pendingPaidSession = useRef(bootPaidSession)
  const messagesEndRef = useRef(null)
  const chatEndRef = useRef(null)

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loginError, setLoginError] = useState('')
  const [loggingIn, setLoggingIn] = useState(false)
  const [draft, setDraft] = useState('')
  const [sending, setSending] = useState(false)
  const [chatHistory, setChatHistory] = useState([])
  const [chatDraft, setChatDraft] = useState('')
  const [chatBusy, setChatBusy] = useState(false)
  const [googleConfig, setGoogleConfig] = useState({ googleEnabled: false, googleClientId: '' })
  const googleButtonRef = useRef(null)

  const loadSession = useCallback(async () => {
    try {
      const response = await fetch('/api/session', { cache: 'no-store' })
      if (response.status === 401) {
        // Not signed in: visitors get the public website. A pending Stripe
        // redirect still goes to the login screen so the payment can verify.
        setPhase(pendingPaidSession.current ? 'login' : 'public')
        return
      }
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Unable to load your portal.')
      setSession(data)
      setPhase('ready')
    } catch {
      setPhase('public')
    }
  }, [])

  useEffect(() => { loadSession() }, [loadSession])

  useEffect(() => {
    fetch('/api/auth/config')
      .then((response) => response.json())
      .then(setGoogleConfig)
      .catch(() => {})
  }, [])

  useEffect(() => {
    if (phase !== 'login' || !googleConfig.googleEnabled || !googleConfig.googleClientId) return undefined
    const renderGoogle = () => {
      if (!window.google?.accounts?.id || !googleButtonRef.current) return
      window.google.accounts.id.initialize({
        client_id: googleConfig.googleClientId,
        callback: async ({ credential }) => {
          setLoggingIn(true)
          setLoginError('')
          try {
            const response = await fetch('/api/auth/google', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ credential }),
            })
            const data = await response.json()
            if (!response.ok) throw new Error(data.error || 'Google sign-in failed.')
            setPhase('loading')
            await loadSession()
          } catch (error) {
            setLoginError(error.message)
          } finally {
            setLoggingIn(false)
          }
        },
      })
      googleButtonRef.current.innerHTML = ''
      window.google.accounts.id.renderButton(googleButtonRef.current, {
        theme: 'outline',
        size: 'large',
        width: Math.min(380, googleButtonRef.current.clientWidth || 380),
        text: 'continue_with',
        shape: 'rectangular',
      })
    }
    if (window.google?.accounts?.id) {
      renderGoogle()
      return undefined
    }
    const script = document.createElement('script')
    script.src = 'https://accounts.google.com/gsi/client'
    script.async = true
    script.onload = renderGoogle
    document.head.appendChild(script)
    return () => { script.onload = null }
  }, [phase, googleConfig, loadSession])

  useEffect(() => {
    if (phase !== 'ready' || !pendingPaidSession.current) return
    const sessionId = pendingPaidSession.current
    pendingPaidSession.current = ''
    fetch('/api/verify-payment', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId }),
    })
      .then(async (response) => ({ ok: response.ok, data: await response.json() }))
      .then(({ ok, data }) => {
        setBanner(ok && data.paid
          ? { type: 'success', text: 'Payment received. Thank you—your project has been updated.' }
          : { type: 'warning', text: data.error || 'Your payment is still being confirmed.' })
        loadSession()
      })
      .catch(() => setBanner({ type: 'warning', text: 'We could not confirm that payment yet. Please contact Travis.' }))
  }, [phase, loadSession])

  useEffect(() => {
    if (phase !== 'ready') return undefined
    const timer = setInterval(async () => {
      try {
        const response = await fetch('/api/messages', { cache: 'no-store' })
        if (!response.ok) return
        const data = await response.json()
        setSession((current) => current ? { ...current, messages: data.messages } : current)
      } catch { /* retry on next poll */ }
    }, 45000)
    return () => clearInterval(timer)
  }, [phase])

  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [session?.messages?.length, activeTab])
  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [chatHistory.length, chatBusy])

  const totals = useMemo(() => {
    const projects = session?.projects || []
    const milestones = projects.flatMap((project) => project.milestones || [])
    return {
      active: projects.filter((project) => project.status !== 'completed').length,
      paid: milestones.filter((item) => item.status === 'paid').reduce((sum, item) => sum + (Number(item.amount) || 0), 0),
      remaining: milestones.filter((item) => item.status !== 'paid').reduce((sum, item) => sum + (Number(item.amount) || 0), 0),
    }
  }, [session])

  const handleLogin = async (event) => {
    event.preventDefault()
    setLoggingIn(true)
    setLoginError('')
    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Sign-in failed.')
      setPassword('')
      setPhase('loading')
      await loadSession()
    } catch (error) {
      setLoginError(error.message)
    } finally {
      setLoggingIn(false)
    }
  }

  const logout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' }).catch(() => {})
    setSession(null)
    setChatHistory([])
    setPhase('public')
  }

  const sendMessage = async (event) => {
    event.preventDefault()
    const text = draft.trim()
    if (!text || sending) return
    setSending(true)
    try {
      const response = await fetch('/api/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text }),
      })
      const saved = await response.json()
      if (!response.ok) throw new Error(saved.error || 'Message failed to send.')
      setSession((current) => ({ ...current, messages: [...(current.messages || []), saved] }))
      setDraft('')
    } catch (error) {
      setBanner({ type: 'warning', text: error.message })
    } finally {
      setSending(false)
    }
  }

  const sendChat = async (event) => {
    event.preventDefault()
    const text = chatDraft.trim()
    if (!text || chatBusy) return
    const next = [...chatHistory, { role: 'user', content: text }]
    setChatHistory(next)
    setChatDraft('')
    setChatBusy(true)
    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: next }),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'The assistant is unavailable.')
      setChatHistory((current) => [...current, { role: 'assistant', content: data.reply }])
    } catch (error) {
      setChatHistory((current) => [...current, { role: 'assistant', content: error.message, error: true }])
    } finally {
      setChatBusy(false)
    }
  }

  const payMilestone = async (projectId, milestoneId) => {
    try {
      const response = await fetch('/api/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId, milestoneId }),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Unable to start checkout.')
      window.location.href = data.url
    } catch (error) {
      setBanner({ type: 'warning', text: error.message })
    }
  }

  if (phase === 'loading') {
    return <div className="loading-screen"><BrandMark /><LoaderCircle className="spin" size={24} /><p>Opening your project portal…</p></div>
  }

  if (phase === 'public') {
    return <PublicSite onSignIn={() => setPhase('login')} />
  }

  if (phase === 'login') {
    return <Login {...{ email, setEmail, password, setPassword, error: loginError, busy: loggingIn, onSubmit: handleLogin, googleEnabled: googleConfig.googleEnabled, googleButtonRef, onBack: () => setPhase('public') }} />
  }

  if (session?.role === 'admin') {
    return <AdminPortal session={session} onLogout={logout} />
  }

  const { business, client, projects, messages } = session
  const navItems = [
    { id: 'overview', label: 'Overview', icon: <Home size={18} /> },
    { id: 'projects', label: 'Projects', icon: <BriefcaseBusiness size={18} />, count: projects.length },
    { id: 'messages', label: 'Messages', icon: <MessageCircle size={18} />, count: messages.length },
    ...(session.aiEnabled ? [{ id: 'chat', label: 'Ask the assistant', icon: <Sparkles size={18} /> }] : []),
  ]

  const navigate = (id) => {
    setActiveTab(id)
    setMobileNav(false)
  }

  return (
    <div className="portal-shell">
      <header className="portal-header">
        <BrandMark compact />
        <button className="mobile-menu" onClick={() => setMobileNav((open) => !open)} aria-label="Toggle navigation">
          {mobileNav ? <X /> : <Menu />}
        </button>
        <nav className={mobileNav ? 'portal-nav portal-nav--open' : 'portal-nav'}>
          {navItems.map((item) => (
            <button className={activeTab === item.id ? 'active' : ''} onClick={() => navigate(item.id)} key={item.id}>
              {item.icon}<span>{item.label}</span>{item.count !== undefined && <small>{item.count}</small>}
            </button>
          ))}
        </nav>
        <div className="account-chip">
          <span>{client.name?.charAt(0) || 'C'}</span>
          <div><strong>{client.name}</strong><small>{client.company || client.email}</small></div>
          <button onClick={logout} title="Sign out"><LogOut size={17} /></button>
        </div>
      </header>

      <main className="portal-main">
        {banner && (
          <div className={`notice notice--${banner.type}`}>
            {banner.type === 'success' ? <CheckCircle2 size={19} /> : <Clock3 size={19} />}
            <span>{banner.text}</span><button onClick={() => setBanner(null)}><X size={16} /></button>
          </div>
        )}

        {activeTab === 'overview' && (
          <>
            <section className="welcome-hero">
              <div>
                <span className="eyebrow">Your project workspace</span>
                <h1>Good to see you, {client.name?.split(' ')[0]}.</h1>
                <p>Everything for your work with {business.companyName || "Travis's Creations"}, organized in one place.</p>
                <button className="hero-action" onClick={() => navigate(projects.length ? 'projects' : 'messages')}>
                  {projects.length ? 'View project details' : 'Start a conversation'} <ArrowRight size={18} />
                </button>
              </div>
              <div className="welcome-hero__art" style={{ backgroundImage: `url(${workshopHero})` }} />
            </section>

            <section className="stats-grid">
              <div className="stat-card"><span><BriefcaseBusiness size={20} /></span><div><small>Active projects</small><strong>{totals.active}</strong></div></div>
              <div className="stat-card"><span><Check size={20} /></span><div><small>Payments received</small><strong>{formatCurrency(totals.paid)}</strong></div></div>
              <div className="stat-card"><span><CreditCard size={20} /></span><div><small>Upcoming balance</small><strong>{formatCurrency(totals.remaining)}</strong></div></div>
            </section>

            <div className="overview-grid">
              <section className="overview-panel">
                <div className="panel-heading"><div><span className="eyebrow">Current work</span><h2>Your projects</h2></div>{projects.length > 0 && <button onClick={() => navigate('projects')}>View all <ArrowRight size={15} /></button>}</div>
                {projects.length
                  ? projects.slice(0, 2).map((project) => (
                    <button className="project-preview" onClick={() => navigate('projects')} key={project.id}>
                      <span className="project-preview__icon"><BriefcaseBusiness size={21} /></span>
                      <div><strong>{project.name}</strong><small>{STATUS_LABELS[project.status] || project.status}</small></div>
                      <ArrowRight size={18} />
                    </button>
                  ))
                  : <EmptyProjects onMessage={() => navigate('messages')} />}
              </section>

              <aside className="contact-panel">
                <span className="eyebrow">Here when you need us</span>
                <h2>Have a question?</h2>
                <p>Send a portal message and keep the conversation attached to your project.</p>
                <button className="secondary-action" onClick={() => navigate('messages')}><MessageCircle size={17} /> Message Travis</button>
                <div className="contact-details">
                  {business.phone && <a href={`tel:${business.phone}`}><Phone size={15} /> {business.phone}</a>}
                  {business.email && <a href={`mailto:${business.email}`}><Mail size={15} /> {business.email}</a>}
                </div>
              </aside>
            </div>
          </>
        )}

        {activeTab === 'projects' && (
          <section>
            <div className="page-heading"><span className="eyebrow">Scope, schedule & progress</span><h1>Your projects</h1><p>A clear look at what's happening, what's complete, and what comes next.</p></div>
            {projects.length
              ? projects.map((project) => <ProjectCard project={project} paymentsEnabled={session.paymentsEnabled} onPay={payMilestone} key={project.id} />)
              : <EmptyProjects onMessage={() => navigate('messages')} />}
          </section>
        )}

        {activeTab === 'messages' && <Messages messages={messages} draft={draft} setDraft={setDraft} busy={sending} onSubmit={sendMessage} endRef={messagesEndRef} />}
        {activeTab === 'chat' && <AiChat history={chatHistory} draft={chatDraft} setDraft={setChatDraft} busy={chatBusy} onSubmit={sendChat} endRef={chatEndRef} />}
      </main>

      <footer className="portal-footer">
        <BrandMark compact />
        <p>Built around your project. Backed by real-world experience.</p>
        <span>Private client portal · {new Date().getFullYear()}</span>
      </footer>
    </div>
  )
}
