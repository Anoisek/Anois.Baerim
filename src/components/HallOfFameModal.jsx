import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { supabase } from '../supabaseClient'
import { useAuth } from '../context/AuthContext'
import Modal from './Modal'
import Spinner from './Spinner'

export default function HallOfFameModal({ onClose }) {
  const { isAdmin } = useAuth()
  const { t } = useTranslation()
  const [loading, setLoading] = useState(true)
  const [helpers, setHelpers] = useState([])
  const [name, setName] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    supabase.from('map_helpers').select('*').order('sort_order').then(({ data }) => {
      setHelpers(data ?? [])
      setLoading(false)
    })
  }, [])

  async function handleAdd(e) {
    e.preventDefault()
    if (!name.trim()) return
    setSaving(true)
    const nextOrder = Math.max(0, ...helpers.map(h => h.sort_order)) + 10
    const { data, error } = await supabase
      .from('map_helpers')
      .insert({ name: name.trim(), sort_order: nextOrder })
      .select()
      .single()
    if (error) {
      alert('Error: ' + error.message)
    } else {
      setHelpers(prev => [...prev, data])
      setName('')
    }
    setSaving(false)
  }

  async function handleRemove(id) {
    const { error } = await supabase.from('map_helpers').delete().eq('id', id)
    if (error) { alert('Error: ' + error.message); return }
    setHelpers(prev => prev.filter(h => h.id !== id))
  }

  return (
    <Modal title={t('hallOfFame.title')} onClose={onClose}>
      <div className="flex flex-col gap-4">
        {loading ? <Spinner /> : helpers.length === 0 ? (
          <p className="text-sm text-gray-500 text-center py-6">{t('hallOfFame.noHelpersYet')}</p>
        ) : (
          <div className="flex flex-col gap-2">
            {helpers.map(h => (
              <div key={h.id} className="flex items-center justify-between bg-gray-800/60 border border-gray-700 rounded-lg px-3 py-2">
                <span className="text-sm text-gray-200">⭐ {h.name}</span>
                {isAdmin && (
                  <button onClick={() => handleRemove(h.id)} className="text-gray-600 hover:text-red-400 text-sm" title={t('hallOfFame.removeTooltip')}>
                    🗑
                  </button>
                )}
              </div>
            ))}
          </div>
        )}

        {isAdmin && (
          <form onSubmit={handleAdd} className="flex gap-2 border-t border-gray-700 pt-4">
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder={t('hallOfFame.namePlaceholder')}
              className="flex-1 bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-yellow-400"
            />
            <button
              type="submit"
              disabled={saving || !name.trim()}
              className="bg-yellow-400 hover:bg-yellow-300 disabled:opacity-50 text-gray-950 font-bold rounded-lg px-4 text-sm transition-colors"
            >
              {saving ? '...' : t('common.add')}
            </button>
          </form>
        )}
      </div>
    </Modal>
  )
}
