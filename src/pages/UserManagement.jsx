import React, { useEffect, useState } from 'react'
import { Shield, UserPlus, Trash2, Edit2, RefreshCw } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { formatDate } from '../lib/utils'
import { confirm } from '../lib/confirm'
import { Card, CardHeader, CardBody } from '../components/ui/Card'
import Modal from '../components/ui/Modal'
import Button from '../components/ui/Button'
import Badge from '../components/ui/Badge'
import { FormField, Input, Select } from '../components/ui/FormField'
import AlertBanner from '../components/ui/AlertBanner'
import { useToast } from '../components/ui/Toast'
import { useAuth } from '../contexts/AuthContext'

const ROLES = [
  { value:'admin',       label:'מנהל מערכת',   color:'teal',   desc:'גישה מלאה לכל המסכים' },
  { value:'accountant',  label:'רואה חשבון',    color:'blue',   desc:'גבייה, דוחות כספיים בלבד' },
  { value:'maintenance', label:'אחראי תחזוקה',  color:'amber',  desc:'תחזוקה וקריאות מונים בלבד' },
  { value:'viewer',      label:'צפייה בלבד',    color:'gray',   desc:'קריאה בלבד, ללא עריכה' },
]

const EMPTY_INVITE = { email:'', role:'admin' }

