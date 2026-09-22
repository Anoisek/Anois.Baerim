import { useCallback, useEffect, useRef, useState } from 'react'
import { db } from '../dbClient'
import { useAuth } from '../context/AuthContext'
import Navbar from '../components/Navbar'
import Breadcrumbs from '../components/Breadcrumbs'
import Spinner from '../components/Spinner'
import ItemStorageModal, { UPGRADE_LEVELS } from '../components/ItemStorageModal'
import { MAP_CHAPTERS } from '../utils/mapChapters'

const CLASSES = ['Warrior', 'Ninja', 'Sura', 'Shaman']

// Admin-only. Chapter I / II -> subcategory tabs (a private copy of the public
// ones, see migrations/0017_item_storage.sql) -> items with per-upgrade-level bonuses.
export default function ItemStorage() {
  const { isAdmin } = useAuth()
  const [tabs, setTabs] = useState([])
  const [items, setItems] = useState([])
  const [bonuses, setBonuses] = useState([])
  const [itemBonuses, setItemBonuses] = useState([])
  const [loading, setLoading] = useState(true)
  const [chapter, setChapter] = useState(1)
  const [tabId, setTabId] = useState(null)
  const [classFilter, setClassFilter] = useState(null)
  const [modal, setModal] = useState(null) // { item } — item null = adding
  const [reordering, setReordering] = useState(false)
  const [dragItemId, setDragItemId] = useState(null)
  const dragOrigValues = useRef([])

  const load = useCallback(async () => {
    const [tabRes, itemRes, bonusRes, ibRes] = await Promise.all([
      db.from('storage_tabs').select('*').order('sort_order'),
      db.from('storage_items').select('*').order('sort_order'),
      db.from('storage_bonuses').select('*'),
      db.from('storage_item_bonuses').select('*').order('sort_order'),
    ])
    setTabs(tabRes.data ?? [])
    setItems(itemRes.data ?? [])
    setBonuses(bonusRes.data ?? [])
    setItemBonuses(ibRes.data ?? [])
    setLoading(false)
  }, [])

  useEffect(() => {
    if (isAdmin) load()
  }, [isAdmin, load])

  const chapterTabs = tabs.filter(t => t.chapter === chapter)
  const activeTab = chapterTabs.find(t => t.id === tabId) ?? chapterTabs[0] ?? null
  const allTabItems = activeTab ? items.filter(i => i.tab_id === activeTab.id) : []
  const tabItems = classFilter ? allTabItems.filter(i => (i.classes ?? []).includes(classFilter)) : allTabItems
  const bonusName = id => bonuses.find(b => b.id === id)?.name ?? '?'
  const usedImages = [...new Set(items.map(i => i.image_url).filter(Boolean))]

  async function moveItem(item, direction) {
    const idx = tabItems.findIndex(i => i.id === item.id)
    const swapWith = tabItems[idx + direction]
    if (!swapWith) return
    const a = item.sort_order
    const b = swapWith.sort_order
    setItems(prev => prev.map(i => {
      if (i.id === item.id) return { ...i, sort_order: b }
      if (i.id === swapWith.id) return { ...i, sort_order: a }
      return i
    }))
    await Promise.all([
      db.from('storage_items').update({ sort_order: b }).eq('id', item.id),
      db.from('storage_items').update({ sort_order: a }).eq('id', swapWith.id),
    ])
  }

  function handleDragStart(item) {
    dragOrigValues.current = tabItems.map(i => i.sort_order)
    setDragItemId(item.id)
  }

  function handleDragEnter(overItem) {
    if (!dragItemId || dragItemId === overItem.id) return
    setItems(prev => {
      const list = [...prev]
      const fromIdx = list.findIndex(i => i.id === dragItemId)
      const toIdx = list.findIndex(i => i.id === overItem.id)
      if (fromIdx === -1 || toIdx === -1) return prev
      const [moved] = list.splice(fromIdx, 1)
      list.splice(toIdx, 0, moved)
      return list
    })
  }

  function handleDragOverScroll(e) {
    e.preventDefault()
    const edge = 120
    const y = e.clientY
    const vh = window.innerHeight
    if (y < edge) window.scrollBy(0, -Math.round((edge - y) / 4))
    else if (y > vh - edge) window.scrollBy(0, Math.round((y - (vh - edge)) / 4))
  }

  async function handleDragEnd() {
    if (!dragItemId) return
    setDragItemId(null)
    const values = dragOrigValues.current
    const updates = tabItems.map((item, idx) => ({ id: item.id, sort_order: values[idx] })).filter((u, idx) => u.sort_order !== tabItems[idx].sort_order)
    if (updates.length === 0) return
    setItems(prev => prev.map(i => {
      const u = updates.find(u => u.id === i.id)
      return u ? { ...i, sort_order: u.sort_order } : i
    }))
    await Promise.all(updates.map(u => db.from('storage_items').update({ sort_order: u.sort_order }).eq('id', u.id)))
  }

  return (
    <div className="text-white">
      <Navbar />
      <div className="max-w-5xl mx-auto px-6 py-10">
        <div className="bg-black/50 backdrop-blur-sm rounded-2xl p-6">
          <Breadcrumbs items={[{ label: 'Home', to: '/' }, { label: 'Item storage' }]} />
          <h1 className="text-2xl font-bold text-gray-100 mb-6">Item storage</h1>

          {!isAdmin ? (
            <p className="text-gray-400 text-sm">This page is only available to admins.</p>
          ) : loading ? <Spinner /> : (
            <>
              <div className="flex gap-2 mb-4">
                {MAP_CHAPTERS.map(c => (
                  <button
                    key={c.id}
                    onClick={() => { setChapter(c.id); setTabId(null); setClassFilter(null) }}
                    className={`px-4 py-2 rounded-xl text-sm font-bold border transition-colors ${
                      chapter === c.id
                        ? 'bg-yellow-400 border-yellow-400 text-gray-950'
                        : 'bg-gray-800 border-gray-600 text-gray-200 hover:bg-gray-700'
                    }`}
                  >
                    {c.name}
                  </button>
                ))}
              </div>

              <div className="flex flex-wrap gap-1.5 mb-5">
                {chapterTabs.map(tab => {
                  const count = items.filter(i => i.tab_id === tab.id).length
                  const active = tab.id === activeTab?.id
                  return (
                    <button
                      key={tab.id}
                      onClick={() => { setTabId(tab.id); setClassFilter(null) }}
                      className={`px-3 py-1.5 rounded-lg text-sm transition-colors border ${
                        active
                          ? 'bg-yellow-400/15 border-yellow-400 text-yellow-300'
                          : 'bg-gray-800/60 border-gray-700 hover:bg-gray-800 text-gray-200'
                      }`}
                    >
                      {tab.name}
                      {count > 0 && <span className="ml-1.5 text-[10px] font-mono text-gray-400">{count}</span>}
                    </button>
                  )
                })}
              </div>

              {activeTab && (
                <div className="flex items-center justify-between gap-2 mb-4">
                  <div className="flex flex-wrap gap-1.5">
                    <button
                      onClick={() => setClassFilter(null)}
                      className={`px-2.5 py-1 rounded-lg text-xs font-semibold border transition-colors ${
                        !classFilter
                          ? 'bg-white/10 border-white/40 text-white'
                          : 'bg-gray-800/40 border-gray-700 text-gray-400 hover:text-white'
                      }`}
                    >
                      All
                    </button>
                    {CLASSES.map(cls => (
                      <button
                        key={cls}
                        onClick={() => setClassFilter(cls)}
                        className={`px-2.5 py-1 rounded-lg text-xs font-semibold border transition-colors ${
                          classFilter === cls
                            ? 'bg-white/10 border-white/40 text-white'
                            : 'bg-gray-800/40 border-gray-700 text-gray-400 hover:text-white'
                        }`}
                      >
                        {cls}
                      </button>
                    ))}
                  </div>
                  <button
                    onClick={() => setReordering(r => !r)}
                    className={`px-2.5 py-1 rounded-lg text-xs font-semibold border transition-colors shrink-0 ${
                      reordering
                        ? 'bg-yellow-400 border-yellow-400 text-gray-950'
                        : 'bg-gray-800/40 border-gray-700 text-gray-400 hover:text-white'
                    }`}
                  >
                    {reordering ? 'Done reordering' : 'Reorder'}
                  </button>
                </div>
              )}

              {activeTab && (
                <div className="flex flex-col gap-3" onDragOver={reordering ? handleDragOverScroll : undefined}>
                  {tabItems.length === 0 && <p className="text-sm text-gray-500">No items{classFilter ? ` for ${classFilter}` : ''} in {activeTab.name} yet.</p>}
                  {tabItems.map((item, idx) => {
                    const ibs = itemBonuses.filter(ib => ib.item_id === item.id)
                    return (
                      <div
                        key={item.id}
                        draggable={reordering}
                        onDragStart={reordering ? () => handleDragStart(item) : undefined}
                        onDragEnter={reordering ? () => handleDragEnter(item) : undefined}
                        onDragOver={reordering ? handleDragOverScroll : undefined}
                        onDragEnd={reordering ? handleDragEnd : undefined}
                        className={`border rounded-xl p-4 transition-colors ${
                          dragItemId === item.id ? 'border-yellow-400 bg-gray-900/90 opacity-60' : 'border-gray-700 bg-gray-900/60'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-3 min-w-0">
                            {reordering && (
                              <div className="flex items-center gap-1 shrink-0">
                                <span className="cursor-grab active:cursor-grabbing text-gray-500 hover:text-yellow-400 text-base leading-none select-none" title="Drag to reorder">
                                  ⠿
                                </span>
                                <div className="flex flex-col">
                                  <button
                                    onClick={() => moveItem(item, -1)}
                                    disabled={idx === 0}
                                    className="text-xs leading-none px-1 text-gray-400 hover:text-yellow-400 disabled:opacity-20 disabled:hover:text-gray-400"
                                  >
                                    ▲
                                  </button>
                                  <button
                                    onClick={() => moveItem(item, 1)}
                                    disabled={idx === tabItems.length - 1}
                                    className="text-xs leading-none px-1 text-gray-400 hover:text-yellow-400 disabled:opacity-20 disabled:hover:text-gray-400"
                                  >
                                    ▼
                                  </button>
                                </div>
                              </div>
                            )}
                            {item.image_url && <img src={item.image_url} alt="" className="w-10 h-10 shrink-0 object-contain" />}
                            <h3 className="font-bold text-gray-100 truncate">{item.name}</h3>
                            {(item.classes ?? []).length > 0 && (
                              <span className="text-[10px] font-mono text-gray-500 shrink-0">{item.classes.join(' ')}</span>
                            )}
                          </div>
                          <button
                            onClick={() => setModal({ item })}
                            title="Edit item"
                            className="text-sm opacity-60 hover:opacity-100"
                          >
                            ✏️
                          </button>
                        </div>
                        {ibs.length === 0 ? (
                          <p className="text-xs text-gray-500 mt-2">No bonuses.</p>
                        ) : (
                          <div className="overflow-x-auto mt-3">
                            <table className="w-full text-sm border-collapse">
                              <thead>
                                <tr className="text-[11px] font-mono text-gray-500">
                                  <th className="text-left font-normal pr-3 pb-1">Bonus</th>
                                  {UPGRADE_LEVELS.map(l => <th key={l} className="font-normal px-2 pb-1 text-center">+{l}</th>)}
                                </tr>
                              </thead>
                              <tbody>
                                {ibs.map(ib => (
                                  <tr key={ib.id} className="border-t border-gray-800">
                                    <td className={`pr-3 py-1 font-semibold whitespace-nowrap ${ib.flagged ? 'text-red-400' : 'text-yellow-400'}`}>
                                      {bonusName(ib.bonus_id)}{ib.flagged && ' ⚠'}
                                    </td>
                                    {UPGRADE_LEVELS.map(l => (
                                      <td key={l} className={`px-2 py-1 text-center whitespace-nowrap ${ib.flagged ? 'text-red-400' : 'text-gray-200'}`}>
                                        {ib.level_values?.[l] || <span className="text-gray-600">–</span>}
                                      </td>
                                    ))}
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        )}
                      </div>
                    )
                  })}
                  <button
                    onClick={() => setModal({ item: null })}
                    className="self-start px-3 py-2 rounded-lg text-sm border border-dashed border-gray-600 text-gray-400 hover:text-white hover:border-gray-400 transition-colors"
                  >
                    + Add item
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {modal && activeTab && (
        <ItemStorageModal
          tabId={activeTab.id}
          item={modal.item}
          itemBonuses={modal.item ? itemBonuses.filter(ib => ib.item_id === modal.item.id) : []}
          bonuses={bonuses}
          existingImages={usedImages.filter(url => url !== modal.item?.image_url)}
          nextSortOrder={Math.max(0, ...tabItems.map(i => i.sort_order)) + 10}
          onClose={() => setModal(null)}
          onSaved={load}
          onBonusCreated={b => setBonuses(prev => [...prev, b])}
        />
      )}
    </div>
  )
}
