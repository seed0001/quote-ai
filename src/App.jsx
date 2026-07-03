import React, { useState, useEffect } from 'react';
import { 
  LayoutDashboard, 
  Users, 
  FileSpreadsheet, 
  Briefcase, 
  Settings as SettingsIcon, 
  Sun,
  Moon,
  TrendingUp,
  DollarSign,
  BriefcaseBusiness,
  MessageSquare,
  Package,
  Smartphone,
  CalendarDays,
  BookUser,
  Cpu,
  BookOpen,
  Newspaper,
  Brain
} from 'lucide-react';
import { playClick, setSoundVolume, setSoundEnabled, setSoundPack } from './utils/soundEngine';
import {
  getProjects,
  getClients,
  getSettings,
  getCatalog,
  getTasks,
  saveProjects,
  saveClients,
  saveSettings,
  saveCatalog,
  saveTasks,
  saveContacts,
  initDataStore,
  hydrateFromHost,
  getContacts,
  getKnowledgeBase,
  saveKnowledgeBase,
  getPortalMessages,
  savePortalMessages,
  getSitePosts,
  saveSitePosts,
  getAiMemory,
  saveAiMemory
} from './utils/dataStore';
import Dashboard from './components/Dashboard';
import ClientDirectory from './components/ClientDirectory';
import ContactDirectory from './components/ContactDirectory';
import AgentWorkspace from './components/AgentWorkspace';
import KnowledgeBase from './components/KnowledgeBase';
import QuoteBuilder from './components/QuoteBuilder';
import ProjectDetail from './components/ProjectDetail';
import SettingsView from './components/SettingsView';
import SitePosts from './components/SitePosts';
import MemoryCenter from './components/MemoryCenter';

import AIChat from './components/AIChat';
import PriceCatalog from './components/PriceCatalog';
import Calculator from './components/Calculator';
import Mobile from './components/Mobile';
import CalendarView from './components/CalendarView';

