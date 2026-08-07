import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { supabase } from '../supabaseClient'
import Navbar from '../components/Navbar'
import Breadcrumbs from '../components/Breadcrumbs'
import Spinner from '../components/Spinner'
import { itemImages } from '../utils/itemImages'

function dedupeById(rows) {
  return Array.from(new Map(rows.map(r => [r.id, r])).values())
}

function UsageRow({ to, image, name }) {
  return (
    <Link to={to} className="flex items-center gap-3 p-3 rounded-xl bg-gray-900 border border-gray-700 hover:border-yellow-400/50 hover:bg-gray-800 transition-colors">
      <div className="w-8 h-8 shrink-0 flex items-center justify-center">
        {image ? <img src={image} alt={name} className="w-full h-full object-contain" /> : <span className="text-lg">⚔️</span>}
      </div>
      <span className="text-sm text-gray-200">{name}</span>
    </Link>
  )
}

export default function ItemUsage() {
  const { itemId } = useParams()
  const [item, setItem] = useState(null)
  const [usedInItems, setUsedInItems] = useState([])
  const [chapterName, setChapterName] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([
      supabase.from('items').select('id, name, image_url, image_urls, category_id').eq('id', itemId).single(),
      supabase.from('item_items').select('item:items!item_items_item_id_fkey(id, name, image_url, category_id)').eq('component_item_id', itemId),
    ]).then(([itemRes, rows]) => {
      setItem(itemRes.data)
      setUsedInItems(dedupeById((rows.data ?? []).map(r => r.item).filter(Boolean)))
      setLoading(false)
      if (itemRes.data?.category_id) {
        supabase.from('categories').select('name').eq('id', itemRes.data.category_id).single()
          .then(({ data }) => setChapterName(data?.name ?? null))
      }
    })
  }, [itemId])

  return (
    <div className="min-h-screen text-white">
      <Navbar />
      <div className="max-w-2xl mx-auto px-6 py-10">
        <div className="bg-black/50 backdrop-blur-sm rounded-2xl p-6">
        {loading ? <Spinner /> : (
          <>
            <Breadcrumbs items={[
              { label: 'Home', to: '/' },
              { label: chapterName ?? 'Chapter', to: item ? `/chapter/${item.category_id}` : undefined },
              { label: item?.name ?? 'Item', to: item ? `/chapter/${item.category_id}/item/${item.id}` : undefined },
              { label: 'Usage' },
            ]} />

            <div className="flex items-center gap-5 mb-8 p-5 bg-gray-900 border border-gray-700 rounded-2xl">
              <div className="w-20 h-20 shrink-0 flex items-center justify-center">
                {item && itemImages(item).length > 0
                  ? <img src={itemImages(item)[0]} alt={item.name} className="w-full h-full object-contain drop-shadow-lg" />
                  : <span className="text-5xl">⚔️</span>}
              </div>
              <div>
                <h1 className="text-2xl font-bold text-yellow-400">{item?.name}</h1>
                <p className="text-sm text-gray-500">Used in</p>
              </div>
            </div>

            {usedInItems.length === 0 ? (
              <div className="flex flex-col items-center py-20 text-gray-500 gap-3">
                <span className="text-5xl">📭</span>
                <p className="text-sm">Not used as an ingredient anywhere yet.</p>
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                <h2 className="text-xs font-bold text-gray-400 uppercase tracking-widest">Items</h2>
                <div className="flex flex-col gap-2">
                  {usedInItems.map(it => (
                    <UsageRow key={it.id} to={`/chapter/${it.category_id}/item/${it.id}`} image={it.image_url} name={it.name} />
                  ))}
                </div>
              </div>
            )}
          </>
        )}
        </div>
      </div>
    </div>
  )
}
