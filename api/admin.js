import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.VITE_SUPABASE_URL
const anonKey     = process.env.VITE_SUPABASE_ANON_KEY
const serviceKey  = process.env.VITE_SUPABASE_SERVICE_ROLE

function getAdminClient() {
  return createClient(supabaseUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false }
  })
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')
  if (req.method === 'OPTIONS') { res.status(200).end(); return }
  if (req.method !== 'POST')   { res.status(405).json({ error: 'Method not allowed' }); return }

  const token = (req.headers.authorization || '').replace('Bearer ', '')
  if (!token) { res.status(401).json({ error: 'Unauthorized' }); return }

  const adminClient = getAdminClient()

  // Verify token and get user
  const { data: { user }, error: authErr } = await adminClient.auth.getUser(token)
  if (authErr || !user) { res.status(401).json({ error: 'Invalid token' }); return }

  // Check role using admin client (bypasses RLS)
  const { data: roleRow } = await adminClient
    .from('users_roles').select('role').eq('user_id', user.id).single()

  const role = roleRow?.role
  if (role !== 'super_admin' && role !== 'admin') {
    res.status(403).json({ error: 'Forbidden - admins only' }); return
  }

  const { action, email, password, userId, ban } = req.body

  try {
    if (action === 'createUser') {
      const { data, error } = await adminClient.auth.admin.createUser({
        email, password, email_confirm: true
      })
      if (error) throw error
      res.json({ user: data.user })

    } else if (action === 'deleteUser') {
      const { error } = await adminClient.auth.admin.deleteUser(userId)
      if (error) throw error
      res.json({ success: true })

    } else if (action === 'banUser') {
      const { data, error } = await adminClient.auth.admin.updateUserById(userId, {
        ban_duration: ban ? '876600h' : 'none'
      })
      if (error) throw error
      res.json({ user: data.user })

    } else {
      res.status(400).json({ error: 'Unknown action: ' + action })
    }
  } catch (e) {
    res.status(400).json({ error: e.message })
  }
}
