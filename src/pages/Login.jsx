import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { login } from '../authClient'
import { useAuth } from '../context/AuthContext'

export default function Login() {
  const navigate = useNavigate()
  const { t } = useTranslation()
  const { refresh } = useAuth()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await login(username.trim(), password)
      await refresh()
      navigate('/')
    } catch {
      setError(t('login.invalidCredentials'))
    }
    setLoading(false)
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <span className="text-4xl">⚔️</span>
          <h1 className="text-2xl font-bold text-yellow-400 mt-3">Baerim Calculator</h1>
          <p className="text-gray-500 text-sm mt-1">{t('login.title')}</p>
        </div>
        <form
          onSubmit={handleSubmit}
          className="bg-gray-900 border border-gray-700 rounded-2xl p-8 flex flex-col gap-4 shadow-xl shadow-black/40"
        >
          {error && (
            <div className="bg-red-950/50 border border-red-800/50 rounded-lg px-4 py-2.5 text-red-400 text-sm text-center">
              {error}
            </div>
          )}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider">{t('login.loginLabel')}</label>
            <input
              type="text"
              value={username}
              onChange={e => setUsername(e.target.value)}
              required
              autoComplete="username"
              className="bg-gray-800 border border-gray-700 rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:border-yellow-400 transition-colors"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider">{t('login.passwordLabel')}</label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
              autoComplete="current-password"
              className="bg-gray-800 border border-gray-700 rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:border-yellow-400 transition-colors"
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="mt-2 bg-yellow-400 hover:bg-yellow-300 disabled:opacity-50 text-gray-950 font-bold rounded-xl py-2.5 text-sm transition-colors"
          >
            {loading ? t('login.loggingIn') : t('login.logIn')}
          </button>
        </form>
      </div>
    </div>
  )
}
