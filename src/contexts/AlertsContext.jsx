import React, { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { daysUntil } from '../lib/utils'
import { useAuth } from './AuthContext'
import { getSettings } from '../lib/settings'

const AlertsCtx = createContext({ alerts: [], total: 0, reload: () => {} })

export function AlertsProvider({ children }) {
  const { user, loading: authLoading } = useAuth()   // ← מהמטמון, ללא נסיעת רשת
  const [alerts, setAlerts] = useState([])

  async function load() {
    // שעון ישראל — ללא network call
    const today = new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Jerusalem' })
    const { soonDays } = getSettings()

    const [{ data: bochurim }, { data: dirot }, { data: calEvs }] = await Promise.all([
      supabase.from('bochurim').select('id,shem,mishpacha,tokef_viza').not('tokef_viza','is',null),
      supabase.from('dirot').select('id,ktovet,sofit_schirut,bituach_chadush'),
      user
        ? supabase.from('calendar_events').select('*').eq('user_id', user.id).eq('with_reminder', true).gte('taarich', today)
        : Promise.resolve({ data: [] }),
    ])

    const list = []

    // ויזות פוגות תוך X ימים
    ;(bochurim ?? []).forEach(b => {
      const d = daysUntil(b.tokef_viza)
      if (d !== null && d <= soonDays && d >= -7) {
        list.push({
          type: 'visa',
          severity: d < 0 ? 'error' : d <= 7 ? 'error' : 'warning',
          label: `ויזה: ${b.shem ?? ''} ${b.mishpacha ?? ''}`,
          days: d,
          nav: '/bochurim',
        })
      }
    })

    // חוזים מסתיימים תוך X ימים
    ;(dirot ?? []).forEach(d => {
      const dc = daysUntil(d.sofit_schirut)
      if (dc !== null && dc <= soonDays && dc >= -7) {
        list.push({
          type: 'contract',
          severity: dc < 0 ? 'error' : dc <= 7 ? 'error' : 'warning',
          label: `חוזה: ${d.ktovet ?? ''}`,
          days: dc,
          nav: '/dirot',
        })
      }
      // ביטוח
      const db = daysUntil(d.bituach_chadush)
      if (db !== null && db <= soonDays && db >= -7) {
        list.push({
          type: 'insurance',
          severity: db < 0 ? 'error' : 'warning',
          label: `ביטוח: ${d.ktovet ?? ''}`,
          days: db,
          nav: '/dirot',
        })
      }
    })

    // אירועים אישיים עם תזכורת
    ;(calEvs ?? []).forEach(ev => {
      const d = daysUntil(ev.taarich)
      if (d !== null && d >= 0 && d <= (ev.reminder_days ?? 1)) {
        list.push({
          type: 'personal',
          severity: d === 0 ? 'error' : 'warning',
          label: ev.teur,
          days: d,
          nav: '/calendar',
        })
      }
    })

    // Sort: errors first, then by days
    list.sort((a, b) => {
      if (a.severity !== b.severity) return a.severity === 'error' ? -1 : 1
      return a.days - b.days
    })

    setAlerts(list)
  }

  useEffect(() => {
    if (authLoading) return  // מחכים שה-auth יסיים לפני הטעינה הראשונה
    load()
    const interval = setInterval(load, 5 * 60 * 1000)
    return () => clearInterval(interval)
  }, [authLoading, user?.id])  // רץ פעם אחת אחרי auth, ושוב אם משתמש מתחלף

  return (
    <AlertsCtx.Provider value={{ alerts, total: alerts.length, reload: load }}>
      {children}
    </AlertsCtx.Provider>
  )
}

export function useAlerts() {
  return useContext(AlertsCtx)
}
