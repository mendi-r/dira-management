/**
 * מטמון זיכרון פשוט לתוצאות Supabase.
 * חי כל עוד הדפדפן פתוח (לא sessionStorage — מהיר יותר).
 * TTL ברירת מחדל: 60 שניות.
 */
const _cache = new Map()

export function getCache(key) {
  const entry = _cache.get(key)
  if (!entry) return null
  if (Date.now() > entry.exp) { _cache.delete(key); return null }
  return entry.data
}

export function setCache(key, data, ttlMs = 60_000) {
  _cache.set(key, { data, exp: Date.now() + ttlMs })
}

/** נקה מפתח ספציפי או את כל המטמון */
export function clearCache(key) {
  if (key) _cache.delete(key)
  else _cache.clear()
}

/** עטיפה נוחה: אם קיים במטמון מחזיר מיד, אחרת מריץ fn ושומר */
export async function cached(key, fn, ttlMs = 60_000) {
  const hit = getCache(key)
  if (hit !== null) return hit
  const data = await fn()
  setCache(key, data, ttlMs)
  return data
}
