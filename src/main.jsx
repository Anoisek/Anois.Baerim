import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import './i18n'
import App from './App.jsx'
import MovedNotice from './components/MovedNotice.jsx'
import { applyIncomingMigration, isOldHost } from './utils/domainMigration'

applyIncomingMigration()

createRoot(document.getElementById('root')).render(
  <StrictMode>
    {isOldHost() ? <MovedNotice /> : <App />}
  </StrictMode>,
)
