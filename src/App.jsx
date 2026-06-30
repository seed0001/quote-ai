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
  Smartphone
} from 'lucide-react';
import {
  getProjects,
  getClients,
  getSettings,
  getCatalog,
  saveProjects,
  saveClients,
  saveSettings,
  saveCatalog,
  initDataStore
} from './utils/dataStore';
import Dashboard from './components/Dashboard';
import ClientDirectory from './components/ClientDirectory';
import QuoteBuilder from './components/QuoteBuilder';
import ProjectDetail from './components/ProjectDetail';
import SettingsView from './components/SettingsView';
import AICommandLine from './components/AICommandLine';
import AIChat from './components/AIChat';
import PriceCatalog from './components/PriceCatalog';
import Calculator from './components/Calculator';
import Mobile from './components/Mobile';

export default function App() {
  const [currentView, setCurrentView] = useState('dashboard');
  const [projects, setProjects] = useState([]);
  const [clients, setClients] = useState([]);
  const [settings, setSettings] = useState({});
  const [catalog, setCatalog] = useState([]);
  const [activeProjectId, setActiveProjectId] = useState(null);
  const [theme, setTheme] = useState('dark');

  // Initialize and load data
  useEffect(() => {
    initDataStore();
    setProjects(getProjects());
    setClients(getClients());
    const localSettings = getSettings();
    setSettings(localSettings);
    setCatalog(getCatalog());

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
    
    // Load theme
    const storedTheme = localStorage.getItem('quote_ai_theme') || 'dark';
    setTheme(storedTheme);
    if (storedTheme === 'light') {
      document.documentElement.classList.add('light-theme');
    } else {
      document.documentElement.classList.remove('light-theme');
    }
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

  const handleUpdateSettings = (newSettings) => {
    setSettings(newSettings);
    saveSettings(newSettings);
  };

  const handleUpdateCatalog = (newCatalog) => {
    setCatalog(newCatalog);
    saveCatalog(newCatalog);
  };

  const toggleTheme = () => {
    const nextTheme = theme === 'dark' ? 'light' : 'dark';
    setTheme(nextTheme);
    localStorage.setItem('quote_ai_theme', nextTheme);
    if (nextTheme === 'light') {
      document.documentElement.classList.add('light-theme');
    } else {
      document.documentElement.classList.remove('light-theme');
    }
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
      case 'ai-chat':
        return (
          <AIChat
            projects={projects}
            clients={clients}
            catalog={catalog}
            settings={settings}
            activeProjectId={activeProjectId}
            currentView={currentView}
            onProjectsChange={handleUpdateProjects}
            onClientsChange={handleUpdateClients}
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
        settings={settings}
        activeProjectId={activeProjectId}
        onProjectsChange={handleUpdateProjects}
        onClientsChange={handleUpdateClients}
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
          </div>

          <div 
            className={`menu-item ${currentView === 'ai-chat' ? 'active' : ''}`}
            onClick={() => { setCurrentView('ai-chat'); setActiveProjectId(null); }}
          >
            <MessageSquare size={18} />
            AI Voice Chat
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

          <AICommandLine 
            projects={projects}
            clients={clients}
            settings={settings}
            activeProjectId={activeProjectId}
            currentView={currentView}
            onProjectsChange={handleUpdateProjects}
            onClientsChange={handleUpdateClients}
            setCurrentView={setCurrentView}
            setActiveProjectId={setActiveProjectId}
          />

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
