import { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from '../supabaseClient'

const ADMIN_UUID = 'f149edd8-f5d9-454b-9757-f84cef4f9192'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [session, setSession] = useState(undefined)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
    })

    return () => subscription.unsubscribe()
  }, [])

  const isAdmin = session?.user?.id === ADMIN_UUID

  return (
    <AuthContext.Provider value={{ session, isAdmin }}>
      {session !== undefined && children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  return useContext(AuthContext)
}
