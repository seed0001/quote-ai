import React from 'react';
import { ArrowLeft, MessageSquare } from 'lucide-react';
import AIChat from './AIChat';

export default function Mobile({
  projects,
  clients,
  catalog,
  tasks,
  settings,
  activeProjectId,
  onProjectsChange,
  onClientsChange,
  onCatalogChange,
  onTasksChange,
  setActiveProjectId,
  onExit,
}) {
  return (
    <div className="mobile-page">
      <header className="mobile-page-header">
        <button className="mobile-back-button" onClick={onExit} aria-label="Return to desktop interface">
          <ArrowLeft size={20} />
        </button>
        <div className="mobile-page-title">
          <MessageSquare size={18} />
          <div>
            <strong>QuoteFlow Mobile</strong>
            <span>{settings.companyName || 'Chat workspace'}</span>
          </div>
        </div>
        <div className="mobile-status-dot" title="Chat ready" />
      </header>

      <main className="mobile-chat-area">
        <AIChat
          mobile
          projects={projects}
          clients={clients}
          catalog={catalog}
          tasks={tasks}
          settings={settings}
          activeProjectId={activeProjectId}
          currentView="mobile"
          onProjectsChange={onProjectsChange}
          onClientsChange={onClientsChange}
          onCatalogChange={onCatalogChange}
          onTasksChange={onTasksChange}
          setCurrentView={() => {}}
          setActiveProjectId={setActiveProjectId}
        />
      </main>
    </div>
  );
}
