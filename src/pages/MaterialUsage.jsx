import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { db } from '../dbClient'
import Navbar from '../components/Navbar'
import Breadcrumbs from '../components/Breadcrumbs'
import Spinner from '../components/Spinner'
import { formatItemName } from '../utils/itemName'

function dedupeById(rows) {
  return Array.from(new Map(rows.map(r => [r.id, r])).values())
}

function UsageRow({ to, image, name, emoji }) {
  return (
    <Link to={to} className="flex items-center gap-3 p-3 rounded-xl bg-gray-900 border border-gray-700 hover:border-yellow-400/50 hover:bg-gray-800 transition-colors">
      <div className="w-8 h-8 shrink-0 flex items-center justify-center">
        {image ? <img src={image} alt={name} className="w-full h-full object-contain" /> : <span className="text-lg">{emoji}</span>}
      </div>
      <span className="text-sm text-gray-200">{name}</span>
    </Link>
  )
}

export default function MaterialUsage() {
  const { t } = useTranslation()
  const { materialId } = useParams()
  const [material, setMaterial] = useState(null)
  const [usedInItems, setUsedInItems] = useState([])
  const [usedInMaterials, setUsedInMaterials] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([
      db.from('materials').select('id, name, image_url').eq('id', materialId).single(),
      db.from('item_materials').select('item_id').eq('material_id', materialId),
      db.from('material_materials').select('material_id').eq('component_id', materialId),
      db.from('items').select('id, name, image_url, category_id'),
      db.from('materials').select('id, name, image_url'),
    ]).then(([matRes, itemRows, matRows, allItemsRes, allMaterialsRes]) => {
      setMaterial(matRes.data)
      const itemsById = Object.fromEntries((allItemsRes.data ?? []).map(i => [i.id, i]))
      const materialsById = Object.fromEntries((allMaterialsRes.data ?? []).map(m => [m.id, m]))
      setUsedInItems(dedupeById((itemRows.data ?? []).map(r => itemsById[r.item_id]).filter(Boolean)))
      setUsedInMaterials(dedupeById((matRows.data ?? []).map(r => materialsById[r.material_id]).filter(Boolean)))
      setLoading(false)
    })
  }, [materialId])

  const isEmpty = usedInItems.length === 0 && usedInMaterials.length === 0

  return (
    <div className="text-white">
      <Navbar />
      <div className="max-w-2xl mx-auto px-6 py-10">
        <div className="bg-black/50 backdrop-blur-sm rounded-2xl p-6">
        {loading ? <Spinner /> : (
          <>
            <Breadcrumbs items={[
              { label: t('common.home'), to: '/' },
              { label: t('materials.title'), to: '/materials' },
              { label: material?.name ?? t('common.material'), to: material?.id ? `/materials/${material.id}` : undefined },
              { label: t('materialUsage.usage') },
            ]} />

            <div className="flex items-center gap-5 mb-8 p-5 bg-gray-900 border border-gray-700 rounded-2xl">
              <div className="w-20 h-20 shrink-0 flex items-center justify-center">
                {material?.image_url
                  ? <img src={material.image_url} alt={material.name} className="w-full h-full object-contain drop-shadow-lg" />
                  : <span className="text-5xl">🧪</span>}
              </div>
              <div>
                <h1 className="text-2xl font-bold text-yellow-400">{material?.name}</h1>
                <p className="text-sm text-gray-500">{t('materialUsage.usedIn')}</p>
              </div>
            </div>

            {isEmpty ? (
              <div className="flex flex-col items-center py-20 text-gray-500 gap-3">
                <span className="text-5xl">📭</span>
                <p className="text-sm">{t('materialUsage.notUsedAnywhere')}</p>
              </div>
            ) : (
              <div className="flex flex-col gap-6">
                {usedInItems.length > 0 && (
                  <div className="flex flex-col gap-2">
                    <h2 className="text-xs font-bold text-gray-400 uppercase tracking-widest">{t('materialUsage.items')}</h2>
                    <div className="flex flex-col gap-2">
                      {usedInItems.map(item => (
                        <UsageRow key={item.id} to={`/chapter/${item.category_id}/item/${item.id}`} image={item.image_url} name={formatItemName(item)} emoji="⚔️" />
                      ))}
                    </div>
                  </div>
                )}
                {usedInMaterials.length > 0 && (
                  <div className="flex flex-col gap-2">
                    <h2 className="text-xs font-bold text-gray-400 uppercase tracking-widest">{t('materialUsage.materials')}</h2>
                    <div className="flex flex-col gap-2">
                      {usedInMaterials.map(mat => (
                        <UsageRow key={mat.id} to={`/materials/${mat.id}`} image={mat.image_url} name={mat.name} emoji="🧪" />
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </>
        )}
        </div>
      </div>
    </div>
  )
}
