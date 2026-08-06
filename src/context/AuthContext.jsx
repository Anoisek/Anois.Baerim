import { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from '../supabaseClient'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [session, setSession] = useState(undefined)
  const [isAdmin, setIsAdmin] = useState(false)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      checkAdmin(data.session)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
      checkAdmin(session)
    })

    return () => subscription.unsubscribe()
  }, [])

  async function checkAdmin(session) {
    if (!session?.user?.id) { setIsAdmin(false); return }
    const { data } = await supabase.from('admins').select('user_id').eq('user_id', session.user.id).maybeSingle()
    setIsAdmin(!!data)
  }

  return (
    <AuthContext.Provider value={{ session, isAdmin }}>
      {session !== undefined && children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  return useContext(AuthContext)
}
