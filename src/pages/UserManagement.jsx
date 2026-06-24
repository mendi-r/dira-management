import React, { useEffect, useState } from 'react'
import { Shield, UserPlus, Trash2, Edit2, RefreshCw, Mail, Clock, AlertCircle, KeyRound } from 'lucide-react'
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
  { value: 'admin',       label: '\u05de\u05e0\u05d4\u05dc \u05de\u05e2\u05e8\u05db\u05ea',  color: 'teal',  desc: '\u05d2\u05d9\u05e9\u05d4 \u05de\u05dc\u05d0\u05d4 \u05dc\u05db\u05dc \u05d4\u05de\u05e1\u05db\u05d9\u05dd + \u05e0\u05d9\u05d4\u05d5\u05dc \u05de\u05e9\u05ea\u05de\u05e9\u05d9\u05dd' },
  { value: 'accountant',  label: '\u05e8\u05d5\u05d0\u05d4 \u05d7\u05e9\u05d1\u05d5\u05df',   color: 'blue',  desc: '\u05d2\u05d1\u05d9\u05d9\u05d4, \u05d3\u05d5\u05d7\u05d5\u05ea \u05db\u05e1\u05e4\u05d9\u05d9\u05dd' },
  { value: 'maintenance', label: '\u05d0\u05d7\u05e8\u05d0\u05d9 \u05ea\u05d7\u05d6\u05d5\u05e7\u05d4', color: 'amber', desc: '\u05ea\u05d7\u05d6\u05d5\u05e7\u05d4 \u05d5\u05e7\u05e8\u05d9\u05d0\u05d5\u05ea \u05de\u05d5\u05e0\u05d9\u05dd' },
  { value: 'viewer',      label: '\u05e6\u05e4\u05d9\u05d9\u05d4 \u05d1\u05dc\u05d1\u05d3',   color: 'gray',  desc: '\u05e7\u05e8\u05d9\u05d0\u05d4 \u05d1\u05dc\u05d1\u05d3' },
]

const EMPTY = { email: '', role: 'admin' }

function roleInfo(r) {
  return ROLES.find(x => x.value === r) ?? { label: r, color: 'gray', desc: '' }
}

