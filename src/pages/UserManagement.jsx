import React, { useEffect, useState } from 'react'
import { Shield, UserPlus, Trash2, Edit2, RefreshCw, Clock, AlertCircle, KeyRound, Eye, EyeOff, Lock, Unlock } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { formatDate } from '../lib/utils'
import { confirm } from '../lib/confirm'
import { Card, CardHeader, CardBody } from '../components/ui/Card'
import Modal from '../components/ui/Modal'
import Button from '../components/ui/Button'
import Badge from '../components/ui/Badge'
import { FormField, Input, Select } from '../components/ui/FormField'
import { useToast } from '../components/ui/Toast'
import { useAuth } from '../contexts/AuthContext'

async function adminApi(action, params = {}) {
  const { data: { session } } = await supabase.auth.getSession()
  const res = await fetch('/api/admin', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer ' + (session?.access_token ?? '')
    },
    body: JSON.stringify({ action, ...params })
  })
  const json = await res.json()
  if (!res.ok) throw new Error(json.error || 'שגיאת API')
  return json
}

const ROLES = [
  { value: 'super_admin',  label: 'מנהל ראשי',    color: 'purple', desc: 'גישה מלאה + ניהול משתמשים' },
  { value: 'admin',        label: 'מנהל מערכת',   color: 'teal',   desc: 'גישה מלאה לכל המסכים' },
  { value: 'accountant',   label: 'רואה חשבון',   color: 'blue',   desc: 'גבייה, דוחות כספיים' },
  { value: 'maintenance',  label: 'אחראי תחזוקה', color: 'amber',  desc: 'תחזוקה וקריאות מונים' },
  { value: 'viewer',       label: 'צפייה בלבד',   color: 'gray',   desc: 'קריאה בלבד' },
]

const EMPTY = { email: '', password: '', role: 'viewer' }

function roleInfo(r) {
  return ROLES.find(x => x.value === r) ?? { label: r, color: 'gray', desc: '' }
}

function isBanned(u) {
  if (!u.banned_until) return false
  return new Date(u.banned_until) > new Date()
}

