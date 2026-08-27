import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { db } from '../dbClient'
import { useAuth } from '../context/AuthContext'
import Navbar from '../components/Navbar'
import Breadcrumbs from '../components/Breadcrumbs'
import Spinner from '../components/Spinner'
import AddBonusModal from '../components/AddBonusModal'
import EditBonusModal from '../components/EditBonusModal'
import AddBonusItemModal from '../components/AddBonusItemModal'
import EditBonusItemModal from '../components/EditBonusItemModal'

function formatValue(n) {
  return Number(n.toFixed(2)).toString()
}

function BonusItemTile({ item, isAdmin, onEdit }) {
  const isSixSeven = item.name.toLowerCase().includes('6/7 bonus')
  return (
    <div className="group relative flex items-center justify-center p-2 transition-transform hover:scale-110">
      <div className="w-16 h-16 flex items-center justify-center">
        {item.image_url
          ? <img src={item.image_url} alt={item.name} className="w-full h-full object-contain drop-shadow-lg" />
          : <span className="text-4xl">🎁</span>}
      </div>

      {isSixSeven && (
        <img src="/67.png" alt="6/7" className="pointer-events-none absolute bottom-0.5 right-0.5 w-6 h-6 object-contain drop-shadow" />
      )}

      <div className="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-2 z-20 hidden group-hover:flex flex-col items-center">
        <div className="bg-gray-950 border border-gray-700 rounded-lg px-3 py-1.5 text-xs text-center whitespace-nowrap shadow-lg">
          <div className="font-semibold text-gray-100">{item.name}</div>
          <div className="text-yellow-400 font-bold">+{formatValue(item.value)}%</div>
        </div>
      </div>

      {isAdmin && (
        <button
          onClick={e => { e.preventDefault(); e.stopPropagation(); onEdit() }}
          className="absolute top-1.5 right-1.5 text-gray-600 hover:text-yellow-400 opacity-0 group-hover:opacity-100 transition-all text-sm z-10"
          title="Edit"
        >
          ✏️
        </button>
      )}
    </div>
  )
}

