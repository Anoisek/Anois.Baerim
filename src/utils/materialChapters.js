import { useCallback, useEffect, useMemo, useState } from 'react'
import { db } from '../dbClient'

// Chapter tabs on /materials. A material can sit in any number of chapters
// (material_chapter_members). A chapter with visible = false is hidden from
// non-admins together with every material that belongs to it.
export function useMaterialChapters(isAdmin) {
  const [chapters, setChapters] = useState([])
  const [members, setMembers] = useState({}) // { chapterId: Set<materialId> }
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    Promise.all([
      db.from('material_chapters').select('*').order('sort_order'),
      db.from('material_chapter_members').select('chapter_id, material_id'),
    ]).then(([chRes, memRes]) => {
      setChapters(chRes.data ?? [])
      const map = {}
      for (const row of memRes.data ?? []) {
        (map[row.chapter_id] ??= new Set()).add(row.material_id)
      }
      setMembers(map)
      setLoaded(true)
    })
  }, [])

  const visibleChapters = useMemo(
    () => (isAdmin ? chapters : chapters.filter(c => c.visible)),
    [chapters, isAdmin],
  )

  // Materials that non-admins must not see: anything in a hidden chapter.
  const hiddenMaterialIds = useMemo(() => {
    const hidden = new Set()
    if (isAdmin) return hidden
    for (const c of chapters) {
      if (c.visible) continue
      for (const id of members[c.id] ?? []) hidden.add(id)
    }
    return hidden
  }, [chapters, members, isAdmin])

  const setMember = useCallback((chapterId, materialId, isMember) => {
    setMembers(prev => {
      const next = new Set(prev[chapterId] ?? [])
      if (isMember) next.add(materialId)
      else next.delete(materialId)
      return { ...prev, [chapterId]: next }
    })
  }, [])

  // Click-to-toggle from the "add existing materials" panel: optimistic, and
  // rolled back if the write fails.
  const toggleMember = useCallback(async (chapterId, materialId) => {
    const wasMember = members[chapterId]?.has(materialId) ?? false
    setMember(chapterId, materialId, !wasMember)
    const { error } = wasMember
      ? await db.from('material_chapter_members').delete().eq('chapter_id', chapterId).eq('material_id', materialId)
      : await db.from('material_chapter_members').upsert({ chapter_id: chapterId, material_id: materialId })
    if (error) {
      setMember(chapterId, materialId, wasMember)
      alert('Error: ' + error.message)
    }
  }, [members, setMember])

  // The Add/Edit material modals persist the rows themselves, then report the
  // final chapter set here so the page state matches.
  const setMaterialChapters = useCallback((materialId, chapterIds) => {
    const wanted = new Set(chapterIds)
    setMembers(prev => {
      const next = {}
      for (const c of chapters) {
        const set = new Set(prev[c.id] ?? [])
        if (wanted.has(c.id)) set.add(materialId)
        else set.delete(materialId)
        next[c.id] = set
      }
      return next
    })
  }, [chapters])

  const updateChapter = useCallback(async (id, patch) => {
    const { data, error } = await db.from('material_chapters').update(patch).eq('id', id).select().single()
    if (error) return { error }
    setChapters(prev => prev.map(c => c.id === id ? data : c))
    return { data }
  }, [])

  return { chapters, visibleChapters, members, hiddenMaterialIds, loaded, toggleMember, setMaterialChapters, updateChapter }
}

// Replace a material's chapter memberships (used by the Add/Edit material modals).
export async function saveMaterialChapters(materialId, chapterIds) {
  const del = await db.from('material_chapter_members').delete().eq('material_id', materialId)
  if (del.error) return { error: del.error }
  if (chapterIds.length > 0) {
    const ins = await db.from('material_chapter_members').insert(
      chapterIds.map(chapter_id => ({ chapter_id, material_id: materialId })),
    )
    if (ins.error) return { error: ins.error }
  }
  return { error: null }
}
