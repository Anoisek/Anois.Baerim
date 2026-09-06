import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { db } from '../dbClient'
import NavbarH from './NavbarH'
import Breadcrumbs from '../components/Breadcrumbs'
import Spinner from '../components/Spinner'
import { formatItemName } from '../utils/itemName'
import { slugify, findBySlugOrId } from '../utils/slug'
import { RowList, Row, EmptyState } from './ui'

function dedupeById(rows) {
  return Array.from(new Map(rows.map(r => [r.id, r])).values())
}

export default function MaterialUsageH() {
  const { t } = useTranslation()
  const { materialId: materialParam } = useParams()
  const [materialId, setMaterialId] = useState(null)
  const [material, setMaterial] = useState(null)
  const [usedInItems, setUsedInItems] = useState([])
  const [usedInMaterials, setUsedInMaterials] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    setMaterialId(null)
    db.from('materials').select('id, name').then(({ data }) => {
      if (cancelled) return
      const resolved = findBySlugOrId(data ?? [], materialParam)
      if (!resolved) setLoading(false)
      setMaterialId(resolved?.id ?? null)
    })
    return () => { cancelled = true }
  }, [materialParam])

  useEffect(() => {
    if (!materialId) return
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
    <div className="min-h-screen bg-[#14110d] text-white">
      <NavbarH />
      <div className="max-w-[90rem] mx-auto px-6 py-8">
        {loading ? (
          <div className="py-20 flex justify-center"><Spinner /></div>
        ) : (
          <>
            <Breadcrumbs items={[
              { label: t('common.home'), to: '/' },
              { label: t('materials.title'), to: '/materials' },
              { label: material?.name ?? t('common.material'), to: material?.name ? `/materials/${slugify(material.name)}` : undefined },
              { label: t('materialUsage.usage') },
            ]} />

            <div className="flex items-center gap-5 my-4 px-5 py-4 rounded-xl border border-white/10 bg-black/20">
              <div className="w-16 h-16 shrink-0 flex items-center justify-center rounded-lg bg-black/30 border border-white/5">
                {material?.image_url ? <img src={material.image_url} alt={material.name} className="w-11 h-11 object-contain drop-shadow-lg" /> : <span className="text-3xl">🧪</span>}
              </div>
              <div>
                <h1 className="text-xl font-bold text-yellow-400">{material?.name}</h1>
                <p className="text-sm text-gray-500">{t('materialUsage.usedIn')}</p>
              </div>
            </div>

            {isEmpty ? (
              <EmptyState emoji="📭" text={t('materialUsage.notUsedAnywhere')} />
            ) : (
              <div className="flex flex-col gap-6">
                {usedInItems.length > 0 && (
                  <div className="flex flex-col gap-2">
                    <h2 className="text-xs font-bold text-gray-400 uppercase tracking-widest">{t('materialUsage.items')}</h2>
                    <RowList>
                      {usedInItems.map(item => (
                        <Row key={item.id} to={`/chapter/${item.category_id}/item/${slugify(item.name)}`} image={item.image_url} emoji="⚔️" label={formatItemName(item)} />
                      ))}
                    </RowList>
                  </div>
                )}
                {usedInMaterials.length > 0 && (
                  <div className="flex flex-col gap-2">
                    <h2 className="text-xs font-bold text-gray-400 uppercase tracking-widest">{t('materialUsage.materials')}</h2>
                    <RowList>
                      {usedInMaterials.map(mat => (
                        <Row key={mat.id} to={`/materials/${slugify(mat.name)}`} image={mat.image_url} emoji="🧪" label={mat.name} />
                      ))}
                    </RowList>
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
