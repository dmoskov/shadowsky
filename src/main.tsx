import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import './styles/tailwind-import.css'
import App from './App.tsx'
import { performanceTracker } from './lib/performance-tracking'

// Initialize performance tracking
performanceTracker.mark('app-start');

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

// Measure app initialization time
window.addEventListener('load', () => {
  performanceTracker.measure('app-init', 'app-start');
});
