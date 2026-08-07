import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import Home from './pages/Home'
import Login from './pages/Login'
import Materials from './pages/Materials'
import Systems from './pages/Systems'
import Category from './pages/Category'
import Subcategory from './pages/Subcategory'
import ItemDetail from './pages/ItemDetail'

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/login" element={<Login />} />
          <Route path="/materials" element={<Materials />} />
          <Route path="/systems" element={<Systems />} />
          <Route path="/chapter/:categoryId" element={<Category />} />
          <Route path="/chapter/:categoryId/sub/:subcategoryId" element={<Subcategory />} />
          <Route path="/chapter/:categoryId/item/:itemId" element={<ItemDetail />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  )
}
