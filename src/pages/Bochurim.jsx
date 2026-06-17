import React, { useEffect, useState, useCallback } from 'react'
import { useSearchParams } from 'react-router-dom'
import { UserPlus, Edit2, Trash2, Clock, Download, RefreshCw } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { formatDate, toInputDate, today, daysUntil, currency, logActivity } from '../lib/utils'
import { confirm } from '../lib/confirm'
import { Table } from '../components/ui/Table'
import SearchInput from '../components/ui/SearchInput'
import Modal from '../components/ui/Modal'
import Button from '../components/ui/Button'
import Badge from '../components/ui/Badge'
import { FormField, Input, Select, Textarea } from '../components/ui/FormField'
import { Tabs } from '../components/ui/Tabs'
import { ContactButtons, PhoneCell, EmailCell } from '../components/ui/ContactButtons'
import DualDateField from '../components/ui/DualDateField'
import FileUpload from '../components/ui/FileUpload'
import AlertBanner from '../components/ui/AlertBanner'
import { useToast } from '../components/ui/Toast'

function exportCSV(data, filename) {
  if (!data.length) return
  const headers = Object.keys(data[0]).join(',')
  const rows = data.map(r => Object.values(r).map(v=>`"${v??''}"`).join(',')).join('\n')
  const blob = new Blob(['﻿' + headers + '\n' + rows], { type:'text/csv;charset=utf-8;' })
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob)
  a.download = filename; a.click()
}

const EMPTY = {
  shem:'', mishpacha:'', mispar_darkon:'', mekorot:'', taarich_lida:'',
  status:'פעיל', telefon:'', email:'', ktovet:'', ir_megurim:'',
  shem_horim:'', telefon_av:'', telefon_em:'',
  kvutza_yeshiva:'', status_viza:'', tokef_viza:'',
  ish_ksheret_shem:'', ish_ksheret_telefon:'',
  amla_chodshit:'', drive_link:'', heara:'',
}

const STATUS_COLORS = { פעיל:'green', 'לא_פעיל':'gray', בהמתנה:'yellow', הוסר:'red' }
const VISA_STATUS_COLORS = { בתוקף:'green', פג:'red', 'בקרוב':'yellow' }

const TABS = [
  { key:'personal',  label:'פרטים אישיים' },
  { key:'contact',   label:'קשר ומשפחה' },
  { key:'visa',      label:'ויזה ומוסד' },
  { key:'financial', label:'כספים וחירום' },
  { key:'docs',      label:'מסמכים' },
  { key:'history',   label:'היסטוריה' },
]

