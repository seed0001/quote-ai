import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import ClientPortal from './components/ClientPortal.jsx'

// Clients land on /portal?token=… via their magic link and get the standalone
// portal; everything else renders the full internal app.
const isPortal = window.location.pathname.replace(/\/+$/, '') === '/portal'
const portalToken = new URLSearchParams(window.location.search).get('token') || ''

createRoot(document.getElementById('root')).render(
  <StrictMode>
    {isPortal ? <ClientPortal token={portalToken} /> : <App />}
  </StrictMode>,
)
