import { Link } from 'react-router-dom'

// items: [{ label, to? }] — the last item usually has no `to` (current page)
export default function Breadcrumbs({ items }) {
  return (
    <nav className="flex items-center gap-1.5 text-sm text-gray-500 mb-4 flex-wrap">
      {items.map((item, i) => (
        <span key={i} className="flex items-center gap-1.5">
          {i > 0 && <span className="text-gray-700">/</span>}
          {item.to
            ? <Link to={item.to} className="hover:text-yellow-400 transition-colors">{item.label}</Link>
            : <span className="text-gray-300">{item.label}</span>}
        </span>
      ))}
    </nav>
  )
}
