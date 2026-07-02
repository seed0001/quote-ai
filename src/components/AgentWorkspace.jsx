import React, { useState, useEffect } from 'react';
import { Terminal, FolderGit2, Play, Box, FileCode2, Cpu, ChevronRight } from 'lucide-react';

export default function AgentWorkspace() {
  const [logs, setLogs] = useState([
    { time: new Date().toLocaleTimeString(), type: 'system', msg: 'Agent Workspace Initialized.' },
    { time: new Date().toLocaleTimeString(), type: 'info', msg: 'Ready to accept coding instructions from the AI Chat.' }
  ]);
  const [files, setFiles] = useState([]);

  // In a real implementation, we would poll or WebSocket to the backend
  // to get live terminal output and file system changes.

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', gap: '16px' }}>
      
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h2 style={{ fontSize: '24px', fontWeight: 'bold', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Cpu style={{ color: 'var(--accent)' }} /> Agentic Workspace
          </h2>
          <p style={{ color: 'var(--text-secondary)' }}>
            Monitor autonomous coding sub-agents, terminal execution, and file generation.
          </p>
        </div>
      </div>

      <div style={{ display: 'flex', gap: '16px', flex: 1, minHeight: 0 }}>
        
        {/* Left Panel: File Explorer */}
        <div className="panel" style={{ flex: '0 0 300px', display: 'flex', flexDirection: 'column' }}>
          <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border-color)', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <FolderGit2 size={16} /> File Explorer
          </div>
          <div style={{ padding: '16px', flex: 1, overflowY: 'auto', fontSize: '13px', color: 'var(--text-secondary)' }}>
            {files.length === 0 ? (
              <div style={{ textAlign: 'center', opacity: 0.5, marginTop: '40px' }}>
                <Box size={32} style={{ margin: '0 auto 8px auto' }} />
                <p>No project generated yet.</p>
                <p style={{ fontSize: '11px', marginTop: '4px' }}>Ask the AI to build an app!</p>
              </div>
            ) : (
              files.map((file, idx) => (
                <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '4px 0' }}>
                  <FileCode2 size={14} style={{ color: 'var(--accent)' }} />
                  {file.name}
                </div>
              ))
            )}
          </div>
        </div>

        {/* Right Panel: Terminal / Agent Feed */}
        <div className="panel" style={{ flex: 1, display: 'flex', flexDirection: 'column', backgroundColor: '#0f172a', color: '#e2e8f0' }}>
          <div style={{ padding: '12px 16px', borderBottom: '1px solid #1e293b', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '8px', color: '#94a3b8' }}>
            <Terminal size={16} /> Agent Execution Feed
          </div>
          <div style={{ padding: '16px', flex: 1, overflowY: 'auto', fontFamily: 'monospace', fontSize: '13px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {logs.map((log, idx) => (
              <div key={idx} style={{ display: 'flex', gap: '12px' }}>
                <span style={{ color: '#475569' }}>[{log.time}]</span>
                <span style={{ color: log.type === 'system' ? '#38bdf8' : log.type === 'error' ? '#f87171' : '#a3e635' }}>
                  {log.type === 'system' ? <ChevronRight size={14} style={{ display: 'inline', verticalAlign: 'text-bottom' }} /> : ''}
                  {log.msg}
                </span>
              </div>
            ))}
            <div style={{ animation: 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite' }}>_</div>
          </div>
        </div>
      </div>
    </div>
  );
}