export default function Bochurim() {
  const toast = useToast()
  const [searchParams] = useSearchParams()
  const [rows, setRows]         = useState([])
  const [loading, setLoading]   = useState(true)
  const [search, setSearch]     = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [alertFilter, setAlertFilter] = useState(searchParams.get('alert') ?? '')
  const [unassignedFilter, setUnassignedFilter] = useState(searchParams.get('unassigned') === 'true')
  const [assignedFilter, setAssignedFilter] = useState(false)
  const [assignedIds, setAssignedIds] = useState(new Set())
  const [modal, setModal]       = useState(false)
  const [form, setForm]         = useState(EMPTY)
  const [activeTab, setActiveTab] = useState('personal')
  const [saving, setSaving]     = useState(false)
  const [history, setHistory]   = useState([])
  const [alerts, setAlerts]     = useState([])

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true)
    let q = supabase.from('bochurim').select('*').order('shem')
    if (statusFilter) q = q.eq('status', statusFilter)
    else q = q.neq('status', 'הוסר')
    const [{ data }, { data: activeShib }] = await Promise.all([
      q,
      supabase.from('shibutzim').select('bochurim_id').eq('status', 'פעיל'),
    ])
    const rows = data ?? []
    setRows(rows)
    setAssignedIds(new Set((activeShib??[]).map(s => s.bochurim_id)))
    // התראות ויזה
    const now = new Date()
    const warn = rows.filter(r => {
      if (!r.tokef_viza) return false
      const d = daysUntil(r.tokef_viza)
      return d !== null && d <= 60 && d >= 0
    })
    setAlerts(warn)
    setLoading(false)
  }, [statusFilter])

  useEffect(() => { load() }, [load])

  async function loadHistory(bocherid) {
    const { data } = await supabase
      .from('shibutzim')
      .select('*, dirot!dirot_id(ktovet,ir)')
      .eq('bochurim_id', bocherid)
      .order('taarich_tchila', { ascending: false })
    setHistory(data ?? [])
  }

  const filtered = rows.filter(r => {
    const textMatch = `${r.shem??''} ${r.mishpacha??''} ${r.telefon??''} ${r.email??''} ${r.ir_megurim??''} ${r.mekorot??''} ${r.kvutza_yeshiva??''}`
      .toLowerCase().includes(search.toLowerCase())
    const alertMatch = alertFilter !== 'visa' || (daysUntil(r.tokef_viza) !== null && (daysUntil(r.tokef_viza) ?? 999) <= 30)
    const unassignedMatch = !unassignedFilter || !assignedIds.has(r.id)
    const assignedMatch   = !assignedFilter  ||  assignedIds.has(r.id)
    return textMatch && alertMatch && unassignedMatch && assignedMatch
  })

  function openNew()  { setForm(EMPTY); setActiveTab('personal'); setHistory([]); setModal(true) }
  function openEdit(r){
    setForm({ ...EMPTY, ...r, taarich_lida: toInputDate(r.taarich_lida), tokef_viza: toInputDate(r.tokef_viza) })
    setActiveTab('personal')
    if (r.id) loadHistory(r.id)
    setModal(true)
  }

  function set(field) { return e => setForm(f => ({ ...f, [field]: e.target.value })) }

  async function save() {
    if (!form.shem) { toast('שם חובה', 'error'); return }
    setSaving(true)
    const n = v => (v === '' || v === null || v === undefined) ? null : Number(v)
    const payload = { ...form }
    // dates — null if empty
    if (!payload.taarich_lida) payload.taarich_lida = null
    if (!payload.tokef_viza)   payload.tokef_viza   = null
    // numerics
    payload.amla_chodshit = n(payload.amla_chodshit)
    delete payload.id; delete payload.created_at; delete payload.user_id

    const isNew = !form.id
    const { data, error } = isNew
      ? await supabase.from('bochurim').insert(payload).select().single()
      : await supabase.from('bochurim').update(payload).eq('id', form.id).select().single()
    setSaving(false)
    if (error) { toast(error.message, 'error'); return }
    logActivity(isNew ? 'INSERT' : 'UPDATE', 'bochurim', data.id, `${form.shem} ${form.mishpacha}`)
    toast(isNew ? 'בחור נוסף בהצלחה' : 'עודכן בהצלחה')
    if (isNew) setForm(f => ({ ...f, id: data.id }))
    load(true)
  }

  async function remove(id, name) {
    if (!await confirm(`למחוק את ${name}?`, { danger: true })) return

    const deleteAll = await confirm(
      `האם למחוק גם את כל התנועות של ${name}?\n(גבייה, שיבוצים וכו׳)\n\n"שמור תנועות" יסיר אותו מהרשימה אבל ישאיר את הנתונים הכספיים.`,
      { danger: true, confirmText: 'מחק הכל', cancelText: 'שמור תנועות' }
    )

    if (deleteAll) {
      await supabase.from('gviya').delete().eq('bochurim_id', id)
      await supabase.from('shibutzim').delete().eq('bochurim_id', id)
      await supabase.from('documents').delete().eq('bochurim_id', id)
      await supabase.from('bochurim').delete().eq('id', id)
      logActivity('DELETE', 'bochurim', id, name)
      toast(`${name} נמחק לחלוטין`)
    } else {
      await supabase.from('bochurim').update({ status: 'הוסר' }).eq('id', id)
      logActivity('ARCHIVE', 'bochurim', id, name)
      toast(`${name} הוסר מהרשימה — התנועות נשמרו`)
    }
    load(true)
  }

  // Visa status helper
  function visaStatus(tokef_viza) {
    if (!tokef_viza) return null
    const d = daysUntil(tokef_viza)
    if (d < 0)  return { label: 'פג', color: 'red' }
    if (d <= 60) return { label: `${d} ימים`, color: 'yellow' }
    return { label: 'בתוקף', color: 'green' }
  }

  const columns = [
    { key:'shem',       label:'שם פרטי' },
    { key:'mishpacha',  label:'משפחה' },
    { key:'mekorot',    label:'מוצא' },
    { key:'telefon',    label:'טלפון', render:(v,r) => <PhoneCell phone={v} /> },
    { key:'email',      label:'אימייל', render:(v) => <EmailCell email={v} /> },
    { key:'kvutza_yeshiva', label:'מוסד' },
    { key:'tokef_viza', label:'ויזה', render:(v) => {
      const s = visaStatus(v)
      if (!s) return '—'
      return <Badge color={s.color}>{s.label}</Badge>
    }},
    { key:'amla_chodshit', label:'עמלה', render:v => currency(v) },
    { key:'status',     label:'סטטוס', render:v => <Badge color={STATUS_COLORS[v]??'gray'}>{v??'—'}</Badge> },
    { key:'actions',    label:'', width:80, render:(_,row) => (
      <div className="flex gap-1">
        <button onClick={e=>{e.stopPropagation();openEdit(row)}} className="p-1.5 rounded text-slate-400 hover:text-teal-600 hover:bg-teal-50"><Edit2 size={14}/></button>
        <button onClick={e=>{e.stopPropagation();remove(row.id,`${row.shem} ${row.mishpacha}`)}} className="p-1.5 rounded text-slate-400 hover:text-red-600 hover:bg-red-50"><Trash2 size={14}/></button>
      </div>
    )},
  ]

  return (
    <div className="space-y-4 fade-in">
      {/* Visa alerts */}
      {alerts.length > 0 && (
        <AlertBanner type="warning" title={`${alerts.length} ויזות עומדות לפוג בתוך 60 יום`}>
          <ul className="mt-1 space-y-0.5">
            {alerts.map(r => (
              <li key={r.id} className="flex items-center gap-2 cursor-pointer hover:underline" onClick={() => openEdit(r)}>
                <Clock size={12}/>
                <span>{r.shem} {r.mishpacha} — {formatDate(r.tokef_viza)} ({daysUntil(r.tokef_viza)} ימים)</span>
              </li>
            ))}
          </ul>
        </AlertBanner>
      )}

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex-1 min-w-48"><SearchInput value={search} onChange={setSearch} placeholder="שם, טלפון, מוצא, מוסד..." /></div>
        <select value={statusFilter} onChange={e=>setStatusFilter(e.target.value)}
          className="px-3 py-2 text-sm rounded-lg border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-teal-400">
          <option value="">כל הסטטוסים</option>
          <option value="פעיל">פעיל</option>
          <option value="לא_פעיל">לא פעיל</option>
          <option value="בהמתנה">בהמתנה</option>
          <option value="הוסר">הוסר (שמור תנועות)</option>
        </select>
        <button
          onClick={() => { setAssignedFilter(false); setUnassignedFilter(f => !f) }}
          className={`h-9 px-3 text-sm rounded-lg border transition-colors ${unassignedFilter ? 'bg-orange-500 text-white border-orange-500' : 'bg-white text-slate-600 border-slate-200 hover:border-orange-300'}`}>
          ללא שיבוץ
        </button>
        <button
          onClick={() => { setUnassignedFilter(false); setAssignedFilter(f => !f) }}
          className={`h-9 px-3 text-sm rounded-lg border transition-colors ${assignedFilter ? 'bg-teal-600 text-white border-teal-600' : 'bg-white text-slate-600 border-slate-200 hover:border-teal-300'}`}>
          משובץ
        </button>
        {(search || statusFilter || alertFilter || unassignedFilter || assignedFilter) && (
          <button
            onClick={() => { setSearch(''); setStatusFilter(''); setAlertFilter(''); setUnassignedFilter(false); setAssignedFilter(false) }}
            className="h-9 px-3 text-sm rounded-lg border border-slate-200 bg-white text-red-500 hover:border-red-300 hover:bg-red-50">
            ✕ נקה סינון
          </button>
        )}
        <button onClick={load} className="h-9 w-9 rounded-lg border border-slate-200 bg-white text-slate-500 hover:text-teal-600 hover:border-teal-300 flex items-center justify-center" title="רענן">
          <RefreshCw size={16} className={loading ? 'animate-spin' : ''}/>
        </button>
        <Button variant="secondary" icon={Download}
          onClick={()=>exportCSV(filtered.map(r=>({
            שם:r.shem, משפחה:r.mishpacha, טלפון:r.telefon, אימייל:r.email,
            מוצא:r.mekorot, מוסד:r.kvutza_yeshiva, סטטוס:r.status, ויזה:formatDate(r.tokef_viza)
          })),'bochurim.csv')}>
          ייצוא
        </Button>
        <Button icon={UserPlus} onClick={openNew}>בחור חדש</Button>
      </div>
      <div className="flex flex-wrap gap-2">
        {alertFilter==='visa' && (
          <div className="flex items-center gap-2">
            <span className="text-xs bg-amber-100 text-amber-700 px-2 py-1 rounded-full">מסנן: ויזות קרובות לפקיעה</span>
            <button onClick={()=>setAlertFilter('')} className="text-xs text-slate-400 hover:text-red-500">✕ נקה</button>
          </div>
        )}
      </div>

      <p className="text-sm text-slate-400">{filtered.length} בחורים</p>

      <Table columns={columns} data={filtered} loading={loading} emptyText="לא נמצאו בחורים" onRowClick={openEdit} />

      {/* Modal */}
      <Modal open={modal} onClose={()=>setModal(false)} title={form.id ? `${form.shem} ${form.mishpacha}` : 'בחור חדש'} size="xl">
        <Tabs tabs={TABS} active={activeTab} onChange={tab=>{setActiveTab(tab)}} />
        {/* fixed min-height so modal doesn't jump between tabs */}

        <div style={{ height: '460px', overflowY: 'auto' }} className="pt-1 pl-1 pr-1">
        {/* ── Tab: פרטים אישיים ── */}
        {activeTab==='personal' && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <FormField label="שם פרטי" required><Input value={form.shem??''} onChange={set('shem')} placeholder="ישראל"/></FormField>
            <FormField label="שם משפחה"><Input value={form.mishpacha??''} onChange={set('mishpacha')} placeholder="ישראלי"/></FormField>
            <FormField label="מספר דרכון"><Input value={form.mispar_darkon??''} onChange={set('mispar_darkon')} placeholder="AB123456"/></FormField>
            <FormField label="מוצא / ארץ מוצא"><Input value={form.mekorot??''} onChange={set('mekorot')} placeholder="ארה״ב"/></FormField>
            <FormField label="תאריך לידה">
              <DualDateField value={form.taarich_lida??''} onChange={v=>setForm(f=>({...f,taarich_lida:v}))}/>
            </FormField>
            <FormField label="עיר מגורים"><Input value={form.ir_megurim??''} onChange={set('ir_megurim')} placeholder="ירושלים"/></FormField>
            <FormField label="כתובת"><Input value={form.ktovet??''} onChange={set('ktovet')} placeholder="רחוב הרצל 1"/></FormField>
            <FormField label="סטטוס">
              <Select value={form.status??'פעיל'} onChange={set('status')}>
                <option value="פעיל">פעיל</option>
                <option value="לא_פעיל">לא פעיל</option>
                <option value="בהמתנה">בהמתנה</option>
              </Select>
            </FormField>
            <div className="sm:col-span-2">
              <FormField label="הערות"><Textarea value={form.heara??''} onChange={set('heara')} placeholder="הערות נוספות..."/></FormField>
            </div>
          </div>
        )}

        {/* ── Tab: קשר ומשפחה ── */}
        {activeTab==='contact' && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <FormField label="טלפון">
                <div className="flex items-center gap-2">
                  <Input value={form.telefon??''} onChange={set('telefon')} placeholder="050-0000000"/>
                  <ContactButtons phone={form.telefon} email={form.email}/>
                </div>
              </FormField>
              <FormField label="אימייל">
                <div className="flex items-center gap-2">
                  <Input type="email" value={form.email??''} onChange={set('email')} placeholder="israel@example.com"/>
                  {form.email && <ContactButtons email={form.email}/>}
                </div>
              </FormField>
            </div>

            <hr className="border-slate-100"/>
            <p className="text-sm font-semibold text-slate-600">הורים</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <FormField label="שם הורים"><Input value={form.shem_horim??''} onChange={set('shem_horim')} placeholder="אברהם ושרה ישראלי"/></FormField>
              <div/>
              <FormField label="טלפון אב">
                <div className="flex items-center gap-2">
                  <Input value={form.telefon_av??''} onChange={set('telefon_av')} placeholder="050-1111111"/>
                  <ContactButtons phone={form.telefon_av}/>
                </div>
              </FormField>
              <FormField label="טלפון אם">
                <div className="flex items-center gap-2">
                  <Input value={form.telefon_em??''} onChange={set('telefon_em')} placeholder="050-2222222"/>
                  <ContactButtons phone={form.telefon_em}/>
                </div>
              </FormField>
            </div>
          </div>
        )}

        {/* ── Tab: ויזה ומוסד ── */}
        {activeTab==='visa' && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <FormField label="קבוצה / ישיבה / מוסד"><Input value={form.kvutza_yeshiva??''} onChange={set('kvutza_yeshiva')} placeholder="ישיבת..."/></FormField>
              <div/>
              <FormField label="סטטוס ויזה">
                <Select value={form.status_viza??''} onChange={set('status_viza')}>
                  <option value="">-- בחר --</option>
                  <option value="תייר">תייר</option>
                  <option value="סטודנט">סטודנט</option>
                  <option value="עולה">עולה</option>
                  <option value="אחר">אחר</option>
                </Select>
              </FormField>
              <FormField label="תוקף ויזה">
                <DualDateField value={form.tokef_viza??''} onChange={v=>setForm(f=>({...f,tokef_viza:v}))}/>
                {form.tokef_viza && (() => {
                  const d = daysUntil(form.tokef_viza)
                  if (d !== null && d <= 60) return (
                    <p className={`text-xs mt-1 font-medium ${d<0?'text-red-600':'text-amber-600'}`}>
                      {d<0 ? `פגה לפני ${Math.abs(d)} ימים!` : `פוגה בעוד ${d} ימים`}
                    </p>
                  )
                })()}
              </FormField>
              <FormField label="קישור Google Drive">
                <Input value={form.drive_link??''} onChange={set('drive_link')} placeholder="https://drive.google.com/..."/>
              </FormField>
            </div>
          </div>
        )}

        {/* ── Tab: כספי וחירום ── */}
        {activeTab==='financial' && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <FormField label="עמלה חודשית (₪)">
              <Input type="number" min="0" value={form.amla_chodshit??''} onChange={set('amla_chodshit')} placeholder="0"/>
            </FormField>
            <div/>
            <hr className="sm:col-span-2 border-slate-100"/>
            <p className="sm:col-span-2 text-sm font-semibold text-slate-600">איש קשר לחירום</p>
            <FormField label="שם איש קשר"><Input value={form.ish_ksheret_shem??''} onChange={set('ish_ksheret_shem')} placeholder="שם מלא"/></FormField>
            <FormField label="טלפון חירום">
              <div className="flex items-center gap-2">
                <Input value={form.ish_ksheret_telefon??''} onChange={set('ish_ksheret_telefon')} placeholder="050-9999999"/>
                <ContactButtons phone={form.ish_ksheret_telefon}/>
              </div>
            </FormField>
          </div>
        )}

        {/* ── Tab: מסמכים ── */}
        {activeTab==='docs' && (
          <FileUpload entityType="bochurim" entityId={form.id} bucket="bochurim-docs"/>
        )}

        {/* ── Tab: היסטוריה ── */}
        {activeTab==='history' && (
          <div>
            <p className="text-sm font-semibold text-slate-700 mb-3">היסטוריית שיבוצים</p>
            {history.length === 0
              ? <p className="text-sm text-slate-400">אין שיבוצים קודמים</p>
              : (
                <table className="w-full text-sm">
                  <thead><tr className="text-right text-slate-500 border-b">
                    <th className="pb-2 font-medium">דירה</th>
                    <th className="pb-2 font-medium">תחילה</th>
                    <th className="pb-2 font-medium">סיום</th>
                    <th className="pb-2 font-medium">סטטוס</th>
                  </tr></thead>
                  <tbody>
                    {history.map((s,i) => (
                      <tr key={s.id??i} className="border-b border-slate-100">
                        <td className="py-2">{s.dirot?.ktovet??'—'}{s.dirot?.ir?`, ${s.dirot.ir}`:''}</td>
                        <td className="py-2">{formatDate(s.taarich_tchila)}</td>
                        <td className="py-2">{formatDate(s.taarich_siyum)}</td>
                        <td className="py-2"><Badge color={s.status==='פעיל'?'green':s.status==='הסתיים'?'gray':'yellow'}>{s.status}</Badge></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )
            }
          </div>
        )}

        </div>{/* end min-height wrapper */}

        <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-slate-100">
          <Button variant="secondary" onClick={()=>setModal(false)}>ביטול</Button>
          <Button loading={saving} onClick={save}>שמור</Button>
        </div>
      </Modal>
    </div>
  )
}
