import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { db } from '../dbClient'
import Navbar from '../components/Navbar'
import Breadcrumbs from '../components/Breadcrumbs'
import Spinner from '../components/Spinner'
import { itemImages } from '../utils/itemImages'
import { formatItemName } from '../utils/itemName'

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
  const { t } = useTranslation()
  const { itemId } = useParams()
  const [item, setItem] = useState(null)
  const [usedInItems, setUsedInItems] = useState([])
  const [chapterName, setChapterName] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([
      db.from('items').select('id, name, image_url, image_urls, category_id').eq('id', itemId).single(),
      db.from('item_items').select('item_id').eq('component_item_id', itemId),
      db.from('items').select('id, name, image_url, category_id'),
    ]).then(([itemRes, rows, allItemsRes]) => {
      setItem(itemRes.data)
      const itemsById = Object.fromEntries((allItemsRes.data ?? []).map(i => [i.id, i]))
      setUsedInItems(dedupeById((rows.data ?? []).map(r => itemsById[r.item_id]).filter(Boolean)))
      setLoading(false)
      if (itemRes.data?.category_id) {
        db.from('categories').select('name').eq('id', itemRes.data.category_id).single()
          .then(({ data }) => setChapterName(data?.name ?? null))
      }
    })
  }, [itemId])

  return (
    <div className="text-white">
      <Navbar />
      <div className="max-w-2xl mx-auto px-6 py-10">
        <div className="bg-black/50 backdrop-blur-sm rounded-2xl p-6">
        {loading ? <Spinner /> : (
          <>
            <Breadcrumbs items={[
              { label: t('common.home'), to: '/' },
              { label: chapterName ?? t('common.chapter'), to: item ? `/chapter/${item.category_id}` : undefined },
              { label: item ? formatItemName(item) : t('common.item'), to: item ? `/chapter/${item.category_id}/item/${item.id}` : undefined },
              { label: t('itemUsage.usage') },
            ]} />

            <div className="flex items-center gap-5 mb-8 p-5 bg-gray-900 border border-gray-700 rounded-2xl">
              <div className="w-20 h-20 shrink-0 flex items-center justify-center">
                {item && itemImages(item).length > 0
                  ? <img src={itemImages(item)[0]} alt={item.name} className="w-full h-full object-contain drop-shadow-lg" />
                  : <span className="text-5xl">⚔️</span>}
              </div>
              <div>
                <h1 className="text-2xl font-bold text-yellow-400">{item ? formatItemName(item) : ''}</h1>
                <p className="text-sm text-gray-500">{t('itemUsage.usedIn')}</p>
              </div>
            </div>

            {usedInItems.length === 0 ? (
              <div className="flex flex-col items-center py-20 text-gray-500 gap-3">
                <span className="text-5xl">📭</span>
                <p className="text-sm">{t('itemUsage.notUsedAnywhere')}</p>
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                <h2 className="text-xs font-bold text-gray-400 uppercase tracking-widest">{t('itemUsage.items')}</h2>
                <div className="flex flex-col gap-2">
                  {usedInItems.map(it => (
                    <UsageRow key={it.id} to={`/chapter/${it.category_id}/item/${it.id}`} image={it.image_url} name={formatItemName(it)} />
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
