import { useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'

/**
 * מאזין לשינויים בזמן אמת בטבלאות Supabase
 * @param {string|string[]} tables - טבלה אחת או רשימה
 * @param {Function} onchange - מופעל בכל INSERT / UPDATE / DELETE
 */
export function useRealtime(tables, onchange) {
  const cbRef = useRef(onchange)
  useEffect(() => { cbRef.current = onchange })   // תמיד המטפל העדכני

  useEffect(() => {
    const list = Array.isArray(tables) ? tables : [tables]
    const channel = supabase.channel(
      'rt_' + list.join('_') + '_' + Math.random().toString(36).slice(2, 7)
    )
    list.forEach(table =>
      channel.on('postgres_changes', { event: '*', schema: 'public', table }, () => {
        cbRef.current(table)
      })
    )
    channel.subscribe()
    return () => supabase.removeChannel(channel)
  }, [])  // subscribe פעם אחת בלבד
}
