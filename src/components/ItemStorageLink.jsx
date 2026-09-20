import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

// Admin-only shortcut to the item storage page, same convention as
// DogTrackerLink / MokokoFinderLink (stacked below them on the right edge).
export default function ItemStorageLink() {
  const { isAdmin } = useAuth()

  if (!isAdmin) return null

  return (
    <Link
      to="/item-storage"
      title="Item storage"
      className="fixed top-68 right-4 z-40 flex items-center gap-1.5 bg-gray-900/95 backdrop-blur border border-gray-700 hover:border-yellow-400/50 rounded-full px-3 py-1.5 shadow-lg shadow-black/30 text-xs font-semibold text-gray-200 hover:text-yellow-400 transition-colors whitespace-nowrap"
    >
      📦 Item storage
    </Link>
  )
}
