import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'

export function useRole() {
  const { user } = useAuth()
  const [role, setRole]       = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user) { setRole(null); setLoading(false); return }
    supabase
      .from('users_roles')
      .select('role')
      .eq('user_id', user.id)
      .single()
      .then(({ data }) => {
        setRole(data?.role ?? 'admin')
        setLoading(false)
      })
  }, [user])

  return {
    role,
    loading,
    isAdmin:       role === 'admin',
    isMaintenance: role === 'maintenance',
    isAccountant:  role === 'accountant',
    can: (action) => {
      if (role === 'admin') return true
      if (role === 'maintenance') return ['tachzuka', 'monim'].includes(action)
      if (role === 'accountant')  return ['gviya', 'reports'].includes(action)
      return false
    }
  }
}
