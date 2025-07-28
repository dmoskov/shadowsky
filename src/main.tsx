import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import './styles/tailwind-import.css'
import App from './App.tsx'
import { analytics } from './services/analytics'

// Initialize Analytics
analytics.initialize()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

