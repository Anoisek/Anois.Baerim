import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { db } from '../dbClient'

// One Q&A card on the community guide (/aiguide). Regular visitors get an
// edit icon that opens a "suggest a change" form (saved to guide_suggestions,
// admin-reviewed). Admins get the same icon wired to a direct edit that
// upserts guide_items immediately, plus an always-visible list of pending
// suggestions for this item with one-click accept/reject.
export default function GuideItem({ categoryId, index, question, answer, disputed, isAdmin, lang, suggestions, cardRef, onChanged }) {
  const { t } = useTranslation()
  const [mode, setMode] = useState('view') // view | edit | suggest
  const [formQuestion, setFormQuestion] = useState(question)
  const [formAnswer, setFormAnswer] = useState(answer)
  const [status, setStatus] = useState('idle') // idle | saving | error
  const [notice, setNotice] = useState(null)

  function openForm() {
    setFormQuestion(question)
    setFormAnswer(answer)
    setStatus('idle')
    setNotice(null)
    setMode(isAdmin ? 'edit' : 'suggest')
  }

  function cancel() {
    setMode('view')
    setStatus('idle')
  }

  async function saveEdit() {
    if (!formQuestion.trim() || !formAnswer.trim()) return
    setStatus('saving')
    const { error } = await db.from('guide_items').upsert({
      category_id: categoryId,
      item_index: index,
      lang,
      question: formQuestion.trim(),
      answer: formAnswer.trim(),
      updated_at: new Date().toISOString(),
    })
    if (error) { setStatus('error'); return }
    setMode('view')
    setStatus('idle')
    setNotice(t('communityGuide.changesSaved'))
    onChanged()
  }

  async function submitSuggestion() {
    if (!formQuestion.trim() || !formAnswer.trim()) return
    setStatus('saving')
    const { error } = await db.from('guide_suggestions').insert({
      category_id: categoryId,
      item_index: index,
      lang,
      question: formQuestion.trim(),
      answer: formAnswer.trim(),
    })
    if (error) { setStatus('error'); return }
    setMode('view')
    setStatus('idle')
    setNotice(t('communityGuide.suggestionSuccess'))
  }

  async function acceptSuggestion(s) {
    setStatus('saving')
    const { error } = await db.from('guide_items').upsert({
      category_id: categoryId,
      item_index: index,
      lang,
      question: s.question,
      answer: s.answer,
      updated_at: new Date().toISOString(),
    })
    if (!error) {
      await db.from('guide_suggestions').delete().eq('id', s.id)
      setNotice(t('communityGuide.changesSaved'))
      onChanged()
    }
    setStatus('idle')
  }

  async function rejectSuggestion(s) {
    await db.from('guide_suggestions').delete().eq('id', s.id)
    onChanged()
  }

  return (
    <div
      ref={cardRef}
      className={`relative bg-gray-900/60 border rounded-xl px-4 py-3.5 transition-opacity duration-150 ${disputed ? 'border-orange-700/60' : 'border-gray-800'}`}
    >
      <button
        onClick={openForm}
        title={isAdmin ? t('common.edit') : t('communityGuide.suggestTooltip')}
        className="absolute top-3 right-3 w-6 h-6 flex items-center justify-center rounded-full text-gray-500 hover:text-yellow-400 hover:bg-gray-800 transition-colors text-xs"
      >
        ✏️
      </button>

      {mode === 'view' ? (
        <>
          {disputed && (
            <span className="inline-block text-[10px] font-bold uppercase tracking-wide text-orange-400 bg-orange-950/60 border border-orange-800/60 rounded-full px-2 py-0.5 mb-2">
              {t('communityGuide.disputedTag')}
            </span>
          )}
          <p className="text-sm font-semibold text-gray-100 mb-1.5 pr-6">{question}</p>
          <p className="text-sm text-gray-400 leading-relaxed">{answer}</p>
          {notice && <p className="text-xs text-green-400 mt-2">{notice}</p>}
        </>
      ) : (
        <div className="flex flex-col gap-2 pr-6">
          <label className="text-xs text-gray-500">{t('communityGuide.questionLabel')}</label>
          <textarea
            value={formQuestion}
            onChange={e => setFormQuestion(e.target.value)}
            rows={2}
            maxLength={500}
            className="bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-yellow-400 resize-none"
          />
          <label className="text-xs text-gray-500">{t('communityGuide.answerLabel')}</label>
          <textarea
            value={formAnswer}
            onChange={e => setFormAnswer(e.target.value)}
            rows={4}
            maxLength={2000}
            className="bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-yellow-400 resize-none"
          />
          {status === 'error' && <p className="text-xs text-red-400">{t('suggestions.error')}</p>}
          <div className="flex gap-2 justify-end">
            <button onClick={cancel} className="text-xs text-gray-400 hover:text-white px-3 py-1.5 transition-colors">
              {t('common.cancel')}
            </button>
            <button
              onClick={mode === 'edit' ? saveEdit : submitSuggestion}
              disabled={status === 'saving' || !formQuestion.trim() || !formAnswer.trim()}
              className="bg-yellow-400 hover:bg-yellow-300 disabled:opacity-50 text-gray-950 font-bold rounded-lg px-3 py-1.5 text-xs transition-colors"
            >
              {status === 'saving' ? t('suggestions.sending') : mode === 'edit' ? t('common.save') : t('communityGuide.submitSuggestion')}
            </button>
          </div>
        </div>
      )}

      {isAdmin && suggestions.length > 0 && (
        <div className="mt-3 pt-3 border-t border-gray-800 flex flex-col gap-2">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">
            {t('communityGuide.pendingSuggestions')} ({suggestions.length})
          </p>
          {suggestions.map(s => (
            <div key={s.id} className="bg-gray-950/60 border border-gray-800 rounded-lg px-3 py-2">
              <p className="text-xs font-semibold text-gray-200 mb-1">{s.question}</p>
              <p className="text-xs text-gray-400 mb-2">{s.answer}</p>
              <div className="flex gap-2 justify-end">
                <button onClick={() => rejectSuggestion(s)} className="text-[11px] text-gray-500 hover:text-red-400 transition-colors">
                  {t('communityGuide.rejectSuggestion')}
                </button>
                <button
                  onClick={() => acceptSuggestion(s)}
                  disabled={status === 'saving'}
                  className="text-[11px] font-semibold text-gray-950 bg-green-400 hover:bg-green-300 disabled:opacity-50 rounded-full px-2.5 py-1 transition-colors"
                >
                  {t('communityGuide.acceptSuggestion')}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
