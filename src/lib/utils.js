// ─── WhatsApp ────────────────────────────────────────────────
export function waUrl(phone) {
  if (!phone) return null
  const num = phone.replace(/[^0-9]/g, '')
  const intl = num.startsWith('972') ? num
             : num.startsWith('0')   ? '972' + num.slice(1)
             : '972' + num
  return `https://wa.me/${intl}`
}

// ─── Date helpers ─────────────────────────────────────────────
export function formatDate(dateStr) {
  if (!dateStr) return '—'
  // Parse YYYY-MM-DD directly to avoid timezone shifts
  const m = String(dateStr).match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (m) return `${m[3]}/${m[2]}/${m[1]}`
  const d = new Date(dateStr)
  if (isNaN(d.getTime())) return '—'
  return `${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}/${d.getFullYear()}`
}

/** Format YYYY-MM as MM/YYYY */
export function formatMonth(ym) {
  if (!ym) return '—'
  const m = String(ym).match(/^(\d{4})-(\d{2})$/)
  if (m) return `${m[2]}/${m[1]}`
  return ym
}

export function toInputDate(dateStr) {
  if (!dateStr) return ''
  const d = new Date(dateStr)
  if (isNaN(d.getTime())) return ''
  return d.toISOString().slice(0, 10)
}

/** תאריך היום לפי שעון ישראל (YYYY-MM-DD) */
export function today() {
  return new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Jerusalem' })
}

/** חישוב תאריך סיום שכירות — יום אחרון של חודש אחרון (לא תחילת הבא) */
export function calcLeaseEnd(startDate, months) {
  if (!startDate || !months || Number(months) <= 0) return null
  const d = new Date(startDate + 'T12:00:00')
  d.setMonth(d.getMonth() + Number(months))
  d.setDate(0) // יום 0 = יום אחרון של החודש הקודם
  return d.toISOString().slice(0, 10)
}

/** כמה ימים עד תאריך יעד — לפי שעון ישראל */
export function daysUntil(dateStr) {
  if (!dateStr) return null
  const nowStr  = new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Jerusalem' })
  const nowDate = new Date(nowStr + 'T00:00:00')
  const then    = new Date(dateStr + 'T00:00:00')
  return Math.round((then - nowDate) / 86400000)
}

/** חודש בעברית */
export function hebrewMonth(dateStr) {
  if (!dateStr) return '—'
  const d = new Date(dateStr)
  return d.toLocaleDateString('he-IL', { year: 'numeric', month: 'long' })
}

// ─── Number helpers ───────────────────────────────────────────
export function currency(n) {
  if (n === null || n === undefined || n === '') return '—'
  return `₪${Number(n).toLocaleString('he-IL', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`
}

// ─── Activity log helper ──────────────────────────────────────
import { supabase } from './supabase'
export async function logActivity(peula, shm_jadal, record_id, teur) {
  try {
    await supabase.from('activity_log').insert({ peula, shm_jadal, record_id, teur })
  } catch (_) { /* silent */ }
}
