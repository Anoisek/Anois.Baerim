import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import './i18n'
import App from './App.jsx'
import { applyIncomingMigration, redirectToNewDomain, exportPayloadToOpenerIfPopup } from './utils/domainMigration'

applyIncomingMigration()

if (!exportPayloadToOpenerIfPopup() && !redirectToNewDomain()) {
  createRoot(document.getElementById('root')).render(
    <StrictMode>
      <App />
    </StrictMode>,
  )
}
