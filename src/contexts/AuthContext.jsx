import React, { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user,    setUser]    = useState(null)
  const [role,    setRole]    = useState(null)
  const [viewAsOwnerId, setViewAsOwnerId] = useState(null)
  const [loading, setLoading] = useState(true)

  async function loadRole(uid) {
    if (!uid) { setRole(null); return }
    const { data } = await supabase
      .from('users_roles').select('role').eq('user_id', uid).single()
    setRole(data?.role ?? 'viewer')
  }

  // בדיקת ban פעיל — מגרש מושעים מיד בלי להמתין לפקיעת Token
  async function checkBanStatus() {
    const { data: { user: freshUser }, error } = await supabase.auth.getUser()
    if (error || !freshUser) { await supabase.auth.signOut(); return }
    const bannedUntil = freshUser.banned_until
    if (bannedUntil && new Date(bannedUntil) > new Date()) {
      await supabase.auth.signOut()
    }
  }

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      const u = data.session?.user ?? null
      setUser(u)
      loadRole(u?.id).finally(() => setLoading(false))
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      const u = session?.user ?? null
      setUser(u)
      loadRole(u?.id)
      // אם יוזר נכנס — בדוק מיד אם הוא מושעה
      if (u) checkBanStatus()
    })

    // בדיקת ban כל 30 שניות לכל יוזר מחובר
    const banInterval = setInterval(() => {
      supabase.auth.getSession().then(({ data }) => {
        if (data.session?.user) checkBanStatus()
      })
    }, 30_000)

    return () => {
      subscription.unsubscribe()
      clearInterval(banInterval)
    }
  }, [])

  const signIn  = (email, password) => supabase.auth.signInWithPassword({ email, password })
  const signOut = () => supabase.auth.signOut()

  return (
    <AuthContext.Provider value={{ user, role, isAdmin: role === 'admin' || role === 'super_admin', isSuperAdmin: role === 'super_admin', loading, signIn, signOut, viewAsOwnerId, setViewAsOwnerId }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  return useContext(AuthContext)
}