export default function UserManagement() {
  const toast = useToast()
  const { user, isAdmin, isSuperAdmin } = useAuth()
  const [users,       setUsers]       = useState([])
  const [loading,     setLoading]     = useState(true)
  const [createModal, setCreateModal] = useState(false)
  const [editModal,   setEditModal]   = useState(null)
  const [form,        setForm]        = useState(EMPTY)
  const [showPw,      setShowPw]      = useState(false)
  const [saving,      setSaving]      = useState(false)
  const hasAdmin = true

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    try {
      const { data, error } = await supabase.rpc('get_users_with_roles')
      if (!error && data) {
        setUsers(data)
      } else {
        const { data: fallback } = await supabase
          .from('users_roles').select('*').order('created_at', { ascending: false })
        setUsers((fallback ?? []).map(r => ({ ...r, email: null })))
      }
    } catch (_) {
      const { data: fallback } = await supabase
        .from('users_roles').select('*').order('created_at', { ascending: false })
      setUsers((fallback ?? []).map(r => ({ ...r, email: null })))
    }
    setLoading(false)
  }

  async function createUser() {
    if (!form.email.trim()) { toast('יש להזין אימייל', 'error'); return }
    if (form.password.length < 6) { toast('סיסמא חייבת להיות לפחות 6 תווים', 'error'); return }
    setSaving(true)
    try {
      const { user: newUser } = await adminApi('createUser', { email: form.email.trim(), password: form.password })
      await supabase.from('users_roles').upsert(
        { user_id: newUser.id, role: form.role },
        { onConflict: 'user_id' }
      )
      toast('משתמש נוצר בהצלחה ✓')
      setCreateModal(false)
      setForm(EMPTY)
      load()
    } catch (e) {
      toast('שגיאה: ' + e.message, 'error')
    } finally {
      setSaving(false)
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

  async function toggleSuspend(u) {
    const banned = isBanned(u)
    const msg = banned ? 'להסיר השעיה מ-' : 'להשעות את '
    if (!await confirm(msg + (u.email ?? u.user_id?.slice(0, 8)) + '?', { danger: !banned })) return
    try {
      await adminApi('banUser', { userId: u.user_id, ban: !banned })
      toast(banned ? 'ההשעיה הוסרה ✓' : 'המשתמש הושעה — יצא מהמערכת בפעם הבאה שיבצע פעולה ✓')
      load()
    } catch (e) {
      toast('שגיאה: ' + e.message, 'error')
    }
  }

  async function removeUser(u) {
    if (!await confirm('למחוק את ' + (u.email ?? u.user_id?.slice(0, 8)) + '?', { danger: true })) return
    await supabase.from('users_roles').delete().eq('user_id', u.user_id)
    try { await adminApi('deleteUser', { userId: u.user_id }) } catch (_) {}
    toast('המשתמש נמחק')
    load()
  }

  async function resetPassword(u) {
    if (!u.email) { toast('אין אימייל למשתמש', 'error'); return }
    const { error } = await supabase.auth.resetPasswordForEmail(u.email)
    if (error) { toast(error.message, 'error'); return }
    toast('מייל איפוס נשלח ✓')
  }

  if (!isSuperAdmin) {
    return (
      <div className="flex flex-col items-center justify-center py-32 text-slate-400">
        <Shield size={48} className="opacity-20 mb-4"/>
        <p className="text-lg font-medium">{'אין גישה'}</p>
        <p className="text-sm mt-1">{'מסך זה מיועד למנהל המערכת בלבד'}</p>
      </div>
    )
  }

  return (
    <div className="space-y-6 fade-in">
      <Card>
        <CardBody>
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-full bg-teal-100 flex items-center justify-center">
              <Shield size={22} className="text-teal-600"/>
            </div>
            <div>
              <p className="font-semibold text-slate-800">{user?.email}</p>
              <div className="flex items-center gap-2 mt-0.5">
                <Badge color={isSuperAdmin ? 'purple' : 'teal'}>{isSuperAdmin ? 'מנהל ראשי' : 'מנהל מערכת'}</Badge>
                <span className="text-xs text-slate-400">{user?.id?.slice(0, 8)}...</span>
              </div>
            </div>
          </div>
        </CardBody>
      </Card>

      {!hasAdmin && (
        <div className="flex gap-3 p-4 bg-amber-50 border border-amber-200 rounded-xl text-sm text-amber-800">
          <AlertCircle size={18} className="shrink-0 mt-0.5"/>
          <div>
            <p className="font-medium">{'כדי לנהל משתמשים — הוסף ב-Vercel:'}</p>
            <code className="block mt-1 bg-amber-100 rounded px-2 py-1 text-xs">VITE_SUPABASE_SERVICE_ROLE = sb_secret_...</code>
          </div>
        </div>
      )}

      <Card>
        <CardHeader
          title={'משתמשים מורשים (' + users.length + ')'}
          action={
            <div className="flex gap-2">
              <button onClick={load} className="p-2 rounded-lg hover:bg-slate-100 text-slate-400">
                <RefreshCw size={15}/>
              </button>
              <Button icon={UserPlus} onClick={() => { setForm(EMPTY); setShowPw(false); setCreateModal(true) }} disabled={!hasAdmin}>
                {'צור משתמש'}
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
                <p>{'אין משתמשים נוספים'}</p>
              </div>
            )}
            {users.map(u => {
              const ri = roleInfo(u.role)
              const isSelf = u.user_id === user?.id
              const banned = isBanned(u)
              return (
                <div key={u.user_id ?? u.id} className={'flex items-center gap-4 px-6 py-4' + (banned ? ' bg-red-50' : '')}>
                  <div className="w-9 h-9 rounded-full bg-slate-100 flex items-center justify-center shrink-0 text-sm font-bold text-slate-500">
                    {u.email ? u.email[0].toUpperCase() : '?'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-slate-800 text-sm">{u.email ?? '(ללא אימייל)'}</span>
                      {isSelf && <span className="text-xs text-teal-600 font-medium">{'(אתה)'}</span>}
                      {banned && <Badge color="red">{'מושעה'}</Badge>}
                    </div>
                    <div className="flex items-center gap-2 mt-0.5">
                      <Badge color={ri.color}>{ri.label}</Badge>
                      {u.last_sign_in && (
                        <span className="text-xs text-slate-400 flex items-center gap-1">
                          <Clock size={10}/> {formatDate((u.last_sign_in ?? '').slice(0, 10))}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="text-xs text-slate-400 hidden sm:block">
                    {formatDate((u.created_at ?? '').slice(0, 10))}
                  </div>
                  {!isSelf && (
                    <div className="flex gap-1 shrink-0">
                      <button onClick={() => setEditModal({ ...u })} title="שנה הרשאה"
                        className="p-1.5 rounded text-slate-400 hover:text-teal-600 hover:bg-teal-50">
                        <Edit2 size={14}/>
                      </button>
                      <button onClick={() => toggleSuspend(u)} title={banned ? 'הסר השעיה' : 'השעה משתמש'}
                        className={'p-1.5 rounded ' + (banned ? 'text-amber-500 hover:bg-amber-50' : 'text-slate-400 hover:text-amber-600 hover:bg-amber-50')}>
                        {banned ? <Unlock size={14}/> : <Lock size={14}/>}
                      </button>
                      <button onClick={() => resetPassword(u)} title="אפס סיסמא"
                        className="p-1.5 rounded text-slate-400 hover:text-blue-600 hover:bg-blue-50">
                        <KeyRound size={14}/>
                      </button>
                      <button onClick={() => removeUser(u)} title="מחק משתמש"
                        className="p-1.5 rounded text-slate-400 hover:text-red-600 hover:bg-red-50">
                        <Trash2 size={14}/>
                      </button>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </Card>

      <Card>
        <CardHeader title={'רמות הרשאה'}/>
        <div className="divide-y divide-slate-100">
          {ROLES.map(r => (
            <div key={r.value} className="flex items-center gap-3 px-6 py-3">
              <Badge color={r.color}>{r.label}</Badge>
              <p className="text-sm text-slate-600">{r.desc}</p>
            </div>
          ))}
        </div>
      </Card>

      <Modal open={createModal} onClose={() => setCreateModal(false)} title={'יצירת משתמש חדש'} size="sm">
        <div className="space-y-4">
          <FormField label={'כתובת אימייל'} required>
            <Input type="email" value={form.email}
              onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
              placeholder="user@example.com"/>
          </FormField>
          <FormField label={'סיסמא'} required>
            <div className="relative">
              <Input
                type={showPw ? 'text' : 'password'}
                value={form.password}
                onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                placeholder="לפחות 6 תווים"
              />
              <button type="button" onClick={() => setShowPw(p => !p)}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                {showPw ? <EyeOff size={16}/> : <Eye size={16}/>}
              </button>
            </div>
          </FormField>
          <FormField label={'רמת הרשאה'}>
            <Select value={form.role} onChange={e => setForm(f => ({ ...f, role: e.target.value }))}>
              {ROLES.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
            </Select>
          </FormField>
          <div className="p-3 bg-blue-50 rounded-xl text-xs text-blue-700">
            {'המשתמש יוכל להיכנס מיד עם האימייל והסיסמא שתמסור לו. לא נשלח מייל אוטומטי.'}
          </div>
        </div>
        <div className="flex justify-end gap-3 mt-6">
          <Button variant="secondary" onClick={() => setCreateModal(false)}>{'ביטול'}</Button>
          <Button loading={saving} icon={UserPlus} onClick={createUser}>{'צור משתמש'}</Button>
        </div>
      </Modal>

      <Modal open={!!editModal} onClose={() => setEditModal(null)} title={'שינוי הרשאה'} size="sm">
        {editModal && (
          <div className="space-y-4">
            <p className="text-sm text-slate-600">
              {'משתמש: '}<span className="font-medium">{editModal.email ?? editModal.user_id?.slice(0, 12)}</span>
            </p>
            <FormField label={'הרשאה חדשה'}>
              <Select defaultValue={editModal.role}
                onChange={e => setEditModal(m => ({ ...m, role: e.target.value }))}>
                {ROLES.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
              </Select>
            </FormField>
            <div className="flex justify-end gap-3 mt-4">
              <Button variant="secondary" onClick={() => setEditModal(null)}>{'ביטול'}</Button>
              <Button loading={saving} onClick={() => updateRole(editModal, editModal.role)}>{'שמור'}</Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}
