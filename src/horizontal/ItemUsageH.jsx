import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { db } from '../dbClient'
import NavbarH from './NavbarH'
import Breadcrumbs from '../components/Breadcrumbs'
import Spinner from '../components/Spinner'
import { itemImages } from '../utils/itemImages'
import { formatItemName } from '../utils/itemName'
import { slugify } from '../utils/slug'
import { RowList, Row, EmptyState } from './ui'

function dedupeById(rows) {
  return Array.from(new Map(rows.map(r => [r.id, r])).values())
}

export default function ItemUsageH() {
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
    <div className="min-h-screen bg-[#14110d] text-white">
      <NavbarH />
      <div className="max-w-[90rem] mx-auto px-6 py-8">
        {loading ? (
          <div className="py-20 flex justify-center"><Spinner /></div>
        ) : (
          <>
            <Breadcrumbs items={[
              { label: t('common.home'), to: '/' },
              { label: chapterName ?? t('common.chapter'), to: item ? `/chapter/${chapterName ? slugify(chapterName) : item.category_id}` : undefined },
              { label: item ? formatItemName(item) : t('common.item'), to: item ? `/chapter/${chapterName ? slugify(chapterName) : item.category_id}/item/${slugify(item.name)}` : undefined },
              { label: t('itemUsage.usage') },
            ]} />

            <div className="flex items-center gap-5 my-4 px-5 py-4 rounded-xl border border-white/10 bg-black/20">
              <div className="w-16 h-16 shrink-0 flex items-center justify-center rounded-lg bg-black/30 border border-white/5">
                {item && itemImages(item).length > 0 ? <img src={itemImages(item)[0]} alt={item.name} className="w-11 h-11 object-contain drop-shadow-lg" /> : <span className="text-3xl">⚔️</span>}
              </div>
              <div>
                <h1 className="text-xl font-bold text-yellow-400">{item ? formatItemName(item) : ''}</h1>
                <p className="text-sm text-gray-500">{t('itemUsage.usedIn')}</p>
              </div>
            </div>

            {usedInItems.length === 0 ? (
              <EmptyState emoji="📭" text={t('itemUsage.notUsedAnywhere')} />
            ) : (
              <div className="flex flex-col gap-2">
                <h2 className="text-xs font-bold text-gray-400 uppercase tracking-widest">{t('itemUsage.items')}</h2>
                <RowList>
                  {usedInItems.map(it => (
                    <Row key={it.id} to={`/chapter/${it.category_id}/item/${slugify(it.name)}`} image={it.image_url} emoji="⚔️" label={formatItemName(it)} />
                  ))}
                </RowList>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
