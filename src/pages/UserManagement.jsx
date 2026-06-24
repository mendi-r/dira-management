import React, { useEffect, useState } from 'react'
import {
  Shield, UserPlus, Trash2, Edit2, RefreshCw,
  Mail, Clock, AlertCircle, CheckCircle2, KeyRound
} from 'lucide-react'
import { supabase, supabaseAdmin } from '../lib/supabase'
import { formatDate } from '../lib/utils'
import { confirm } from '../lib/confirm'
import { Card, CardHeader, CardBody } from '../components/ui/Card'
import Modal from '../components/ui/Modal'
import Button from '../components/ui/Button'
import Badge from '../components/ui/Badge'
import { FormField, Input, Select } from '../components/ui/FormField'
import { useToast } from '../components/ui/Toast'
import { useAuth } from '../contexts/AuthContext'

const ROLES = [
  { value: 'admin',       label: 'מנהל מערכת',  color: 'teal',  desc: 'גישה מלאה לכל המסכים + ניהול משתמשים' },
  { value: 'accountant',  label: 'רואה חשבון',   color: 'blue',  desc: 'גבייה, דוחות כספיים, תשלומים בלבד' },
  { value: 'maintenance', label: 'אחראי תחזוקה', color: 'amber', desc: 'תחזוקה וקריאות מונים בלבד' },
  { value: 'viewer',      label: 'צפייה בלבד',   color: 'gray',  desc: 'קריאה בלבד, ללא עריכה' },
]

const EMPTY = { email: '', role: 'admin' }

function roleInfo(r) { return ROLES.find(x => x.value === r) ?? { label: r, color: 'gray', desc: '' } }