export default function UserManagement() {
  const toast = useToast()
  const { user, isAdmin } = useAuth()
  const [users,    setUsers]    = useState([])
  const [loading,  setLoading]  = useState(true)
  const [inviteModal, setInviteModal] = useState(false)
  const [editModal,   setEditModal]   = useState(null)
  const [resetModal,  setResetModal]  = useState(null)
  const [form,     setForm]     = useState(EMPTY)
  const [inviting, setInviting] = useState(false)
  const [saving,   setSaving]   = useState(false)
  const hasAdmin = !!supabaseAdmin

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

  async function invite() {
    if (!form.email.trim()) { toast('\u05d9\u05e9 \u05dc\u05d4\u05d6\u05d9\u05df \u05db\u05ea\u05d5\u05d1\u05ea \u05d0\u05d9\u05de\u05d9\u05d9\u05dc', 'error'); return }
    if (!hasAdmin) { toast('\u05d7\u05e1\u05e8 VITE_SUPABASE_SERVICE_ROLE', 'error'); return }
    setInviting(true)
    try {
      const { data: newUser, error } = await supabaseAdmin.auth.admin.inviteUserByEmail(form.email.trim())
      if (error) throw error
      const { error: roleErr } = await supabase.from('users_roles').upsert(
        { user_id: newUser.user.id, role: form.role },
        { onConflict: 'user_id' }
      )
      if (roleErr) throw roleErr
      toast('\u05d4\u05d6\u05de\u05e0\u05d4 \u05e0\u05e9\u05dc\u05d7\u05d4 \u05dc-' + form.email + ' \u2713')
      setInviteModal(false)
      setForm(EMPTY)
      load()
    } catch (e) {
      toast('\u05e9\u05d2\u05d9\u05d0\u05d4: ' + e.message, 'error')
    } finally {
      setInviting(false)
    }
  }

  async function updateRole(u, newRole) {
    setSaving(true)
    const { error } = await supabase.from('users_roles').update({ role: newRole }).eq('user_id', u.user_id)
    setSaving(false)
    if (error) { toast(error.message, 'error'); return }
    toast('\u05d4\u05e8\u05e9\u05d0\u05d4 \u05e2\u05d5\u05d3\u05db\u05e0\u05d4 \u2713')
    setEditModal(null)
    load()
  }

  async function removeUser(u) {
    if (!await confirm('\u05dc\u05d4\u05e1\u05d9\u05e8 \u05d0\u05ea ' + (u.email ?? u.user_id?.slice(0, 8)) + '?', { danger: true })) return
    const { error } = await supabase.from('users_roles').delete().eq('user_id', u.user_id)
    if (error) { toast(error.message, 'error'); return }
    if (hasAdmin) await supabaseAdmin.auth.admin.deleteUser(u.user_id)
    toast('\u05d4\u05de\u05e9\u05ea\u05de\u05e9 \u05d4\u05d5\u05e1\u05e8')
    load()
  }

  async function sendPasswordReset(u) {
    if (!u.email) { toast('\u05d0\u05d9\u05df \u05d0\u05d9\u05de\u05d9\u05d9\u05dc \u05dc\u05de\u05e9\u05ea\u05de\u05e9 \u05d6\u05d4', 'error'); return }
    const { error } = await supabase.auth.resetPasswordForEmail(u.email)
    if (error) { toast(error.message, 'error'); return }
    toast('\u05de\u05d9\u05d9\u05dc \u05d0\u05d9\u05e4\u05d5\u05e1 \u05e0\u05e9\u05dc\u05d7 \u05dc-' + u.email + ' \u2713')
    setResetModal(null)
  }

  if (!isAdmin) {
    return (
      <div className="flex flex-col items-center justify-center py-32 text-slate-400">
        <Shield size={48} className="opacity-20 mb-4"/>
        <p className="text-lg font-medium">\u05d0\u05d9\u05df \u05d2\u05d9\u05e9\u05d4</p>
        <p className="text-sm mt-1">\u05de\u05e1\u05da \u05d6\u05d4 \u05de\u05d9\u05d5\u05e2\u05d3 \u05dc\u05de\u05e0\u05d4\u05dc \u05d4\u05de\u05e2\u05e8\u05db\u05ea \u05d1\u05dc\u05d1\u05d3</p>
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
                <Badge color="teal">\u05de\u05e0\u05d4\u05dc \u05de\u05e2\u05e8\u05db\u05ea</Badge>
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
            <p className="font-medium">\u05db\u05d3\u05d9 \u05dc\u05d4\u05d6\u05de\u05d9\u05df \u05d5\u05dc\u05de\u05d7\u05d5\u05e7 \u05de\u05e9\u05ea\u05de\u05e9\u05d9\u05dd \u2014 \u05d4\u05d5\u05e1\u05e3 \u05d1-Vercel:</p>
            <code className="block mt-1 bg-amber-100 rounded px-2 py-1 text-xs">VITE_SUPABASE_SERVICE_ROLE = sb_secret_...</code>
          </div>
        </div>
      )}

      <Card>
        <CardHeader
          title={'\u05de\u05e9\u05ea\u05de\u05e9\u05d9\u05dd \u05de\u05d5\u05e8\u05e9\u05d9\u05dd (' + users.length + ')'}
          action={
            <div className="flex gap-2">
              <button onClick={load} className="p-2 rounded-lg hover:bg-slate-100 text-slate-400">
                <RefreshCw size={15}/>
              </button>
              <Button icon={UserPlus} onClick={() => { setForm(EMPTY); setInviteModal(true) }}>
                \u05d4\u05d6\u05de\u05df \u05de\u05e9\u05ea\u05de\u05e9
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
                <p>\u05dc\u05d0 \u05d4\u05d5\u05d2\u05d3\u05e8\u05d5 \u05de\u05e9\u05ea\u05de\u05e9\u05d9\u05dd \u05e0\u05d5\u05e1\u05e4\u05d9\u05dd</p>
              </div>
            )}
            {users.map(u => {
              const ri = roleInfo(u.role)
              const isSelf = u.user_id === user?.id
              return (
                <div key={u.user_id ?? u.id} className="flex items-center gap-4 px-6 py-4">
                  <div className="w-9 h-9 rounded-full bg-slate-100 flex items-center justify-center shrink-0 text-sm font-bold text-slate-500">
                    {u.email ? u.email[0].toUpperCase() : '?'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-slate-800 text-sm">{u.email ?? '(\u05dc\u05dc\u05d0 \u05d0\u05d9\u05de\u05d9\u05d9\u05dc)'}</span>
                      {isSelf && <span className="text-xs text-teal-600 font-medium">(\u05d0\u05ea\u05d4)</span>}
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
                      <button onClick={() => setEditModal({ ...u })} className="p-1.5 rounded text-slate-400 hover:text-teal-600 hover:bg-teal-50">
                        <Edit2 size={14}/>
                      </button>
                      <button onClick={() => setResetModal(u)} className="p-1.5 rounded text-slate-400 hover:text-blue-600 hover:bg-blue-50">
                        <KeyRound size={14}/>
                      </button>
                      <button onClick={() => removeUser(u)} className="p-1.5 rounded text-slate-400 hover:text-red-600 hover:bg-red-50">
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
        <CardHeader title="\u05e8\u05de\u05d5\u05ea \u05d4\u05e8\u05e9\u05d0\u05d4"/>
        <div className="divide-y divide-slate-100">
          {ROLES.map(r => (
            <div key={r.value} className="flex items-center gap-3 px-6 py-3">
              <Badge color={r.color}>{r.label}</Badge>
              <p className="text-sm text-slate-600">{r.desc}</p>
            </div>
          ))}
        </div>
      </Card>

      <Modal open={inviteModal} onClose={() => setInviteModal(false)} title="\u05d4\u05d6\u05de\u05e0\u05ea \u05de\u05e9\u05ea\u05de\u05e9 \u05d7\u05d3\u05e9" size="sm">
        <div className="space-y-4">
          <FormField label="\u05db\u05ea\u05d5\u05d1\u05ea \u05d0\u05d9\u05de\u05d9\u05d9\u05dc" required>
            <Input type="email" value={form.email}
              onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
              placeholder="user@example.com"/>
          </FormField>
          <FormField label="\u05e8\u05de\u05ea \u05d4\u05e8\u05e9\u05d0\u05d4">
            <Select value={form.role} onChange={e => setForm(f => ({ ...f, role: e.target.value }))}>
              {ROLES.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
            </Select>
          </FormField>
          <div className="p-3 bg-slate-50 rounded-xl text-xs text-slate-500 flex gap-2">
            <Mail size={14} className="shrink-0 mt-0.5"/>
            {hasAdmin ? '\u05d4\u05de\u05e9\u05ea\u05de\u05e9 \u05d9\u05e7\u05d1\u05dc \u05de\u05d9\u05d9\u05dc \u05e2\u05dd \u05e7\u05d9\u05e9\u05d5\u05e8 \u05dc\u05d4\u05d2\u05d3\u05e8\u05ea \u05e1\u05d9\u05e1\u05de\u05d0.' : '\u05e0\u05d3\u05e8\u05e9 VITE_SUPABASE_SERVICE_ROLE \u05d1-Vercel.'}
          </div>
        </div>
        <div className="flex justify-end gap-3 mt-6">
          <Button variant="secondary" onClick={() => setInviteModal(false)}>\u05d1\u05d9\u05d8\u05d5\u05dc</Button>
          <Button loading={inviting} icon={UserPlus} onClick={invite} disabled={!hasAdmin}>
            \u05e9\u05dc\u05d7 \u05d4\u05d6\u05de\u05e0\u05d4
          </Button>
        </div>
      </Modal>

      <Modal open={!!editModal} onClose={() => setEditModal(null)} title="\u05e9\u05d9\u05e0\u05d5\u05d9 \u05d4\u05e8\u05e9\u05d0\u05d4" size="sm">
        {editModal && (
          <div className="space-y-4">
            <p className="text-sm text-slate-600">
              \u05de\u05e9\u05ea\u05de\u05e9: <span className="font-medium">{editModal.email ?? editModal.user_id?.slice(0, 12)}</span>
            </p>
            <FormField label="\u05d4\u05e8\u05e9\u05d0\u05d4 \u05d7\u05d3\u05e9\u05d4">
              <Select defaultValue={editModal.role}
                onChange={e => setEditModal(m => ({ ...m, role: e.target.value }))}>
                {ROLES.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
              </Select>
            </FormField>
            <div className="flex justify-end gap-3 mt-4">
              <Button variant="secondary" onClick={() => setEditModal(null)}>\u05d1\u05d9\u05d8\u05d5\u05dc</Button>
              <Button loading={saving} onClick={() => updateRole(editModal, editModal.role)}>\u05e9\u05de\u05d5\u05e8</Button>
            </div>
          </div>
        )}
      </Modal>

      <Modal open={!!resetModal} onClose={() => setResetModal(null)} title="\u05d0\u05d9\u05e4\u05d5\u05e1 \u05e1\u05d9\u05e1\u05de\u05d0" size="sm">
        {resetModal && (
          <div className="space-y-4">
            <div className="flex gap-3 p-3 bg-blue-50 border border-blue-100 rounded-xl text-sm text-blue-700">
              <Mail size={16} className="shrink-0 mt-0.5"/>
              <p>\u05de\u05d9\u05d9\u05dc \u05d0\u05d9\u05e4\u05d5\u05e1 \u05e1\u05d9\u05e1\u05de\u05d0 \u05d9\u05d9\u05e9\u05dc\u05d7 \u05d0\u05dc <strong>{resetModal.email}</strong></p>
            </div>
            <div className="flex justify-end gap-3">
              <Button variant="secondary" onClick={() => setResetModal(null)}>\u05d1\u05d9\u05d8\u05d5\u05dc</Button>
              <Button icon={KeyRound} onClick={() => sendPasswordReset(resetModal)}>\u05e9\u05dc\u05d7 \u05de\u05d9\u05d9\u05dc</Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}
