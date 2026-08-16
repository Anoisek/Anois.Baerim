import { useEffect, useState } from 'react'
import { db } from '../dbClient'
import { itemImages as metinImages } from '../utils/itemImages'
import Modal from './Modal'
import ImageUpload from './ImageUpload'
import { deleteImages } from '../utils/imageStorage'

export default function EditMetinModal({ metin, onClose, onUpdated, onDeleted }) {
  const [name, setName] = useState(metin.name)
  const [imageUrls, setImageUrls] = useState(metinImages(metin))
  const [allMaterials, setAllMaterials] = useState([])
  const [drops, setDrops] = useState({}) // { materialId: { altGroup, sortOrder } }
  const [search, setSearch] = useState('')
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)

  useEffect(() => {
    Promise.all([
      db.from('materials').select('*').order('name'),
      db.from('metin_drops').select('material_id, alt_group, sort_order').eq('metin_id', metin.id),
    ]).then(([matsRes, dropsRes]) => {
      setAllMaterials(matsRes.data ?? [])
      const d = {}
      for (const row of dropsRes.data ?? []) d[row.material_id] = { altGroup: row.alt_group ?? '', sortOrder: row.sort_order ?? 0 }
      setDrops(d)
    })
  }, [metin.id])

  // New drops keep any order already saved for them (see the reorder controls on
  // the metin's own detail page) — only a freshly checked material gets appended
  // at the end, so editing name/drops here never scrambles a curated order.
  function toggleDrop(materialId) {
    setDrops(prev => {
      if (prev[materialId] !== undefined) {
        const next = { ...prev }
        delete next[materialId]
        return next
      }
      const nextSortOrder = Object.values(prev).reduce((max, d) => Math.max(max, d.sortOrder), -1) + 1
      return { ...prev, [materialId]: { altGroup: '', sortOrder: nextSortOrder } }
    })
  }

  function setAltGroup(materialId, value) {
    setDrops(prev => ({ ...prev, [materialId]: { ...prev[materialId], altGroup: value } }))
  }

  async function removeImageAt(i) {
    await deleteImages(imageUrls[i])
    setImageUrls(prev => prev.filter((_, idx) => idx !== i))
  }

  async function handleSave(e) {
    e.preventDefault()
    if (!name.trim()) return
    setSaving(true)

    const { data, error } = await db
      .from('metins')
      .update({
        name: name.trim(),
        image_urls: imageUrls,
        image_url: imageUrls[0] ?? null,
      })
      .eq('id', metin.id)
      .select()
      .single()

    if (error) {
      alert('Error: ' + error.message)
      setSaving(false)
      return
    }

    await db.from('metin_drops').delete().eq('metin_id', metin.id)
    const rows = Object.entries(drops).map(([material_id, d]) => ({
      metin_id: metin.id, material_id, alt_group: d.altGroup.trim() || null, sort_order: d.sortOrder,
    }))
    if (rows.length > 0) await db.from('metin_drops').insert(rows)

    onUpdated(data)
    onClose()
    setSaving(false)
  }

  async function handleDelete() {
    setDeleting(true)

    await db.from('metin_drops').delete().eq('metin_id', metin.id)
    await deleteImages(imageUrls)

    const { error } = await db.from('metins').delete().eq('id', metin.id)
    if (error) {
      alert('Error: ' + error.message)
      setDeleting(false)
      return
    }

    onDeleted(metin.id)
    onClose()
  }

  const filtered = allMaterials.filter(m => m.name.toLowerCase().includes(search.toLowerCase()))

  return (
    <Modal title="Edit metin" onClose={onClose}>
      <form onSubmit={handleSave} className="flex flex-col gap-4">
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
          <label className="text-sm text-gray-400">Images (add several to cycle through them)</label>
          {imageUrls.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {imageUrls.map((url, i) => (
                <div key={url} className="relative">
                  <img src={url} alt="" className="w-16 h-16 object-contain rounded-lg border border-gray-600" />
                  <button
                    type="button"
                    onClick={() => removeImageAt(i)}
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
            on both Golden Clasp and Golden Fabric).
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
                  <input
                    type="text"
                    placeholder="Group"
                    list="metin-alt-groups"
                    value={drops[mat.id].altGroup}
                    onChange={e => setAltGroup(mat.id, e.target.value)}
                    onClick={e => e.stopPropagation()}
                    className="bg-gray-700 border border-gray-500 rounded px-2 py-1 w-20 text-sm focus:outline-none focus:border-yellow-400"
                  />
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
          {saving ? 'Saving...' : 'Save changes'}
        </button>

        <div className="border-t border-gray-700 pt-4">
          {!confirmDelete ? (
            <button
              type="button"
              onClick={() => setConfirmDelete(true)}
              className="w-full text-sm text-red-400 hover:text-red-300 py-2 transition-colors"
            >
              Delete metin
            </button>
          ) : (
            <div className="flex flex-col gap-2">
              <p className="text-sm text-red-400 text-center">Are you sure? This cannot be undone.</p>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setConfirmDelete(false)}
                  className="flex-1 bg-gray-700 hover:bg-gray-600 text-white text-sm font-semibold rounded-lg py-2 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleDelete}
                  disabled={deleting}
                  className="flex-1 bg-red-600 hover:bg-red-500 disabled:opacity-50 text-white text-sm font-bold rounded-lg py-2 transition-colors"
                >
                  {deleting ? 'Deleting...' : 'Yes, delete'}
                </button>
              </div>
            </div>
          )}
        </div>
      </form>
    </Modal>
  )
}