export default function App() {
  const [currentView, setCurrentView] = useState('dashboard');
  const [projects, setProjects] = useState([]);
  const [clients, setClients] = useState([]);
  const [contacts, setContacts] = useState([]);
  const [knowledgeBase, setKnowledgeBase] = useState([]);
  const [settings, setSettings] = useState({});
  const [catalog, setCatalog] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [portalMessages, setPortalMessages] = useState([]);
  const [sitePosts, setSitePosts] = useState([]);
  const [aiMemory, setAiMemory] = useState([]);
  const [activeProjectId, setActiveProjectId] = useState(null);
  const [theme, setTheme] = useState('dark');

  // Initialize and load data
  useEffect(() => {
    // Seed synchronously from the local fallback, then pull the authoritative
    // shared data from the host computer so every employee sees the same records.
    initDataStore();
    setProjects(getProjects());
    setClients(getClients());
    setContacts(getContacts());
    setKnowledgeBase(getKnowledgeBase());
    setCatalog(getCatalog());
    setTasks(getTasks());
    setPortalMessages(getPortalMessages());
    setSitePosts(getSitePosts());
    setAiMemory(getAiMemory());
    hydrateFromHost().then(() => {
      setProjects(getProjects());
      setClients(getClients());
      setContacts(getContacts());
      setKnowledgeBase(getKnowledgeBase());
      setCatalog(getCatalog());
      setTasks(getTasks());
      setPortalMessages(getPortalMessages());
      setSitePosts(getSitePosts());
      setAiMemory(getAiMemory());
    });
    const localSettings = getSettings();
    setSettings(localSettings);

    const loadHostedConfiguration = async () => {
      try {
        const isHostBrowser = ['localhost', '127.0.0.1', '::1'].includes(window.location.hostname);
        if (isHostBrowser && (localSettings.openRouterKey || localSettings.fishAudioKey)) {
          const migrationResponse = await fetch('/api/host-config', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(localSettings),
          });
          if (migrationResponse.ok) {
            const hosted = await migrationResponse.json();
            const sanitized = { ...localSettings, ...hosted, openRouterKey: '', fishAudioKey: '' };
            saveSettings(sanitized);
            setSettings(sanitized);
            return;
          }
        }

        const response = await fetch('/api/host-config', { cache: 'no-store' });
        if (response.ok) {
          const hosted = await response.json();
          setSettings((current) => ({ ...current, ...hosted, openRouterKey: '', fishAudioKey: '' }));
        }
      } catch (error) {
        console.error('Unable to load hosted QuoteFlow configuration.', error);
      }
    };
    loadHostedConfiguration();
  }, []);

  // Sync settings and UI elements
  useEffect(() => {
    if (!settings) return;

    // Programmatic cleanup: if legacy gemini-1.5-pro is active in settings, scrub it out
    if (
      settings.openRouterVisionModel?.includes('gemini-1.5-pro') || 
      settings.openRouterModel?.includes('gemini-1.5-pro') ||
      settings.openRouterClassifierModel?.includes('gemini-1.5-pro')
    ) {
      const cleanedSettings = { ...settings };
      if (cleanedSettings.openRouterVisionModel?.includes('gemini-1.5-pro')) {
        cleanedSettings.openRouterVisionModel = '';
      }
      if (cleanedSettings.openRouterModel?.includes('gemini-1.5-pro')) {
        cleanedSettings.openRouterModel = '';
      }
      if (cleanedSettings.openRouterClassifierModel?.includes('gemini-1.5-pro')) {
        cleanedSettings.openRouterClassifierModel = '';
      }
      setSettings(cleanedSettings);
      saveSettings(cleanedSettings);
      fetch('/api/host-config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(cleanedSettings),
      }).catch(err => console.error("Failed to sync cleaned config", err));
      return;
    }

    // Apply theme class
    const activeTheme = settings.theme || 'dark';
    const themeClasses = ['light-theme', 'ocean-theme', 'forest-theme', 'midnight-theme'];
    themeClasses.forEach(tc => document.documentElement.classList.remove(tc));
    if (activeTheme !== 'dark') {
      document.documentElement.classList.add(`${activeTheme}-theme`);
    }

    // Apply custom scaling variables
    document.documentElement.style.setProperty('--spacing-scale', settings.spacingScale !== undefined ? settings.spacingScale : '1');
    document.documentElement.style.setProperty('--font-scale', settings.fontScale !== undefined ? settings.fontScale : '1');
    document.documentElement.style.setProperty('--radius', `${settings.radius !== undefined ? settings.radius : 0}px`);

    // Apply sounds
    setSoundVolume(settings.soundVolume !== undefined ? settings.soundVolume : 0.5);
    setSoundEnabled(settings.soundEnabled !== undefined ? settings.soundEnabled : true);
    setSoundPack(settings.soundPack || 'modern');
  }, [settings]);

  // Global click sound cue
  useEffect(() => {
    const handleGlobalClick = (e) => {
      const target = e.target.closest('button, .btn, .menu-item, input[type="button"], input[type="submit"]');
      if (target) {
        playClick();
      }
    };
    document.addEventListener('click', handleGlobalClick);
    return () => document.removeEventListener('click', handleGlobalClick);
  }, []);

  // Sync state changes with localStorage
  const handleUpdateProjects = (newProjects) => {
    setProjects(newProjects);
    saveProjects(newProjects);
  };

  const handleUpdateClients = (newClients) => {
    setClients(newClients);
    saveClients(newClients);
  };

  const handleUpdateContacts = (newContacts) => {
    setContacts(newContacts);
    saveContacts(newContacts);
  };

  const handleUpdateKnowledgeBase = (newKb) => {
    setKnowledgeBase(newKb);
    saveKnowledgeBase(newKb);
  };

  const handleUpdateSettings = (newSettings) => {
    setSettings(newSettings);
    saveSettings(newSettings);
  };

  const handleUpdateCatalog = (newCatalog) => {
    setCatalog(newCatalog);
    saveCatalog(newCatalog);
  };

  const handleUpdateTasks = (newTasks) => {
    setTasks(newTasks);
    saveTasks(newTasks);
  };

  const handleUpdatePortalMessages = (newMessages) => {
    setPortalMessages(newMessages);
    savePortalMessages(newMessages);
  };

  const handleUpdateSitePosts = (newPosts) => {
    setSitePosts(newPosts);
    saveSitePosts(newPosts);
  };

  const handleUpdateAiMemory = (newMemory) => {
    setAiMemory(newMemory);
    saveAiMemory(newMemory);
  };

  const toggleTheme = () => {
    const themes = ['dark', 'light', 'ocean', 'forest', 'midnight'];
    const currentTheme = settings.theme || 'dark';
    const nextIndex = (themes.indexOf(currentTheme) + 1) % themes.length;
    const nextTheme = themes[nextIndex];
    
    const updatedSettings = { ...settings, theme: nextTheme };
    setSettings(updatedSettings);
    saveSettings(updatedSettings);
  };

  // Helper to open a specific project in the details view
  const viewProjectDetails = (projectId) => {
    setActiveProjectId(projectId);
    setCurrentView('project-detail');
  };

  // Helper to open a specific project in the quote builder view
  const editProjectQuote = (projectId) => {
    setActiveProjectId(projectId);
    setCurrentView('quote-builder');
  };

  // Get active project details
  const activeProject = projects.find(p => p.id === activeProjectId);

  // Render correct view
  const renderView = () => {
    switch (currentView) {
      case 'dashboard':
        return (
          <Dashboard 
            projects={projects} 
            clients={clients} 
            settings={settings}
            onProjectsChange={handleUpdateProjects} 
            onViewDetails={viewProjectDetails}
            onEditQuote={editProjectQuote}
          />
        );
      case 'clients':
        return (
          <ClientDirectory
            clients={clients}
            projects={projects}
            onClientsChange={handleUpdateClients}
            onViewProject={viewProjectDetails}
            onEditQuote={editProjectQuote}
            portalMessages={portalMessages}
            onPortalMessagesChange={handleUpdatePortalMessages}
            settings={settings}
          />
        );
      case 'contacts':
        return (
          <ContactDirectory
            contacts={contacts}
            onContactsChange={() => handleUpdateContacts(getContacts())}
          />
        );
      case 'agent-workspace':
        return <AgentWorkspace />;
      case 'site-posts':
        return (
          <SitePosts
            sitePosts={sitePosts}
            onSitePostsChange={handleUpdateSitePosts}
          />
        );
      case 'ai-memory':
        return (
          <MemoryCenter
            aiMemory={aiMemory}
            onAiMemoryChange={handleUpdateAiMemory}
          />
        );
      case 'knowledge-base':
        return (
          <KnowledgeBase
            knowledgeBase={knowledgeBase}
            onKnowledgeBaseChange={handleUpdateKnowledgeBase}
          />
        );
      case 'quote-builder':
        return (
          <QuoteBuilder 
            project={activeProject} 
            clients={clients}
            settings={settings}
            onUpdateProject={(updated) => {
              const updatedProjects = projects.map(p => p.id === updated.id ? updated : p);
              handleUpdateProjects(updatedProjects);
            }}
            onClose={() => setCurrentView('dashboard')}
          />
        );
      case 'project-detail':
        return (
          <ProjectDetail 
            project={activeProject} 
            clients={clients}
            settings={settings}
            onUpdateProject={(updated) => {
              const updatedProjects = projects.map(p => p.id === updated.id ? updated : p);
              handleUpdateProjects(updatedProjects);
            }}
            onEditQuote={editProjectQuote}
            onClose={() => setCurrentView('dashboard')}
          />
        );
      case 'settings':
        return (
          <SettingsView 
            settings={settings} 
            onSettingsChange={handleUpdateSettings}
            onDataImported={() => {
              setProjects(getProjects());
              setClients(getClients());
              setSettings(getSettings());
            }}
          />
        );
      case 'catalog':
        return (
          <PriceCatalog
            catalog={catalog}
            onCatalogChange={handleUpdateCatalog}
          />
        );
      case 'calendar':
        return (
          <CalendarView
            tasks={tasks}
            projects={projects}
            clients={clients}
            settings={settings}
            onTasksChange={handleUpdateTasks}
          />
        );
      case 'ai-chat':
        return (
          <AIChat
            projects={projects}
            clients={clients}
            contacts={contacts}
            knowledgeBase={knowledgeBase}
            aiMemory={aiMemory}
            catalog={catalog}
            tasks={tasks}
            settings={settings}
            activeProjectId={activeProjectId}
            currentView={currentView}
            onProjectsChange={handleUpdateProjects}
            onClientsChange={handleUpdateClients}
            onCatalogChange={handleUpdateCatalog}
            onTasksChange={handleUpdateTasks}
            onAiMemoryChange={handleUpdateAiMemory}
            setCurrentView={setCurrentView}
            setActiveProjectId={setActiveProjectId}
          />
        );
      default:
        return <div style={{ padding: '20px' }}>Select a view from the sidebar</div>;
    }
  };

  if (currentView === 'mobile') {
    return (
      <Mobile
        projects={projects}
        clients={clients}
        catalog={catalog}
        tasks={tasks}
        settings={settings}
        activeProjectId={activeProjectId}
        onProjectsChange={handleUpdateProjects}
        onClientsChange={handleUpdateClients}
        onCatalogChange={handleUpdateCatalog}
        onTasksChange={handleUpdateTasks}
        setActiveProjectId={setActiveProjectId}
        onExit={() => setCurrentView('dashboard')}
      />
    );
  }

  return (
    <div className="app-container">
      {/* Left-hand Navigation Sidebar */}
      <aside className="sidebar no-print">
        <div className="sidebar-header">
          <BriefcaseBusiness size={20} style={{ color: 'var(--accent)', marginRight: '8px' }} />
          <span>QUOTE</span> FLOW
        </div>
        
        <nav className="sidebar-menu">
          <div 
            className={`menu-item ${currentView === 'dashboard' ? 'active' : ''}`}
            onClick={() => { setCurrentView('dashboard'); setActiveProjectId(null); }}
          >
            <LayoutDashboard size={18} />
            Dashboard
          </div>
          
          <div
            className={`menu-item ${currentView === 'clients' ? 'active' : ''}`}
            onClick={() => { setCurrentView('clients'); setActiveProjectId(null); }}
          >
            <Users size={18} />
            Client Directory
            {portalMessages.some(m => m.from === 'client' && !m.read) && (
              <span style={{ marginLeft: 'auto', backgroundColor: 'var(--accent)', color: '#fff', fontSize: '10px', fontWeight: 700, padding: '1px 6px', borderRadius: '10px' }}>
                {portalMessages.filter(m => m.from === 'client' && !m.read).length}
              </span>
            )}
          </div>

          <div 
            className={`menu-item ${currentView === 'contacts' ? 'active' : ''}`}
            onClick={() => { setCurrentView('contacts'); setActiveProjectId(null); }}
          >
            <BookUser size={18} />
            Contacts Book
          </div>

          <div 
            className={`menu-item ${currentView === 'agent-workspace' ? 'active' : ''}`}
            onClick={() => { setCurrentView('agent-workspace'); setActiveProjectId(null); }}
          >
            <Cpu size={18} />
            Agent Workspace
          </div>

          <div 
            className={`menu-item ${currentView === 'knowledge-base' ? 'active' : ''}`}
            onClick={() => { setCurrentView('knowledge-base'); setActiveProjectId(null); }}
          >
            <BookOpen size={18} />
            Knowledge Base
          </div>

          <div
            className={`menu-item ${currentView === 'ai-chat' ? 'active' : ''}`}
            onClick={() => { setCurrentView('ai-chat'); setActiveProjectId(null); }}
          >
            <MessageSquare size={18} />
            AI Voice Chat
          </div>

          <div
            className={`menu-item ${currentView === 'ai-memory' ? 'active' : ''}`}
            onClick={() => { setCurrentView('ai-memory'); setActiveProjectId(null); }}
          >
            <Brain size={18} />
            AI Memory
          </div>

          <div
            className={`menu-item ${currentView === 'site-posts' ? 'active' : ''}`}
            onClick={() => { setCurrentView('site-posts'); setActiveProjectId(null); }}
          >
            <Newspaper size={18} />
            Website Posts
          </div>

          <div
            className="menu-item"
            onClick={() => { setCurrentView('mobile'); setActiveProjectId(null); }}
          >
            <Smartphone size={18} />
            Mobile
          </div>

          <div
            className={`menu-item ${currentView === 'catalog' ? 'active' : ''}`}
            onClick={() => { setCurrentView('catalog'); setActiveProjectId(null); }}
          >
            <Package size={18} />
            Price Catalog
          </div>

          <div
            className={`menu-item ${currentView === 'calendar' ? 'active' : ''}`}
            onClick={() => { setCurrentView('calendar'); setActiveProjectId(null); }}
          >
            <CalendarDays size={18} />
            Calendar &amp; Tasks
          </div>

          {activeProjectId && (
            <>
              <div 
                className={`menu-item ${currentView === 'project-detail' ? 'active' : ''}`}
                onClick={() => setCurrentView('project-detail')}
              >
                <Briefcase size={18} />
                Project Workspace
              </div>
              
              <div 
                className={`menu-item ${currentView === 'quote-builder' ? 'active' : ''}`}
                onClick={() => setCurrentView('quote-builder')}
              >
                <FileSpreadsheet size={18} />
                Quote Estimator
              </div>
            </>
          )}

          <div 
            className={`menu-item ${currentView === 'settings' ? 'active' : ''}`}
            onClick={() => { setCurrentView('settings'); setActiveProjectId(null); }}
          >
            <SettingsIcon size={18} />
            System Settings
          </div>
        </nav>

        <div className="sidebar-footer">
          <Calculator />
          <button className="theme-toggle-btn" onClick={toggleTheme}>
            {theme === 'dark' ? (
              <>
                <Sun size={14} /> Light Mode
              </>
            ) : (
              <>
                <Moon size={14} /> Dark Mode
              </>
            )}
          </button>
          
          <div style={{ fontSize: '10px', color: 'var(--text-muted)', textAlign: 'center', fontFamily: 'var(--font-mono)' }}>
            v1.0.0 // CRISP GRID
          </div>
        </div>
      </aside>

      {/* Main content wrapper */}
      <div className="main-wrapper">
        {/* Top Bar */}
        <header className="topbar no-print">
          <h1 className="topbar-title">
            {currentView === 'dashboard' && 'Dashboard Overview'}
            {currentView === 'clients' && 'Clients database'}
            {currentView === 'quote-builder' && `Quote Estimator : ${activeProject?.name || 'New Estimate'}`}
            {currentView === 'project-detail' && `Project Workspace : ${activeProject?.name || 'Project Overview'}`}
            {currentView === 'settings' && 'System Configuration'}
            {currentView === 'ai-chat' && 'AI Voice Assistant'}
            {currentView === 'catalog' && 'Price Catalog'}
          </h1>



          <div className="topbar-actions">
            {activeProject && currentView !== 'dashboard' && currentView !== 'clients' && currentView !== 'settings' && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span className="badge badge-quoting" style={{ fontSize: '11px', fontFamily: 'var(--font-mono)' }}>
                  PROJECT ID: {activeProject.id.toUpperCase()}
                </span>
                <span className={`badge badge-${activeProject.status}`} style={{ fontSize: '11px' }}>
                  {activeProject.status}
                </span>
              </div>
            )}
            
            <div style={{ fontSize: '13px', color: 'var(--text-secondary)', fontWeight: '500' }}>
              {settings.companyName || 'My Business'}
            </div>
          </div>
        </header>

        {/* Viewport for specific panels */}
        <main className="content-viewport">
          {renderView()}
        </main>
      </div>
    </div>
  );
}
