import { lazy, Suspense } from 'react'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import { NightModeProvider } from './context/NightModeContext'
import { UiScaleProvider } from './context/UiScaleContext'
import { LayoutStyleProvider, useLayoutStyle } from './context/LayoutStyleContext'
import { ModalQueueProvider } from './context/ModalQueueContext'
import HomeH from './horizontal/HomeH'
import ItemDetailH from './horizontal/ItemDetailH'
import MaterialsH from './horizontal/MaterialsH'
import MaterialDetailH from './horizontal/MaterialDetailH'
import MaterialUsageH from './horizontal/MaterialUsageH'
import SystemsH from './horizontal/SystemsH'
import BonusesH from './horizontal/BonusesH'
import AlchemyH from './horizontal/AlchemyH'
import MetinCalculatorH from './horizontal/MetinCalculatorH'
import BuildCalculatorH from './horizontal/BuildCalculatorH'
import CategoryH from './horizontal/CategoryH'
import SubcategoryH from './horizontal/SubcategoryH'
import ItemUsageH from './horizontal/ItemUsageH'
import ExplorationH from './horizontal/ExplorationH'
import ExplorationLevelH from './horizontal/ExplorationLevelH'
import MetinDetailH from './horizontal/MetinDetailH'
import PrivacyPolicyH from './horizontal/PrivacyPolicyH'
import AboutH from './horizontal/AboutH'
import SuggestionsH from './horizontal/SuggestionsH'
import CommunityGuideH from './horizontal/CommunityGuideH'
import MapsH from './horizontal/MapsH'
import FooterH from './horizontal/FooterH'
import ScrollToTop from './components/ScrollToTop'
import NicknamePrompt from './components/NicknamePrompt'
import Footer from './components/Footer'
import PageMeta from './components/PageMeta'
import PageInfo from './components/PageInfo'
import DomainChangeNotice from './components/DomainChangeNotice'
import AdConsentBanner from './components/AdConsentBanner'
import RestoreOldDataButton from './components/RestoreOldDataButton'
import CommunityGuideLink from './components/CommunityGuideLink'
import DogTrackerLink from './components/DogTrackerLink'
import MokokoFinderLink from './components/MokokoFinderLink'
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
import About from './pages/About'
import Suggestions from './pages/Suggestions'
import CommunityGuide from './pages/CommunityGuide'
import DogTracker from './pages/DogTracker'
import OreFinder from './pages/OreFinder'
import MokokoFinder from './pages/MokokoFinder'
import Spinner from './components/Spinner'

// Lazy-loaded: pulls in three.js, which is heavy enough that every other page
// shouldn't pay for it in their initial bundle just because this one route exists.
const ColorSystem = lazy(() => import('./pages/ColorSystem'))
const ColorSystemH = lazy(() => import('./horizontal/ColorSystemH'))

// The site has two independent front-end designs: the original vertical one,
// and a horizontal one built as its own separate set of components (not a
// reskin of the vertical pages). This picks which tree renders per route.
// A route with no horizontal counterpart yet just falls back to the vertical one.
function Routed({ vertical: Vertical, horizontal: Horizontal }) {
  const { horizontal } = useLayoutStyle()
  if (horizontal && Horizontal) return <Horizontal />
  return <Vertical />
}

function AppFooter() {
  const { horizontal } = useLayoutStyle()
  return horizontal ? <FooterH /> : <Footer />
}

