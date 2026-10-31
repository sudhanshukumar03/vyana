import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { useHealthStore } from './store/useHealthStore'

if (import.meta.env.DEV) {
  // @ts-expect-error dev inspect helper
  window.__healthStore = useHealthStore;
  // @ts-expect-error dev inspect helper
  window.useHealthStore = useHealthStore;
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