export default function UserManagement() {
  const toast = useToast()
  const { user, isAdmin } = useAuth()
  const [users,   setUsers]   = useState([])
  const [loading, setLoading] = useState(true)
  const [inviteModal, setInviteModal] = useState(false)
  const [editModal,   setEditModal]   = useState(null)
  const [resetModal,  setResetModal]  = useState(null)
  const [form,     setForm]    = useState(EMPTY)
  const [inviting, setInviting]= useState(false)
  const [saving,   setSaving]  = useState(false)
  const hasAdmin = !!supabaseAdmin

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    try {
      // נסה RPC שמחזיר אימיילים
      const { data: rpcData, error: rpcErr } = await supabase.rpc('get_users_with_roles')
      if (!rpcErr && rpcData) {
        setUsers(rpcData)
      } else {
        // fallback — רק מ-users_roles בלי אימיילים
        const { data } = await supabase.from('users_roles').select('*').order('created_at', { ascending: false })
        setUsers((data ?? []).map(r => ({ ...r, email: null })))
      }
    } catch {
      const { data } = await supabase.from('users_roles').select('*').order('created_at', { ascending: false })
      setUsers((data ?? []).map(r => ({ ...r, email: null })))
    }
    setLoading(false)
  }

  async function invite() {
    if (!form.email.trim()) { toast('יש להזין כתובת אימייל', 'error'); return }
    if (!hasAdmin) { toast('חסר VITE_SUPABASE_SERVICE_ROLE — ראה הוראות למטה', 'error'); return }
    setInviting(true)
    try {
      // יצירת משתמש + שליחת הזמנה במייל
      const { data: newUser, error } = await supabaseAdmin.auth.admin.inviteUserByEmail(form.email.trim())
      if (error) throw error

      // הוספה ל-users_roles
      const { error: roleErr } = await supabase.from('users_roles').upsert({
        user_id: newUser.user.id,
        role: form.role,
      }, { onConflict: 'user_id' })
      if (roleErr) throw roleErr

      toast(`הזמנה נשלחה ל-${form.email} ✓`)
      setInviteModal(false)
      setForm(EMPTY)
      load()
    } catch (e) {
      toast('שגיאה: ' + e.message, 'error')
    } finally {
      setInviting(false)
    }
  }

  async function updateRole(u, newRole) {
    setSaving(true)
    const { error } = await supabase.from('users_roles').update({ role: newRole }).eq('user_id', u.user_id)
    setSaving(false)
    if (error) { toast(error.message, 'error'); return }
    toast('הרשאה עודכנה ✓')
    setEditModal(null)
    load()
  }

  async function removeUser(u) {
    if (!await confirm(`להסיר את ${u.email ?? u.user_id?.slice(0,8)}?`, { danger: true })) return
    // מחיקה מ-users_roles
    const { error } = await supabase.from('users_roles').delete().eq('user_id', u.user_id)
    if (error) { toast(error.message, 'error'); return }
    // מחיקת המשתמש מ-Auth (רק אם יש admin client)
    if (hasAdmin) {
      await supabaseAdmin.auth.admin.deleteUser(u.user_id)
    }
    toast('המשתמש הוסר')
    load()
  }

  async function sendPasswordReset(u) {
    if (!hasAdmin) { toast('חסר VITE_SUPABASE_SERVICE_ROLE', 'error'); return }
    if (!u.email)  { toast('אין אימייל למשתמש זה', 'error'); return }
    const { error } = await supabaseAdmin.auth.admin.generateLink({ type: 'recovery', email: u.email })
    if (error) { toast(error.message, 'error'); return }
    // שליחת reset פשוט דרך הדרך הרגילה
    await supabase.auth.resetPasswordForEmail(u.email)
    toast(`מייל איפוס נשלח ל-${u.email} ✓`)
    setResetModal(null)
  }

  if (!isAdmin) {
    return (
      <div className="flex flex-col items-center justify-center py-32 text-slate-400">
        <Shield size={48} className="opacity-20 mb-4"/>
        <p className="text-lg font-medium">אין גישה</p>
        <p className="text-sm mt-1">מסך זה מיועד למנהל המערכת בלבד</p>
      </div>
    )
  }

  return (
    <div className="space-y-6 fade-in">

      {/* כרטיס המשתמש הנוכחי */}
      <Card>
        <CardBody>
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-full bg-teal-100 flex items-center justify-center">
              <Shield size={22} className="text-teal-600"/>
            </div>
            <div>
              <p className="font-semibold text-slate-800">{user?.email}</p>
              <div className="flex items-center gap-2 mt-0.5">
                <Badge color="teal">מנהל מערכת</Badge>
                <span className="text-xs text-slate-400">{user?.id?.slice(0,8)}...</span>
              </div>
            </div>
          </div>
        </CardBody>
      </Card>

      {/* אם אין service role — banner */}
      {!hasAdmin && (
        <div className="flex gap-3 p-4 bg-amber-50 border border-amber-200 rounded-xl text-sm text-amber-800">
          <AlertCircle size={18} className="shrink-0 mt-0.5"/>
          <div>
            <p className="font-medium">כדי להזמין ולמחוק משתמשים — הוסף:</p>
            <code className="block mt-1 bg-amber-100 rounded px-2 py-1 text-xs">
              VITE_SUPABASE_SERVICE_ROLE=&lt;service_role key מ-Supabase Dashboard → Settings → API&gt;
            </code>
            <p className="mt-1 text-xs">הוסף ל-.env.local ולמשתני הסביבה ב-Vercel</p>
          </div>
        </div>
      )}

      {/* טבלת משתמשים */}
      <Card>
        <CardHeader
          title={`משתמשים מורשים (${users.length})`}
          action={
            <div className="flex gap-2">
              <button onClick={load} className="p-2 rounded-lg hover:bg-slate-100 text-slate-400" title="רענן">
                <RefreshCw size={15}/>
              </button>
              <Button icon={UserPlus} onClick={() => { setForm(EMPTY); setInviteModal(true) }}>
                הזמן משתמש
              </Button>
            </div>
          }
        />

        {loading && (
          <div className="flex justify-center py-10">
            <div className="animate-spin rounded-full h-8 w-8 border-4 border-teal-500 border-t-transparent"/>
          </div>
        )}

        {!loading && (
          <div className="divide-y divide-slate-100">
            {users.length === 0 && (
              <div className="py-12 text-center text-slate-400">
                <Shield size={32} className="mx-auto mb-2 opacity-30"/>
                <p>לא הוגדרו משתמשים נוספים</p>
              </div>
            )}
            {users.map(u => {
              const ri = roleInfo(u.role)
              const isSelf = u.user_id === user?.id
              return (
                <div key={u.user_id} className="flex items-center gap-4 px-6 py-4">
                  <div className="w-9 h-9 rounded-full bg-slate-100 flex items-center justify-center shrink-0 text-sm font-bold text-slate-500">
                    {u.email ? u.email[0].toUpperCase() : '?'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-slate-800 text-sm">{u.email ?? '(ללא אימייל)'}</span>
                      {isSelf && <span className="text-xs text-teal-600 font-medium">(אתה)</span>}
                    </div>
                    <div className="flex items-center gap-2 mt-0.5">
                      <Badge color={ri.color}>{ri.label}</Badge>
                      {u.last_sign_in && (
                        <span className="text-xs text-slate-400 flex items-center gap-1">
                          <Clock size={10}/> {formatDate(u.last_sign_in?.slice(0,10))}
                        </span>
                      )}
                    </div>
                  </div>
                  {!isSelf && (
                    <div className="flex gap-1 shrink-0">
                      <button onClick={() => setEditModal({ ...u })}
                        className="p-1.5 rounded text-slate-400 hover:text-teal-600 hover:bg-teal-50" title="שנה הרשאה">
                        <Edit2 size={14}/>
                      </button>
                      <button onClick={() => setResetModal(u)}
                        className="p-1.5 rounded text-slate-400 hover:text-blue-600 hover:bg-blue-50" title="שלח איפוס סיסמה">
                        <KeyRound size={14}/>
                      </button>
                      <button onClick={() => removeUser(u)}
                        className="p-1.5 rounded text-slate-400 hover:text-red-600 hover:bg-red-50" title="הסר משתמש">
                        <Trash2 size={14}/>
                      </button>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
       