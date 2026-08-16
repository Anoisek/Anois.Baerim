import { useEffect, useState } from 'react'
import { db } from '../dbClient'
import Modal from './Modal'
import ImageUpload from './ImageUpload'

export default function AddMetinModal({ nextSortOrder, onClose, onAdded }) {
  const [name, setName] = useState('')
  const [imageUrls, setImageUrls] = useState([])
  const [allMaterials, setAllMaterials] = useState([])
  const [drops, setDrops] = useState({}) // { materialId: { altGroup, guaranteed } }
  const [search, setSearch] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    db.from('materials').select('*').order('name').then(({ data }) => {
      setAllMaterials(data ?? [])
    })
  }, [])

  function toggleDrop(materialId) {
    setDrops(prev => {
      if (prev[materialId] !== undefined) {
        const next = { ...prev }
        delete next[materialId]
        return next
      }
      return { ...prev, [materialId]: { altGroup: '', guaranteed: false } }
    })
  }

  function setAltGroup(materialId, value) {
    setDrops(prev => ({ ...prev, [materialId]: { ...prev[materialId], altGroup: value } }))
  }

  function toggleGuaranteed(materialId) {
    setDrops(prev => ({ ...prev, [materialId]: { ...prev[materialId], guaranteed: !prev[materialId].guaranteed } }))
  }

  async function handleSubmit(e) {
    e.preventDefault()
    if (!name.trim()) return
    setSaving(true)

    const { data, error } = await db
      .from('metins')
      .insert({
        name: name.trim(),
        image_urls: imageUrls,
        image_url: imageUrls[0] ?? null,
        sort_order: nextSortOrder ?? 0,
      })
      .select()
      .single()

    if (error) {
      alert('Error: ' + error.message)
      setSaving(false)
      return
    }

    const rows = Object.entries(drops).map(([material_id, d], index) => ({
      metin_id: data.id, material_id, alt_group: d.altGroup.trim() || null, sort_order: index, is_guaranteed: d.guaranteed,
    }))

    if (rows.length > 0) {
      const { error: err } = await db.from('metin_drops').insert(rows)
      if (err) { alert('Error saving drops: ' + err.message); setSaving(false); return }
    }

    onAdded(data)
    onClose()
    setSaving(false)
  }

  const filtered = allMaterials.filter(m => m.name.toLowerCase().includes(search.toLowerCase()))

  return (
    <Modal title="New metin" onClose={onClose}>
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div className="flex flex-col gap-1">
          <label className="text-sm text-gray-400">Name</label>
          <input
            type="text"
            value={name}
            onChange={e => setName(e.target.value)}
            required
            className="bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-yellow-400"
          />
        </div>

        <div className="flex flex-col gap-2">
          <label className="text-sm text-gray-400">Images (optional — add several to cycle through them)</label>
          {imageUrls.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {imageUrls.map((url, i) => (
                <div key={url} className="relative">
                  <img src={url} alt="" className="w-16 h-16 object-contain rounded-lg border border-gray-600" />
                  <button
                    type="button"
                    onClick={() => setImageUrls(prev => prev.filter((_, idx) => idx !== i))}
                    className="absolute -top-2 -right-2 bg-red-600 hover:bg-red-500 text-white rounded-full w-5 h-5 text-xs leading-none flex items-center justify-center"
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          )}
          <ImageUpload onUploaded={url => setImageUrls(prev => [...prev, url])} />
        </div>

        <div className="flex flex-col gap-2">
          <label className="text-sm text-gray-400">Drops (which materials this metin can drop)</label>
          <p className="text-xs text-gray-500 -mt-1">
            Leave "Group" empty for a normal drop. Give two or more materials the same group label to mark
            them as alternatives — this metin drops only one of that group, not all of them (e.g. group "A"
            on both Golden Clasp and Golden Fabric). Check "1/kill" for a material that always drops exactly
            once per metin — its quantity will auto-fill the "Metins destroyed" count on the calculator page.
          </p>

          <input
            type="text"
            placeholder="Search material..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-yellow-400"
          />
          <div className="max-h-48 overflow-y-auto flex flex-col gap-1 bg-gray-800 rounded-lg p-2">
            {filtered.length === 0 && <p className="text-gray-500 text-sm p-2">No materials found.</p>}
            {filtered.map(mat => (
              <div key={mat.id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-gray-700">
                <input
                  type="checkbox"
                  checked={drops[mat.id] !== undefined}
                  onChange={() => toggleDrop(mat.id)}
                  className="accent-yellow-400"
                />
                {mat.image_url
                  ? <img src={mat.image_url} alt={mat.name} className="w-7 h-7 object-contain" />
                  : <span className="w-7 text-center text-lg">🧪</span>}
                <span className="text-sm text-white flex-1">{mat.name}</span>
                {drops[mat.id] !== undefined && (
                  <>
                    <label className="flex items-center gap-1 text-[11px] text-gray-400 shrink-0" onClick={e => e.stopPropagation()}>
                      <input
                        type="checkbox"
                        checked={drops[mat.id].guaranteed}
                        onChange={() => toggleGuaranteed(mat.id)}
                        className="accent-yellow-400 w-3.5 h-3.5"
                      />
                      1/kill
                    </label>
                    <input
                      type="text"
                      placeholder="Group"
                      list="metin-alt-groups"
                      value={drops[mat.id].altGroup}
                      onChange={e => setAltGroup(mat.id, e.target.value)}
                      onClick={e => e.stopPropagation()}
                      className="bg-gray-700 border border-gray-500 rounded px-2 py-1 w-20 text-sm focus:outline-none focus:border-yellow-400"
                    />
                  </>
                )}
              </div>
            ))}
          </div>
          <datalist id="metin-alt-groups">
            {[...new Set(Object.values(drops).map(d => d.altGroup).filter(Boolean))].map(g => <option key={g} value={g} />)}
          </datalist>
        </div>

        <button
          type="submit"
          disabled={saving}
          className="bg-yellow-400 hover:bg-yellow-300 disabled:opacity-50 text-gray-950 font-bold rounded-lg py-2 transition-colors"
        >
          {saving ? 'Saving...' : 'Add metin'}
        </button>
      </form>
    </Modal>
  )
}
