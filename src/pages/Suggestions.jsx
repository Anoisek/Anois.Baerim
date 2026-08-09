import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import Navbar from '../components/Navbar'
import Breadcrumbs from '../components/Breadcrumbs'

const FORMSPREE_ENDPOINT = 'https://formspree.io/f/xzepeeev'

export default function Suggestions() {
  const { t } = useTranslation()
  const [nickname, setNickname] = useState('')
  const [suggestion, setSuggestion] = useState('')
  const [status, setStatus] = useState('idle') // idle | sending | sent | error

  async function handleSubmit(e) {
    e.preventDefault()
    if (!suggestion.trim()) return
    setStatus('sending')
    try {
      const res = await fetch(FORMSPREE_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ nickname: nickname.trim() || '(brak)', suggestion: suggestion.trim() }),
      })
      if (!res.ok) throw new Error('request failed')
      setStatus('sent')
      setNickname('')
      setSuggestion('')
    } catch {
      setStatus('error')
    }
  }

  return (
    <div className="min-h-screen text-white">
      <Navbar />
      <div className="max-w-2xl mx-auto px-6 py-10">
        <div className="bg-black/50 backdrop-blur-sm rounded-2xl p-6">
          <Breadcrumbs items={[
            { label: t('common.home'), to: '/' },
            { label: t('footer.suggestions') },
          ]} />

          <h1 className="text-2xl font-bold text-gray-100 mb-2">{t('footer.suggestions')}</h1>
          <p className="text-sm text-gray-400 mb-6">{t('suggestions.intro')}</p>

          {status === 'sent' ? (
            <p className="text-sm text-green-400 bg-green-950/40 border border-green-800/50 rounded-lg px-4 py-3">
              {t('suggestions.success')}
            </p>
          ) : (
            <form onSubmit={handleSubmit} className="flex flex-col gap-3">
              <div className="flex flex-col gap-1">
                <label className="text-sm text-gray-400">{t('suggestions.nicknameLabel')}</label>
                <input
                  type="text"
                  value={nickname}
                  onChange={e => setNickname(e.target.value)}
                  placeholder={t('suggestions.nicknamePlaceholder')}
                  maxLength={50}
                  className="bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-yellow-400"
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-sm text-gray-400">{t('suggestions.suggestionLabel')}</label>
                <textarea
                  value={suggestion}
                  onChange={e => setSuggestion(e.target.value)}
                  placeholder={t('suggestions.suggestionPlaceholder')}
                  rows={6}
                  maxLength={2000}
                  required
                  className="bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-yellow-400 resize-none"
                />
              </div>
              {status === 'error' && (
                <p className="text-sm text-red-400">{t('suggestions.error')}</p>
              )}
              <button
                type="submit"
                disabled={status === 'sending' || !suggestion.trim()}
                className="bg-yellow-400 hover:bg-yellow-300 disabled:opacity-50 text-gray-950 font-bold rounded-lg py-2 text-sm transition-colors"
              >
                {status === 'sending' ? t('suggestions.sending') : t('suggestions.submit')}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}