// Horizontal pages paint their own bg-[#14110d], but this shell is what's
// actually behind the seams (overscroll bounce, a page shorter than the
// viewport) — without its own matching background the old body texture
// would show through there instead.
function AppShell({ children }) {
  const { horizontal } = useLayoutStyle()
  return <div className={`min-h-screen flex flex-col ${horizontal ? 'bg-[#14110d]' : ''}`}>{children}</div>
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <NightModeProvider>
        <UiScaleProvider>
        <LayoutStyleProvider>
        <ModalQueueProvider>
          <ScrollToTop />
          <PageMeta />
          <NicknamePrompt />
          <DomainChangeNotice />
          <AdConsentBanner />
          <RestoreOldDataButton />
          <CommunityGuideLink />
          <DogTrackerLink />
          <MokokoFinderLink />
          <AppShell>
            <div className="flex-1 flex flex-col">
              <Routes>
              <Route path="/" element={<Routed vertical={Home} horizontal={HomeH} />} />
              <Route path="/login" element={<Login />} />
              <Route path="/materials" element={<Routed vertical={Materials} horizontal={MaterialsH} />} />
              <Route path="/materials/:materialId" element={<Routed vertical={MaterialDetail} horizontal={MaterialDetailH} />} />
              <Route path="/materials/:materialId/usage" element={<Routed vertical={MaterialUsage} horizontal={MaterialUsageH} />} />
              <Route path="/systems" element={<Routed vertical={Systems} horizontal={SystemsH} />} />
              <Route path="/systems/bonuses" element={<Routed vertical={Bonuses} horizontal={BonusesH} />} />
              <Route path="/systems/alchemy" element={<Routed vertical={Alchemy} horizontal={AlchemyH} />} />
              <Route path="/systems/exploration" element={<Routed vertical={Exploration} horizontal={ExplorationH} />} />
              <Route path="/systems/exploration/:level" element={<Routed vertical={ExplorationLevel} horizontal={ExplorationLevelH} />} />
              <Route path="/systems/interactive-map" element={<Routed vertical={Maps} horizontal={MapsH} />} />
              <Route path="/systems/interactive-map/:mapId" element={<Routed vertical={Maps} horizontal={MapsH} />} />
              <Route path="/systems/metin-calculator" element={<Routed vertical={MetinCalculator} horizontal={MetinCalculatorH} />} />
              <Route path="/systems/metin-calculator/:metinId" element={<Routed vertical={MetinDetail} horizontal={MetinDetailH} />} />
              <Route path="/systems/color-system" element={
                <Suspense fallback={<div className="min-h-screen flex items-center justify-center"><Spinner /></div>}>
                  <Routed vertical={ColorSystem} horizontal={ColorSystemH} />
                </Suspense>
              } />
              <Route path="/buildcalculator" element={<Routed vertical={BuildCalculator} horizontal={BuildCalculatorH} />} />
              <Route path="/chapter/:categoryId" element={<Routed vertical={Category} horizontal={CategoryH} />} />
              <Route path="/chapter/:categoryId/sub/:subcategoryId" element={<Routed vertical={Subcategory} horizontal={SubcategoryH} />} />
              <Route path="/chapter/:categoryId/item/:itemId" element={<Routed vertical={ItemDetail} horizontal={ItemDetailH} />} />
              <Route path="/items/:itemId/usage" element={<Routed vertical={ItemUsage} horizontal={ItemUsageH} />} />
              <Route path="/about" element={<Routed vertical={About} horizontal={AboutH} />} />
              <Route path="/privacy-policy" element={<Routed vertical={PrivacyPolicy} horizontal={PrivacyPolicyH} />} />
              <Route path="/suggestions" element={<Routed vertical={Suggestions} horizontal={SuggestionsH} />} />
              <Route path="/aiguide" element={<Routed vertical={CommunityGuide} horizontal={CommunityGuideH} />} />
              <Route path="/dogtracker" element={<DogTracker />} />
              <Route path="/systems/ore-finder" element={<OreFinder />} />
              <Route path="/mokoko-finder" element={<MokokoFinder />} />
              </Routes>
            </div>
            <PageInfo />
            <AppFooter />
          </AppShell>
        </ModalQueueProvider>
        </LayoutStyleProvider>
        </UiScaleProvider>
        </NightModeProvider>
      </AuthProvider>
    </BrowserRouter>
  )
}
