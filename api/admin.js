import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.VITE_SUPABASE_URL
// ללא VITE_ prefix — Vite לא יכניס מפתח זה לbundle הפרונטאנד
const serviceKey  = process.env.SUPABASE_SERVICE_ROLE

// דומיינים מאושרים בלבד
const ALLOWED_ORIGINS = [
  process.env.ALLOWED_ORIGIN ?? '',
  'https://dira-management.vercel.app',
].filter(Boolean)

function getAdminClient() {
  return createClient(supabaseUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false }
  })
}

function setCors(req, res) {
  const origin = req.headers.origin ?? ''
  if (ALLOWED_ORIGINS.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin)
  }
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')
  res.setHeader('Vary', 'Origin')
}

function sanitizeError(err) {
  // אל תחשוף פרטי DB, stack traces, או מבנה פנימי
  const msg = typeof err?.message === 'string' ? err.message : ''
  if (msg.includes('already exists') || msg.includes('already registered'))
    return 'משתמש עם כתובת מייל זו כבר קיים'
  if (msg.includes('invalid') || msg.includes('Invalid'))
    return 'פרמטרים לא תקינים'
  return 'פעולה נכשלה — נסה שוב'
}

function isValidEmail(email) {
  return typeof email === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) && email.length < 254
}

function isValidPassword(pw) {
  return typeof pw === 'string' && pw.length >= 8 && pw.length <= 128
}

function isValidUUID(id) {
  return typeof id === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)
}

export default async function handler(req, res) {
  setCors(req, res)
  if (req.method === 'OPTIONS') { res.status(200).end(); return }
  if (req.method !== 'POST')   { res.status(405).json({ error: 'Method not allowed' }); return }

  const token = (req.headers.authorization ?? '').replace('Bearer ', '').trim()
  if (!token) { res.status(401).json({ error: 'Unauthorized' }); return }

  const adminClient = getAdminClient()

  // אימות token
  const { data: { user }, error: authErr } = await adminClient.auth.getUser(token)
  if (authErr || !user) { res.status(401).json({ error: 'Unauthorized' }); return }

  // בדיקת role ב-DB (עוקף RLS בצד שרת)
  const { data: roleRow } = await adminClient
    .from('users_roles').select('role').eq('user_id', user.id).single()

  const role = roleRow?.role
  if (role !== 'super_admin' && role !== 'admin') {
    res.status(403).json({ error: 'Forbidden' }); return
  }

  const { action, email, password, userId, ban } = req.body ?? {}

  try {
    if (action === 'createUser') {
      if (!isValidEmail(email))    { res.status(400).json({ error: 'כתובת מייל לא תקינה' }); return }
      if (!isValidPassword(password)) { res.status(400).json({ error: 'סיסמה חייבת להיות לפחות 8 תווים' }); return }
      const { data, error } = await adminClient.auth.admin.createUser({
        email: email.toLowerCase().trim(),
        password,
        email_confirm: true
      })
      if (error) throw error
      // החזר רק מה שנחוץ — לא כל אובייקט user
      res.json({ user: { id: data.user.id, email: data.user.email } })

    } else if (action === 'deleteUser') {
      if (!isValidUUID(userId))    { res.status(400).json({ error: 'מזהה משתמש לא תקין' }); return }
      // מנע מחיקה עצמית
      if (userId === user.id)      { res.status(400).json({ error: 'אי אפשר למחוק את עצמך' }); return }
      const { error } = await adminClient.auth.admin.deleteUser(userId)
      if (error) throw error
      res.json({ success: true })

    } else if (action === 'banUser') {
      if (!isValidUUID(userId))    { res.status(400).json({ error: 'מזהה משתמש לא תקין' }); return }
      if (userId === user.id)      { res.status(400).json({ error: 'אי אפשר לחסום את עצמך' }); return }
      const { data, error } = await adminClient.auth.admin.updateUserById(userId, {
        ban_duration: ban ? '876600h' : 'none'
      })
      if (error) throw error
      res.json({ user: { id: data.user.id, banned_until: data.user.banned_until } })

    } else {
      res.status(400).json({ error: 'פעולה לא מוכרת' })
    }
  } catch (e) {
    res.status(400).json({ error: sanitizeError(e) })
  }
}