export default function Bonuses() {
  const { t } = useTranslation()
  const { isAdmin } = useAuth()
  const [maintenance, setMaintenance] = useState(false)
  const [bonuses, setBonuses] = useState([])
  const [itemsByBonusId, setItemsByBonusId] = useState({})
  const [currentIndex, setCurrentIndex] = useState(0)
  const [loading, setLoading] = useState(true)
  const [showAddBonus, setShowAddBonus] = useState(false)
  const [editingBonus, setEditingBonus] = useState(null)
  const [showAddItem, setShowAddItem] = useState(false)
  const [editingItem, setEditingItem] = useState(null)
  const [showBonusPicker, setShowBonusPicker] = useState(false)
  const bonusPickerRef = useRef(null)

  useEffect(() => {
    if (!showBonusPicker) return
    function handleClickOutside(e) {
      if (bonusPickerRef.current && !bonusPickerRef.current.contains(e.target)) setShowBonusPicker(false)
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [showBonusPicker])

  useEffect(() => {
    Promise.all([
      db.from('settings').select('value').eq('key', 'system_bonuses_maintenance').maybeSingle(),
      db.from('bonuses').select('*').order('sort_order'),
      db.from('bonus_items').select('*').order('sort_order'),
    ]).then(([maintRes, bonusesRes, itemsRes]) => {
      setMaintenance(maintRes.data?.value === 'true')
      setBonuses(bonusesRes.data ?? [])
      const grouped = {}
      for (const item of itemsRes.data ?? []) {
        (grouped[item.bonus_id] ??= []).push(item)
      }
      setItemsByBonusId(grouped)
      setLoading(false)
    })
  }, [])

  const blocked = maintenance && !isAdmin
  const currentBonus = bonuses[currentIndex] ?? null
  const currentItems = currentBonus ? (itemsByBonusId[currentBonus.id] ?? []) : []
  const maxBonus = currentItems.reduce((sum, i) => sum + (i.value || 0), 0)
  const allItemImages = [...new Set(Object.values(itemsByBonusId).flat().map(i => i.image_url).filter(Boolean))]

  // Icons can be shared across items (see ExistingImagePicker) — never physically
  // delete an image_url that another item still points at.
  function isImageUsedElsewhere(url, excludeItemIds) {
    const excluded = Array.isArray(excludeItemIds) ? excludeItemIds : [excludeItemIds]
    return Object.values(itemsByBonusId).flat().some(i => i.image_url === url && !excluded.includes(i.id))
  }

  function prevBonus() {
    setCurrentIndex(i => (i - 1 + bonuses.length) % bonuses.length)
  }
  function nextBonus() {
    setCurrentIndex(i => (i + 1) % bonuses.length)
  }

  function handleBonusAdded(bonus) {
    setBonuses(prev => [...prev, bonus])
    setCurrentIndex(bonuses.length)
  }
  function handleBonusUpdated(bonus) {
    setBonuses(prev => prev.map(b => b.id === bonus.id ? bonus : b))
  }
  function handleBonusDeleted(id) {
    setItemsByBonusId(prev => {
      const next = { ...prev }
      delete next[id]
      return next
    })
    setBonuses(prev => prev.filter(b => b.id !== id))
    setCurrentIndex(i => Math.max(0, Math.min(i, bonuses.length - 2)))
  }

  function handleItemAdded(item) {
    setItemsByBonusId(prev => ({ ...prev, [item.bonus_id]: [...(prev[item.bonus_id] ?? []), item] }))
  }
  function handleItemUpdated(item) {
    setItemsByBonusId(prev => ({ ...prev, [item.bonus_id]: (prev[item.bonus_id] ?? []).map(i => i.id === item.id ? item : i) }))
  }
  function handleItemDeleted(id, bonusId) {
    setItemsByBonusId(prev => ({ ...prev, [bonusId]: (prev[bonusId] ?? []).filter(i => i.id !== id) }))
  }

  return (
    <div className="text-white">
      <Navbar />
      <div className="max-w-5xl mx-auto px-6 py-10">
        <div className="bg-black/50 backdrop-blur-sm rounded-2xl p-6">
          <Breadcrumbs items={[
            { label: t('common.home'), to: '/' },
            { label: t('systems.title'), to: '/systems' },
            { label: t('systems.bonuses') },
          ]} />
          <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold text-gray-100">{t('systems.bonuses')}</h1>
              {maintenance && isAdmin && (
                <span className="text-xs font-bold text-yellow-400 bg-gray-900 border border-yellow-400/40 px-2 py-1 rounded-full">
                  🚧 {t('common.inProgress')}
                </span>
              )}
            </div>
            {isAdmin && !blocked && (
              <button
                onClick={() => setShowAddBonus(true)}
                className="bg-yellow-400 hover:bg-yellow-300 text-gray-950 font-bold px-4 py-2 rounded-xl text-sm transition-colors"
              >
                + Add bonus
              </button>
            )}
          </div>

          {loading ? <Spinner /> : blocked ? (
            <div className="flex flex-col items-center py-20 text-gray-500 gap-3">
              <span className="text-5xl">🚧</span>
              <p className="text-sm">{t('systems.blockedMessage')}</p>
            </div>
          ) : bonuses.length === 0 ? (
            <div className="flex flex-col items-center py-20 text-gray-500 gap-3">
              <span className="text-5xl">🎁</span>
              <p className="text-sm">{t('systems.noBonusesYet')}</p>
            </div>
          ) : (
            <>
              <div className="flex items-center justify-center gap-4 mb-2">
                <button
                  onClick={prevBonus}
                  disabled={bonuses.length < 2}
                  className="shrink-0 text-2xl px-3 py-1 rounded-lg text-gray-300 hover:bg-gray-800 hover:text-yellow-400 disabled:opacity-30 disabled:hover:bg-transparent transition-colors"
                  aria-label="Previous bonus"
                >
                  ◀
                </button>
                <div className="relative flex items-center gap-2 w-56 sm:w-[26rem] justify-center" ref={bonusPickerRef}>
                  <button
                    type="button"
                    onClick={() => setShowBonusPicker(v => !v)}
                    className="max-w-full truncate text-xl font-bold text-gray-100 hover:text-yellow-400 text-center transition-colors"
                    title={currentBonus.name}
                  >
                    {currentBonus.name}
                  </button>
                  {isAdmin && (
                    <button
                      onClick={() => setEditingBonus(currentBonus)}
                      className="text-gray-500 hover:text-yellow-400 text-sm transition-colors"
                      title="Edit bonus"
                    >
                      ✏️
                    </button>
                  )}

                  {showBonusPicker && (
                    <div className="absolute top-full mt-2 left-1/2 -translate-x-1/2 z-30 bg-gray-900 border border-gray-700 rounded-xl shadow-xl min-w-[14rem] max-h-72 overflow-y-auto py-1">
                      {bonuses.map((b, i) => (
                        <button
                          key={b.id}
                          type="button"
                          onClick={() => { setCurrentIndex(i); setShowBonusPicker(false) }}
                          className={`w-full text-left px-4 py-2 text-sm transition-colors ${
                            i === currentIndex ? 'bg-yellow-400 text-gray-950 font-semibold' : 'text-gray-200 hover:bg-gray-800'
                          }`}
                        >
                          {b.name}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                <button
                  onClick={nextBonus}
                  disabled={bonuses.length < 2}
                  className="shrink-0 text-2xl px-3 py-1 rounded-lg text-gray-300 hover:bg-gray-800 hover:text-yellow-400 disabled:opacity-30 disabled:hover:bg-transparent transition-colors"
                  aria-label="Next bonus"
                >
                  ▶
                </button>
              </div>

              <p className="text-center text-yellow-400 font-bold mb-6">
                {t('systems.maxBonus')}: +{formatValue(maxBonus)}%
              </p>

              {isAdmin && (
                <div className="flex justify-end mb-3">
                  <button
                    onClick={() => setShowAddItem(true)}
                    className="bg-gray-800 hover:bg-gray-700 border border-gray-600 text-gray-200 font-semibold px-3 py-1.5 rounded-lg text-xs transition-colors"
                  >
                    + Add item
                  </button>
                </div>
              )}

              {currentItems.length === 0 ? (
                <div className="flex flex-col items-center py-16 text-gray-500 gap-3">
                  <span className="text-4xl">📭</span>
                  <p className="text-sm">{t('systems.noItemsYet')}</p>
                </div>
              ) : (
                <div className="flex flex-wrap justify-center gap-2">
                  {currentItems.map(item => (
                    <BonusItemTile
                      key={item.id}
                      item={item}
                      isAdmin={isAdmin}
                      onEdit={() => setEditingItem(item)}
                    />
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {showAddBonus && (
        <AddBonusModal
          nextSortOrder={Math.max(0, ...bonuses.map(b => b.sort_order)) + 10}
          onClose={() => setShowAddBonus(false)}
          onAdded={handleBonusAdded}
        />
      )}
      {editingBonus && (
        <EditBonusModal
          bonus={editingBonus}
          items={itemsByBonusId[editingBonus.id] ?? []}
          isImageUsedElsewhere={isImageUsedElsewhere}
          onClose={() => setEditingBonus(null)}
          onUpdated={handleBonusUpdated}
          onDeleted={handleBonusDeleted}
        />
      )}
      {showAddItem && currentBonus && (
        <AddBonusItemModal
          bonusId={currentBonus.id}
          nextSortOrder={Math.max(0, ...currentItems.map(i => i.sort_order)) + 10}
          existingImages={allItemImages}
          onClose={() => setShowAddItem(false)}
          onAdded={handleItemAdded}
        />
      )}
      {editingItem && (
        <EditBonusItemModal
          item={editingItem}
          existingImages={allItemImages.filter(url => url !== editingItem.image_url)}
          isImageUsedElsewhere={isImageUsedElsewhere}
          onClose={() => setEditingItem(null)}
          onUpdated={handleItemUpdated}
          onDeleted={id => handleItemDeleted(id, editingItem.bonus_id)}
        />
      )}
    </div>
  )
}
