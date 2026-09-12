import { createContext, useContext, useEffect, useState } from 'react'
import { getToken, logout as authLogout, me as authMe } from '../authClient'

const AuthContext = createContext(null)
const NICKNAME_KEY = 'metin_nickname'

export function AuthProvider({ children }) {
  const [session, setSession] = useState(undefined)
  const [isAdmin, setIsAdmin] = useState(false)
  const [canAddMarkers, setCanAddMarkers] = useState(false)
  const [isDogtrackerUser, setIsDogtrackerUser] = useState(false)
  const [nickname, setNicknameState] = useState(() => localStorage.getItem(NICKNAME_KEY) || '')

  function setNickname(value) {
    const trimmed = value.trim()
    localStorage.setItem(NICKNAME_KEY, trimmed)
    setNicknameState(trimmed)
  }

  async function refresh() {
    if (!getToken()) {
      setSession(null)
      setIsAdmin(false)
      setCanAddMarkers(false)
      setIsDogtrackerUser(false)
      return
    }
    const flags = await authMe()
    if (!flags) {
      setSession(null)
      setIsAdmin(false)
      setCanAddMarkers(false)
      setIsDogtrackerUser(false)
      return
    }
    setSession(true)
    setIsAdmin(flags.isAdmin)
    setCanAddMarkers(flags.isAdmin || flags.isEditor)
    setIsDogtrackerUser(flags.isDogtrackerUser)
  }

  useEffect(() => {
    refresh()
  }, [])

  function logout() {
    authLogout()
    setSession(null)
    setIsAdmin(false)
    setCanAddMarkers(false)
    setIsDogtrackerUser(false)
  }

  return (
    <AuthContext.Provider value={{ session, isAdmin, canAddMarkers, isDogtrackerUser, nickname, setNickname, refresh, logout }}>
      {session !== undefined && children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  return useContext(AuthContext)
}
