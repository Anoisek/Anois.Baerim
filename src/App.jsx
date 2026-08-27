import { lazy, Suspense } from 'react'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import { NightModeProvider } from './context/NightModeContext'
import { UiScaleProvider } from './context/UiScaleContext'
import { ModalQueueProvider } from './context/ModalQueueContext'
import ScrollToTop from './components/ScrollToTop'
import NicknamePrompt from './components/NicknamePrompt'
import Footer from './components/Footer'
import DomainChangeNotice from './components/DomainChangeNotice'
import RestoreOldDataButton from './components/RestoreOldDataButton'
import VisitorPing from './components/VisitorPing'
import VisitorStatsWidget from './components/VisitorStatsWidget'
import Home from './pages/Home'
import Login from './pages/Login'
import Materials from './pages/Materials'
import MaterialDetail from './pages/MaterialDetail'
import MaterialUsage from './pages/MaterialUsage'
import Systems from './pages/Systems'
import Bonuses from './pages/Bonuses'
import Alchemy from './pages/Alchemy'
import Exploration from './pages/Exploration'
import ExplorationLevel from './pages/ExplorationLevel'
import Maps from './pages/Maps'
import MetinCalculator from './pages/MetinCalculator'
import MetinDetail from './pages/MetinDetail'
import BuildCalculator from './pages/BuildCalculator'
import Category from './pages/Category'
import Subcategory from './pages/Subcategory'
import ItemDetail from './pages/ItemDetail'
import ItemUsage from './pages/ItemUsage'
import PrivacyPolicy from './pages/PrivacyPolicy'
import Suggestions from './pages/Suggestions'
import Spinner from './components/Spinner'

// Lazy-loaded: pulls in three.js, which is heavy enough that every other page
// shouldn't pay for it in their initial bundle just because this one route exists.
const ColorSystem = lazy(() => import('./pages/ColorSystem'))

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <NightModeProvider>
        <UiScaleProvider>
        <ModalQueueProvider>
          <ScrollToTop />
          <NicknamePrompt />
          <DomainChangeNotice />
          <RestoreOldDataButton />
          <VisitorPing />
          <VisitorStatsWidget />
          <div className="min-h-screen flex flex-col">
            <div className="flex-1 flex flex-col">
              <Routes>
              <Route path="/" element={<Home />} />
              <Route path="/login" element={<Login />} />
              <Route path="/materials" element={<Materials />} />
              <Route path="/materials/:materialId" element={<MaterialDetail />} />
              <Route path="/materials/:materialId/usage" element={<MaterialUsage />} />
              <Route path="/systems" element={<Systems />} />
              <Route path="/systems/bonuses" element={<Bonuses />} />
              <Route path="/systems/alchemy" element={<Alchemy />} />
              <Route path="/systems/exploration" element={<Exploration />} />
              <Route path="/systems/exploration/:level" element={<ExplorationLevel />} />
              <Route path="/systems/interactive-map" element={<Maps />} />
              <Route path="/systems/interactive-map/:mapId" element={<Maps />} />
              <Route path="/systems/metin-calculator" element={<MetinCalculator />} />
              <Route path="/systems/metin-calculator/:metinId" element={<MetinDetail />} />
              <Route path="/systems/color-system" element={
                <Suspense fallback={<div className="min-h-screen flex items-center justify-center"><Spinner /></div>}>
                  <ColorSystem />
                </Suspense>
              } />
              <Route path="/buildcalculator" element={<BuildCalculator />} />
              <Route path="/chapter/:categoryId" element={<Category />} />
              <Route path="/chapter/:categoryId/sub/:subcategoryId" element={<Subcategory />} />
              <Route path="/chapter/:categoryId/item/:itemId" element={<ItemDetail />} />
              <Route path="/items/:itemId/usage" element={<ItemUsage />} />
              <Route path="/privacy-policy" element={<PrivacyPolicy />} />
              <Route path="/suggestions" element={<Suggestions />} />
              </Routes>
            </div>
            <Footer />
          </div>
        </ModalQueueProvider>
        </UiScaleProvider>
        </NightModeProvider>
      </AuthProvider>
    </BrowserRouter>
  )
}
