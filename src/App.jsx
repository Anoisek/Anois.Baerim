import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import { NightModeProvider } from './context/NightModeContext'
import { UiScaleProvider } from './context/UiScaleContext'
import { ModalQueueProvider } from './context/ModalQueueContext'
import ScrollToTop from './components/ScrollToTop'
import NicknamePrompt from './components/NicknamePrompt'
import Footer from './components/Footer'
import CookieConsent from './components/CookieConsent'
import GoogleAdsense from './components/GoogleAdsense'
import SideRailAds from './components/SideRailAds'
import MokokoAnnouncement from './components/MokokoAnnouncement'
import DomainChangeNotice from './components/DomainChangeNotice'
import Home from './pages/Home'
import Login from './pages/Login'
import Materials from './pages/Materials'
import MaterialDetail from './pages/MaterialDetail'
import MaterialUsage from './pages/MaterialUsage'
import Systems from './pages/Systems'
import Exploration from './pages/Exploration'
import ExplorationLevel from './pages/ExplorationLevel'
import Maps from './pages/Maps'
import BuildCalculator from './pages/BuildCalculator'
import Category from './pages/Category'
import Subcategory from './pages/Subcategory'
import ItemDetail from './pages/ItemDetail'
import ItemUsage from './pages/ItemUsage'
import PrivacyPolicy from './pages/PrivacyPolicy'
import Suggestions from './pages/Suggestions'

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <NightModeProvider>
        <UiScaleProvider>
        <ModalQueueProvider>
          <ScrollToTop />
          <NicknamePrompt />
          <MokokoAnnouncement />
          <DomainChangeNotice />
          <GoogleAdsense />
          <SideRailAds />
          <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/login" element={<Login />} />
          <Route path="/materials" element={<Materials />} />
          <Route path="/materials/:materialId" element={<MaterialDetail />} />
          <Route path="/materials/:materialId/usage" element={<MaterialUsage />} />
          <Route path="/systems" element={<Systems />} />
          <Route path="/systems/exploration" element={<Exploration />} />
          <Route path="/systems/exploration/:level" element={<ExplorationLevel />} />
          <Route path="/systems/interactive-map" element={<Maps />} />
          <Route path="/systems/interactive-map/:mapId" element={<Maps />} />
          <Route path="/buildcalculator" element={<BuildCalculator />} />
          <Route path="/chapter/:categoryId" element={<Category />} />
          <Route path="/chapter/:categoryId/sub/:subcategoryId" element={<Subcategory />} />
          <Route path="/chapter/:categoryId/item/:itemId" element={<ItemDetail />} />
          <Route path="/items/:itemId/usage" element={<ItemUsage />} />
          <Route path="/privacy-policy" element={<PrivacyPolicy />} />
          <Route path="/suggestions" element={<Suggestions />} />
          </Routes>
          <Footer />
          <CookieConsent />
        </ModalQueueProvider>
        </UiScaleProvider>
        </NightModeProvider>
      </AuthProvider>
    </BrowserRouter>
  )
}
