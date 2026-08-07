import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import Home from './pages/Home'
import Login from './pages/Login'
import Materials from './pages/Materials'
import MaterialDetail from './pages/MaterialDetail'
import MaterialUsage from './pages/MaterialUsage'
import Systems from './pages/Systems'
import ShoppingList from './pages/ShoppingList'
import Category from './pages/Category'
import Subcategory from './pages/Subcategory'
import ItemDetail from './pages/ItemDetail'
import ItemUsage from './pages/ItemUsage'

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/login" element={<Login />} />
          <Route path="/materials" element={<Materials />} />
          <Route path="/materials/:materialId" element={<MaterialDetail />} />
          <Route path="/materials/:materialId/usage" element={<MaterialUsage />} />
          <Route path="/systems" element={<Systems />} />
          <Route path="/shoppinglist" element={<ShoppingList />} />
          <Route path="/chapter/:categoryId" element={<Category />} />
          <Route path="/chapter/:categoryId/sub/:subcategoryId" element={<Subcategory />} />
          <Route path="/chapter/:categoryId/item/:itemId" element={<ItemDetail />} />
          <Route path="/items/:itemId/usage" element={<ItemUsage />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  )
}
