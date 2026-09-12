import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

// Admin-only shortcut to the dogtracker page. Anyone with the direct
// /dogtracker link can still open it — this just keeps it out of the
// regular navbar for everyone else.
export default function DogTrackerLink() {
  const { isAdmin } = useAuth()

  if (!isAdmin) return null

  return (
    <Link
      to="/dogtracker"
      title="Dogtracker"
      className="fixed top-44 right-4 z-40 flex items-center gap-1.5 bg-gray-900/95 backdrop-blur border border-gray-700 hover:border-yellow-400/50 rounded-full px-3 py-1.5 shadow-lg shadow-black/30 text-xs font-semibold text-gray-200 hover:text-yellow-400 transition-colors whitespace-nowrap"
    >
      🧪 Dogtracker
    </Link>
  )
}
