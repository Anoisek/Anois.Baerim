import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import { NightModeProvider } from './context/NightModeContext'
import NicknamePrompt from './components/NicknamePrompt'
import DimOverlay from './components/DimOverlay'
import Home from './pages/Home'
import Login from './pages/Login'
import Materials from './pages/Materials'
import MaterialDetail from './pages/MaterialDetail'
import MaterialUsage from './pages/MaterialUsage'
import Systems from './pages/Systems'
import Maps from './pages/Maps'
import BuildCalculator from './pages/BuildCalculator'
import Category from './pages/Category'
import Subcategory from './pages/Subcategory'
import ItemDetail from './pages/ItemDetail'
import ItemUsage from './pages/ItemUsage'

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <NightModeProvider>
          <NicknamePrompt />
          <DimOverlay />
          <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/login" element={<Login />} />
          <Route path="/materials" element={<Materials />} />
          <Route path="/materials/:materialId" element={<MaterialDetail />} />
          <Route path="/materials/:materialId/usage" element={<MaterialUsage />} />
          <Route path="/systems" element={<Systems />} />
          <Route path="/systems/interactive-map" element={<Maps />} />
          <Route path="/systems/interactive-map/:mapId" element={<Maps />} />
          <Route path="/buildcalculator" element={<BuildCalculator />} />
          <Route path="/chapter/:categoryId" element={<Category />} />
          <Route path="/chapter/:categoryId/sub/:subcategoryId" element={<Subcategory />} />
          <Route path="/chapter/:categoryId/item/:itemId" element={<ItemDetail />} />
          <Route path="/items/:itemId/usage" element={<ItemUsage />} />
          </Routes>
        </NightModeProvider>
      </AuthProvider>
    </BrowserRouter>
  )
}