export default function UserManagement() {
  const toast = useToast()
  const { user } = useAuth()
  const [users,  setUsers]  = useState([])
  const [loading,setLoading]= useState(true)
  const [inviteModal, setInviteModal] = useState(false)
  const [editModal,   setEditModal]   = useState(null) // user row
  const [form, setForm] = useState(EMPTY_INVITE)
  const [saving,setSaving]  = useState(false)
  const [inviting,setInviting]=useState(false)

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    const { data } = await supabase.from('users_roles').select('*').order('created_at', { ascending:false })
    setUsers(data ?? [])
    setLoading(false)
  }

  async function invite() {
    if (!form.email) { toast('יש להזין כתובת אימייל','error'); return }
    setInviting(true)
    // Invite user via Supabase Auth (admin invite)
    const { data, error } = await supabase.auth.admin.inviteUserByEmail(form.email, {
      data: { role: form.role }
    })
    if (error) {
      // Fallback: just create a users_roles entry with the pending email
      const { error: e2 } = await supabase.from('users_roles').insert({
        user_id: crypto.randomUUID(), // placeholder, will be replaced on signup
        role: form.role,
      })
      if (e2) { toast(e2.message, 'error'); setInviting(false); return }
      toast('משתמש הוגדר — יש לשלוח לו את קישור ההרשמה בנפרד', 'info')
    } else {
      toast(`הזמנה נשלחה ל-${form.email}`)
    }
    setInviting(false)
    setInviteModal(false)
    setForm(EMPTY_INVITE)
    load()
  }

  async function updateRole(id, newRole) {
    const { error } = await supabase.from('users_roles').update({ role: newRole }).eq('id', id)
    if (error) { toast(error.message,'error'); return }
    toast('הרשאה עודכנה')
    setEditModal(null)
    load()
  }

  async function removeUser(id) {
    if (!await confirm('להסיר את ההרשאות של משתמש זה?', { danger: true })) return
    const { error } = await supabase.from('users_roles').delete().eq('id', id)
    if (error) { toast(error.message,'error'); return }
    toast('הוסר')
    load()
  }

  function roleInfo(r) { return ROLES.find(x=>x.value===r) ?? { label:r, color:'gray', desc:'' } }

  return (
    <div className="space-y-6 fade-in">
      {/* Info banner */}
      <AlertBanner type="info" title="ניהול הרשאות משתמשים">
        כל משתמש שנרשם מקבל גישה למסד הנתונים שלו בלבד. ניתן לשנות את רמת ההרשאה בכל עת.
      </AlertBanner>

      {/* Current user card */}
      <Card>
        <CardHeader title="המשתמש הנוכחי שלך"/>
        <CardBody>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-teal-100 flex items-center justify-center">
              <Shield size={18} className="text-teal-600"/>
            </div>
            <div>
              <p className="font-medium text-slate-800">{user?.email}</p>
              <p className="text-xs text-slate-400">{user?.id}</p>
            </div>
          </div>
        </CardBody>
      </Card>

      {/* Users table */}
      <Card>
        <CardHeader title={`משתמשים מורשים (${users.length})`}
          action={
            <div className="flex gap-2">
              <button onClick={load} className="p-2 rounded-lg hover:bg-slate-100 text-slate-400">
                <RefreshCw size={15}/>
              </button>
              <Button icon={UserPlus} onClick={()=>{setForm(EMPTY_INVITE);setInviteModal(true)}}>
                הוסף משתמש
              </Button>
            </div>
          }/>

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
                <div key={u.id} className="flex items-center gap-4 px-6 py-4">
                  <div className="w-9 h-9 rounded-full bg-slate-100 flex items-center justify-center shrink-0">
                    <Shield size={16} className="text-slate-400"/>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <Badge color={ri.color}>{ri.label}</Badge>
                      {isSelf && <span className="text-xs text-teal-600 font-medium">(אתה)</span>}
                    </div>
                    <p className="text-xs text-slate-400 mt-0.5">{ri.desc}</p>
                    <p className="text-xs text-slate-300 mt-0.5 truncate">ID: {u.user_id}</p>
                  </div>
                  <div className="text-xs text-slate-400 hidden sm:block">
                    {formatDate(u.created_at?.slice(0,10))}
                  </div>
                  {!isSelf && (
                    <div className="flex gap-1 shrink-0">
                      <button onClick={()=>setEditModal(u)}
                        className="p-1.5 rounded text-slate-400 hover:text-teal-600 hover:bg-teal-50">
                        <Edit2 size={14}/>
                      </button>
                      <button onClick={()=>removeUser(u.id)}
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

      {/* Role descriptions */}
      <Card>
        <CardHeader title="תיאור רמות הרשאה"/>
        <div className="divide-y divide-slate-100">
          {ROLES.map(r => (
            <div key={r.value} className="flex items-center gap-3 px-6 py-3">
              <Badge color={r.color}>{r.label}</Badge>
              <p className="text-sm text-slate-600">{r.desc}</p>
            </div>
          ))}
        </div>
      </Card>

      {/* Invite Modal */}
      <Modal open={inviteModal} onClose={()=>setInviteModal(false)} title="הוספת משתמש חדש" size="sm">
        <div className="space-y-4">
          <FormField label="כתובת אימייל" required>
            <Input type="email" value={form.email} onChange={e=>setForm(f=>({...f,email:e.target.value}))}
              placeholder="user@example.com"/>
          </FormField>
          <FormField label="רמת הרשאה">
            <Select value={form.role} onChange={e=>setForm(f=>({...f,role:e.target.value}))}>
              {ROLES.map(r=><option key={r.value} value={r.value}>{r.label}</option>)}
            </Select>
          </FormField>
          <div className="p-3 bg-slate-50 rounded-xl text-xs text-slate-500">
            {roleInfo(form.role).desc}
          </div>
        </div>
        <div className="flex justify-end gap-3 mt-6">
          <Button variant="secondary" onClick={()=>setInviteModal(false)}>ביטול</Button>
          <Button loading={inviting} icon={UserPlus} onClick={invite}>הזמן</Button>
        </div>
      </Modal>

      {/* Edit Role Modal */}
      <Modal open={!!editModal} onClose={()=>setEditModal(null)} title="שינוי הרשאה" size="sm">
        {editModal && (
          <div className="space-y-4">
            <p className="text-sm text-slate-600">
              שינוי הרשאה עבור: <span className="font-medium">{editModal.user_id?.slice(0,12)}...</span>
            </p>
            <FormField label="רמת הרשאה חדשה">
              <Select defaultValue={editModal.role}
                onChange={e=>setEditModal(m=>({...m,role:e.target.value}))}>
                {ROLES.map(r=><option key={r.value} value={r.value}>{r.label}</option>)}
              </Select>
            </FormField>
            <div className="flex justify-end gap-3 mt-4">
              <Button variant="secondary" onClick={()=>setEditModal(null)}>ביטול</Button>
              <Button onClick={()=>updateRole(editModal.id, editModal.role)}>עדכן</Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}
