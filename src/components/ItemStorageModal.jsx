import { useState } from 'react'
import { db } from '../dbClient'
import Modal from './Modal'

export const UPGRADE_LEVELS = Array.from({ length: 10 }, (_, i) => i) // +0 .. +9

const inputCls = 'bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-yellow-400'

// Add / edit one storage item: a name plus any number of bonuses, each with its
// own free-text value for every upgrade level (+0..+9), e.g. "10", "+10", "-10", "20%".
export default function ItemStorageModal({ tabId, item, itemBonuses, bonuses, nextSortOrder, onClose, onSaved, onBonusCreated }) {
  const [name, setName] = useState(item?.name ?? '')
  const [entries, setEntries] = useState(() =>
    (itemBonuses ?? []).map(ib => ({
      key: ib.id,
      bonusId: ib.bonus_id,
      values: UPGRADE_LEVELS.map(l => ib.level_values?.[l] ?? ''),
    })),
  )
  const [pickerOpen, setPickerOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [saving, setSaving] = useState(false)
  const [creating, setCreating] = useState(false)

  const bonusName = id => bonuses.find(b => b.id === id)?.name ?? '?'
  const usedIds = new Set(entries.map(e => e.bonusId))
  const q = search.trim()
  const available = bonuses
    .filter(b => !usedIds.has(b.id) && (!q || b.name.toLowerCase().includes(q.toLowerCase())))
    .sort((a, b) => a.name.localeCompare(b.name))
  const exact = q && bonuses.find(b => b.name.toLowerCase() === q.toLowerCase())

  function addEntry(bonusId) {
    setEntries(prev => [...prev, { key: crypto.randomUUID(), bonusId, values: UPGRADE_LEVELS.map(() => '') }])
    setSearch('')
    setPickerOpen(false)
  }

  async function createAndAdd() {
    if (!q || creating) return
    if (exact) {
      if (!usedIds.has(exact.id)) addEntry(exact.id)
      return
    }
    setCreating(true)
    const { data, error } = await db.from('storage_bonuses').insert({ name: q }).select().single()
    setCreating(false)
    if (error) { alert('Error: ' + error.message); return }
    onBonusCreated(data)
    addEntry(data.id)
  }

  function setValue(key, level, value) {
    setEntries(prev => prev.map(e => e.key === key ? { ...e, values: e.values.map((v, i) => i === level ? value : v) } : e))
  }

  function fillFromFirst(key) {
    setEntries(prev => prev.map(e => e.key === key ? { ...e, values: e.values.map(() => e.values[0]) } : e))
  }

  function removeEntry(key) {
    setEntries(prev => prev.filter(e => e.key !== key))
  }

  async function handleSave(e) {
    e.preventDefault()
    if (!name.trim()) return
    setSaving(true)
    try {
      let itemId = item?.id
      if (itemId) {
        const { error } = await db.from('storage_items').update({ name: name.trim() }).eq('id', itemId)
        if (error) throw error
      } else {
        const { data, error } = await db.from('storage_items')
          .insert({ tab_id: tabId, name: name.trim(), sort_order: nextSortOrder ?? 0 })
          .select().single()
        if (error) throw error
        itemId = data.id
      }
      // Insert the new bonus rows first and drop the old ones only afterwards,
      // so a failed write never leaves the item without its bonuses.
      const oldIds = (itemBonuses ?? []).map(ib => ib.id)
      if (entries.length > 0) {
        const { error } = await db.from('storage_item_bonuses').insert(
          entries.map((en, i) => ({ item_id: itemId, bonus_id: en.bonusId, level_values: en.values, sort_order: i })),
        )
        if (error) throw error
      }
      for (const id of oldIds) {
        const { error } = await db.from('storage_item_bonuses').delete().eq('id', id)
        if (error) throw error
      }
      onSaved()
      onClose()
    } catch (err) {
      alert('Error: ' + (err.message ?? err))
    }
    setSaving(false)
  }

  async function handleDelete() {
    if (!item || !confirm(`Delete "${item.name}"?`)) return
    setSaving(true)
    try {
      for (const ib of itemBonuses ?? []) {
        const { error } = await db.from('storage_item_bonuses').delete().eq('id', ib.id)
        if (error) throw error
      }
      const { error } = await db.from('storage_items').delete().eq('id', item.id)
      if (error) throw error
      onSaved()
      onClose()
    } catch (err) {
      alert('Error: ' + (err.message ?? err))
    }
    setSaving(false)
  }

  return (
    <Modal title={item ? 'Edit item' : 'Add item'} onClose={onClose} maxWidthClass="max-w-3xl">
      <form onSubmit={handleSave} className="flex flex-col gap-4">
        <div className="flex flex-col gap-1">
          <label className="text-sm text-gray-400">Name</label>
          <input type="text" value={name} onChange={e => setName(e.target.value)} required autoFocus className={inputCls} />
        </div>

        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-2 items-start">
            <button
              type="button"
              onClick={() => setPickerOpen(o => !o)}
              className={`px-3 py-2 rounded-lg text-sm font-semibold border transition-colors ${
                pickerOpen ? 'bg-yellow-400 border-yellow-400 text-gray-950' : 'bg-gray-800 border-gray-600 text-gray-200 hover:border-yellow-400/50'
              }`}
            >
              {pickerOpen ? 'Close' : '+ Add bonus'}
            </button>

            {pickerOpen && (
              <div className="w-full border border-gray-600 bg-gray-800/60 rounded-xl p-3 flex flex-col gap-2">
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); createAndAdd() } }}
                    placeholder="Search or type a new bonus name..."
                    autoFocus
                    className={`${inputCls} flex-1 min-w-0`}
                  />
                  {q && !exact && (
                    <button
                      type="button"
                      onClick={createAndAdd}
                      disabled={creating}
                      className="px-3 py-2 rounded-lg text-sm font-semibold bg-yellow-400 hover:bg-yellow-300 disabled:opacity-50 text-gray-950 whitespace-nowrap"
                    >
                      + Create new
                    </button>
                  )}
                </div>
                <div className="max-h-48 overflow-y-auto flex flex-wrap gap-1.5">
                  {available.length === 0 && (
                    <p className="text-xs text-gray-500 py-1">
                      {bonuses.length === 0 ? 'No bonuses yet - type a name and create the first one.' : 'No matching bonus.'}
                    </p>
                  )}
                  {available.map(b => (
                    <button
                      key={b.id}
                      type="button"
                      onClick={() => addEntry(b.id)}
                      className="px-2.5 py-1 rounded-lg text-xs bg-gray-900 border border-gray-600 text-gray-200 hover:border-yellow-400 hover:text-yellow-400 transition-colors"
                    >
                      {b.name}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {entries.map(en => (
            <div key={en.key} className="border border-gray-700 bg-gray-800/40 rounded-xl p-3 flex flex-col gap-2">
              <div className="flex items-center justify-between gap-2">
                <span className="font-semibold text-yellow-400 text-sm">{bonusName(en.bonusId)}</span>
                <div className="flex items-center gap-3">
                  <button type="button" onClick={() => fillFromFirst(en.key)} className="text-xs text-gray-400 hover:text-yellow-400">
                    Copy +0 to all
                  </button>
                  <button type="button" onClick={() => removeEntry(en.key)} title="Remove bonus" className="text-gray-400 hover:text-red-400 text-lg leading-none">
                    ×
                  </button>
                </div>
              </div>
              <div className="grid grid-cols-5 sm:grid-cols-10 gap-1.5">
                {UPGRADE_LEVELS.map(level => (
                  <label key={level} className="flex flex-col gap-0.5 min-w-0">
                    <span className="text-[10px] font-mono text-gray-500 text-center">+{level}</span>
                    <input
                      type="text"
                      value={en.values[level]}
                      onChange={e => setValue(en.key, level, e.target.value)}
                      className="w-full min-w-0 bg-gray-900 border border-gray-600 rounded-md px-1.5 py-1 text-sm text-white text-center focus:outline-none focus:border-yellow-400"
                    />
                  </label>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div className="flex gap-2">
          {item && (
            <button
              type="button"
              onClick={handleDelete}
              disabled={saving}
              className="px-4 py-2 rounded-lg text-sm font-semibold border border-red-500/50 text-red-400 hover:bg-red-500/10 disabled:opacity-50"
            >
              Delete
            </button>
          )}
          <button
            type="submit"
            disabled={saving || !name.trim()}
            className="flex-1 bg-yellow-400 hover:bg-yellow-300 disabled:opacity-50 text-gray-950 font-bold rounded-lg py-2 transition-colors"
          >
            {saving ? 'Saving...' : item ? 'Save changes' : 'Add item'}
          </button>
        </div>
      </form>
    </Modal>
  )
}
