import { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from '../supabaseClient'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [session, setSession] = useState(undefined)
  const [isAdmin, setIsAdmin] = useState(false)
  const [canAddMarkers, setCanAddMarkers] = useState(false)

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
    if (!session?.user?.id) { setIsAdmin(false); setCanAddMarkers(false); return }
    const [{ data: adminRow }, { data: editorRow }] = await Promise.all([
      supabase.from('admins').select('user_id').eq('user_id', session.user.id).maybeSingle(),
      supabase.from('map_editors').select('user_id').eq('user_id', session.user.id).maybeSingle(),
    ])
    setIsAdmin(!!adminRow)
    setCanAddMarkers(!!adminRow || !!editorRow)
  }

  return (
    <AuthContext.Provider value={{ session, isAdmin, canAddMarkers }}>
      {session !== undefined && children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  return useContext(AuthContext)
}
