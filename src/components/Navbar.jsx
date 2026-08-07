import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../supabaseClient'

export default function Navbar() {
  const { isAdmin } = useAuth()
  const navigate = useNavigate()

  async function handleLogout() {
    await supabase.auth.signOut()
    navigate('/')
  }

  return (
    <nav className="sticky top-0 z-50 bg-gray-900/80 backdrop-blur border-b border-gray-800 px-6 py-3.5 flex items-center justify-between shadow-lg shadow-black/20 relative">
      <Link to="/" className="flex items-center gap-2 hover:opacity-90 transition-opacity">
        <img src="/small_logo.png" alt="logo" className="h-8 w-auto" />
        <span className="text-yellow-400 font-bold text-lg tracking-tight">Baerim Calculator</span>
      </Link>
      <span className="hidden md:block absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-[11px] text-gray-600 pointer-events-none select-none">
        Unofficial fan-made tool, not affiliated with Baerim's team
      </span>
      <div className="flex items-center gap-4">
        {isAdmin ? (
          <>
            <span className="text-xs bg-yellow-400 text-gray-950 font-bold px-2.5 py-1 rounded-full">ADMIN</span>
            <button onClick={handleLogout} className="text-sm text-gray-500 hover:text-white transition-colors">
              Log out
            </button>
          </>
        ) : (
          <Link to="/login" className="text-sm text-gray-500 hover:text-white transition-colors">
            Admin login
          </Link>
        )}
      </div>
    </nav>
  )
}
