import { useState } from 'react'
import { useAuth } from '../context/AuthContext'

export default function NicknamePrompt() {
  const { session, canAddMarkers, nickname, setNickname } = useAuth()
  const [value, setValue] = useState('')

  if (!session || !canAddMarkers || nickname) return null

  function handleSubmit(e) {
    e.preventDefault()
    if (!value.trim()) return
    setNickname(value)
  }

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-[100] p-4">
      <div className="bg-gray-900 border border-gray-700 rounded-2xl w-full max-w-sm p-6">
        <h2 className="text-lg font-bold text-white mb-1">Enter your Metin2 nickname</h2>
        <p className="text-sm text-gray-400 mb-4">We need it to credit you in the Hall of Fame for mokoko you add.</p>
        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <input
            type="text"
            value={value}
            onChange={e => setValue(e.target.value)}
            autoFocus
            required
            maxLength={40}
            placeholder="Your nickname..."
            className="bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-yellow-400"
          />
          <button
            type="submit"
            disabled={!value.trim()}
            className="bg-yellow-400 hover:bg-yellow-300 disabled:opacity-50 text-gray-950 font-bold rounded-lg py-2 text-sm transition-colors"
          >
            Confirm
          </button>
        </form>
      </div>
    </div>
  )
}
