import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../supabaseClient'

const LOGIN_DOMAIN = '@baerim.local'

export default function Login() {
  const navigate = useNavigate()
  const [login, setLogin] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setLoading(true)
    const email = login.includes('@') ? login.trim() : login.trim() + LOGIN_DOMAIN
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) setError('Invalid login or password.')
    else navigate('/')
    setLoading(false)
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <span className="text-4xl">⚔️</span>
          <h1 className="text-2xl font-bold text-yellow-400 mt-3">Baerim Calculator</h1>
          <p className="text-gray-500 text-sm mt-1">Admin access</p>
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
            <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Login</label>
            <input
              type="text"
              value={login}
              onChange={e => setLogin(e.target.value)}
              required
              autoComplete="username"
              className="bg-gray-800 border border-gray-700 rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:border-yellow-400 transition-colors"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Password</label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
              className="bg-gray-800 border border-gray-700 rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:border-yellow-400 transition-colors"
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="mt-2 bg-yellow-400 hover:bg-yellow-300 disabled:opacity-50 text-gray-950 font-bold rounded-xl py-2.5 text-sm transition-colors"
          >
            {loading ? 'Logging in...' : 'Log in'}
          </button>
        </form>
      </div>
    </div>
  )
}
