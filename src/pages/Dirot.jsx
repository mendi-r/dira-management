import React, { useEffect, useState, useCallback } from 'react'
import { useSearchParams } from 'react-router-dom'
import { PlusCircle, Edit2, Trash2, MapPin, ExternalLink, Download } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { formatDate, toInputDate, calcLeaseEnd, daysUntil, currency, logActivity } from '../lib/utils'
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
  ktovet:'', ir:'', mishkan:'', mazkir:'', mispar_chadarim:'',
  mispar_mitot:'', mispar_sherutim:'', mispar_miklachot:'',
  perut_riut:'', sheon_mayim_num:'', sheon_chashmal_num:'', sheon_gaz_num:'',
  arnona:'', status:'פעיל', heara:'',
  baalim_shem:'', baalim_telefon1:'', baalim_telefon2:'', baalim_email:'',
  baalim_ktovet_rechov:'', baalim_ktovet_ir:'',
  ola_schirut_chodshi:'', tchilat_schirut:'', mispar_chodashim:'', sofit_schirut:'',
  payment_method:'', payment_day:'', payment_source:'', payment_bank_details:'',
  bituach_chevra:'', bituach_polisa:'', bituach_chadush:'',
  google_maps_link:'', drive_link:'',
}

const STATUS_COLORS = { פעיל:'green', ריק:'yellow', 'לא_זמין':'red' }

const TABS = [
  { key:'dira',    label:'פרטי דירה' },
  { key:'baalim',  label:'בעלים' },
  { key:'chozeh',  label:'חוזה ותשלום' },
  { key:'bituach', label:'ביטוח' },
  { key:'docs',    label:'מסמכים' },
  { key:'history', label:'היסטוריה' },
]

export default function Dirot() {
  const toast = useToast()
  const [searchParams] = useSearchParams()
  const [rows, setRows]         = useState([])
  const [loading, setLoading]   = useState(true)
  const [search, setSearch]     = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [alertFilter, setAlertFilter] = useState(searchParams.get('alert') ?? '')
  const [modal, setModal]       = useState(false)
  const [form, setForm]         = useState(EMPTY)
  const [activeTab, setActiveTab] = useState('dira')
  const [saving, setSaving]     = useState(false)
  const [history, setHistory]   = useState([])
  const [alerts, setAlerts]     = useState([])

  const load = useCallback(async () => {
    setLoading(true)
    let q = supabase.from('dirot').select('*').order('ktovet')
    if (statusFilter) q = q.eq('status', statusFilter)
    const { data } = await q
    const rows = data ?? []
    setRows(rows)
    // contract + insurance alerts
    const now = new Date()
    const warn = rows.filter(r => {
      const dc = r.sofit_schirut ? daysUntil(r.sofit_schirut) : null
      const db = r.bituach_chadush ? daysUntil(r.bituach_chadush) : null
      return (dc !== null && dc <= 30 && dc >= 0) || (db !== null && db <= 30 && db >= 0)
    })
    setAlerts(warn)
    setLoading(false)
  }, [statusFilter])

  useEffect(() => { load() }, [load])

  async function loadHistory(dirotId) {
    const { data } = await supabase
      .from('shibutzim')
      .select('*, bochurim(shem,mishpacha)')
      .eq('dirot_id', dirotId)
      .order('taarich_tchila', { ascending: false })
    setHistory(data ?? [])
  }

  const filtered = rows.filter(r => {
    const textMatch = `${r.ktovet??''} ${r.ir??''} ${r.mishkan??''} ${r.mazkir??''} ${r.baalim_shem??''}`
      .toLowerCase().includes(search.toLowerCase())
    const alertMatch = !alertFilter ||
      (alertFilter === 'contract' && daysUntil(r.sofit_schirut) !== null && (daysUntil(r.sofit_schirut)??999) <= 30) ||
      (alertFilter === 'insurance' && daysUntil(r.bituach_chadush) !== null && (daysUntil(r.bituach_chadush)??999) <= 30)
    return textMatch && alertMatch
  })

  function openNew()  { setForm(EMPTY); setActiveTab('dira'); setHistory([]); setModal(true) }
  function openEdit(r){
    setForm({
      ...EMPTY, ...r,
      tchilat_schirut: toInputDate(r.tchilat_schirut),
      sofit_schirut:   toInputDate(r.sofit_schirut),
      bituach_chadush: toInputDate(r.bituach_chadush),
    })
    setActiveTab('dira')
    if (r.id) loadHistory(r.id)
    setModal(true)
  }

  function set(field) { return e => {
    const val = e.target.value
    setForm(f => {
      const next = { ...f, [field]: val }
      // auto-compute lease end
      if (field==='tchilat_schirut' || field==='mispar_chodashim') {
        const end = calcLeaseEnd(
          field==='tchilat_schirut' ? val : f.tchilat_schirut,
          field==='mispar_chodashim' ? val : f.mispar_chodashim
        )
        next.sofit_schirut = end ?? ''
      }
      return next
    })
  }}

  async function save() {
    if (!form.ktovet) { toast('כתובת חובה', 'error'); return }
    setSaving(true)
    const n = v => (v === '' || v === null || v === undefined) ? null : Number(v)
    const payload = { ...form }
    // dates — null if empty
    if (!payload.tchilat_schirut) payload.tchilat_schirut = null
    if (!payload.sofit_schirut)   payload.sofit_schirut   = null
    if (!payload.bituach_chadush) payload.bituach_chadush = null
    // numerics — empty string → null (never send "" to a numeric column)
    payload.ola_schirut_chodshi = n(payload.ola_schirut_chodshi)
    payload.arnona              = n(payload.arnona)
    payload.mispar_chadarim     = n(payload.mispar_chadarim)
    payload.mispar_mitot        = n(payload.mispar_mitot)
    payload.mispar_sherutim     = n(payload.mispar_sherutim)
    payload.mispar_miklachot    = n(payload.mispar_miklachot)
    payload.payment_day         = n(payload.payment_day)
    payload.mispar_chodashim    = n(payload.mispar_chodashim)
    delete payload.id; delete payload.created_at; delete payload.user_id

    const isNew = !form.id
    const { data, error } = isNew
      ? await supabase.from('dirot').insert(payload).select().single()
      : await supabase.from('dirot').update(payload).eq('id', form.id).select().single()
    setSaving(false)
    if (error) { toast(error.message, 'error'); return }
    logActivity(isNew ? 'INSERT' : 'UPDATE', 'dirot', data.id, form.ktovet)
    toast(isNew ? 'דירה נוספה' : 'עודכן')
    if (isNew) setForm(f => ({ ...f, id: data.id }))
    load()
  }

  async function remove(id, addr) {
    if (!confirm(`למחוק את הדירה ${addr}?`)) return
    await supabase.from('dirot').delete().eq('id', id)
    logActivity('DELETE', 'dirot', id, addr)
    toast('נמחק')
    load()
  }

  const columns = [
    { key:'ktovet',      label:'כתובת', render:(v,r)=>(
      <div className="flex items-center gap-1.5">
        <MapPin size={13} className="text-slate-400 flex-shrink-0"/>
        <span className="font-medium">{v}</span>
        {r.google_maps_link && <a href={r.google_maps_link} target="_blank" rel="noopener noreferrer" onClick={e=>e.stopPropagation()} className="text-teal-500 hover:text-teal-700"><ExternalLink size={12}/></a>}
      </div>
    )},
    { key:'ir',          label:'עיר' },
    { key:'baalim_shem', label:'בעלים' },
    { key:'baalim_telefon1', label:'טלפון בעלים', render:v=><PhoneCell phone={v}/> },
    { key:'mispar_mitot', label:'מיטות' },
    { key:'ola_schirut_chodshi', label:'שכירות', render:v=>currency(v) },
    { key:'sofit_schirut', label:'סיום חוזה', render:v=>{
      if (!v) return '—'
      const d = daysUntil(v)
      return <span className={d!==null&&d<=30&&d>=0?'text-amber-600 font-semibold':''}>{formatDate(v)}</span>
    }},
    { key:'status',      label:'סטטוס', render:v=><Badge color={STATUS_COLORS[v]??'gray'}>{v??'—'}</Badge> },
    { key:'actions',     label:'', width:80, render:(_,row)=>(
      <div className="flex gap-1">
        <button onClick={e=>{e.stopPropagation();openEdit(row)}} className="p-1.5 rounded text-slate-400 hover:text-teal-600 hover:bg-teal-50"><Edit2 size={14}/></button>
        <button onClick={e=>{e.stopPropagation();remove(row.id,row.ktovet)}} className="p-1.5 rounded text-slate-400 hover:text-red-600 hover:bg-red-50"><Trash2 size={14}/></button>
      </div>
    )},
  ]

  return (
    <div className="space-y-4 fade-in">
      {alerts.length > 0 && (
        <AlertBanner type="warning" title={`${alerts.length} חוזים/ביטוחים מסתיימים בקרוב`}>
          <ul className="mt-1 space-y-0.5">
            {alerts.map(r=>(
              <li key={r.id} className="text-xs cursor-pointer hover:underline" onClick={()=>openEdit(r)}>
                {r.ktovet} — חוזה: {formatDate(r.sofit_schirut)} | ביטוח: {formatDate(r.bituach_chadush)}
              </li>
            ))}
          </ul>
        </AlertBanner>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <div className="flex-1 min-w-48"><SearchInput value={search} onChange={setSearch} placeholder="כתובת, עיר, בעלים..."/></div>
        <select value={statusFilter} onChange={e=>setStatusFilter(e.target.value)}
          className="px-3 py-2 text-sm rounded-lg border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-teal-400">
          <option value="">כל הסטטוסים</option>
          <option value="פעיל">פעיל</option>
          <option value="ריק">ריק</option>
          <option value="לא_זמין">לא זמין</option>
        </select>
        <Button variant="secondary" icon={Download}
          onClick={()=>exportCSV(filtered.map(r=>({
            כתובת:r.ktovet, עיר:r.ir, בעלים:r.baalim_shem,
            שכירות:r.ola_schirut_chodshi, 'סיום חוזה':formatDate(r.sofit_schirut),
            סטטוס:r.status
          })),'dirot.csv')}>
          ייצוא
        </Button>
        <Button icon={PlusCircle} onClick={openNew}>דירה חדשה</Button>
      </div>
      {alertFilter && (
        <div className="flex items-center gap-2">
          <span className="text-xs bg-amber-100 text-amber-700 px-2 py-1 rounded-full">
            {alertFilter==='contract'?'מסנן: חוזים קרובים לסיום':'מסנן: ביטוחים לחידוש'}
          </span>
          <button onClick={()=>setAlertFilter('')} className="text-xs text-slate-400 hover:text-red-500">✕ נקה</button>
        </div>
      )}

      <p className="text-sm text-slate-400">{filtered.length} דירות</p>
      <Table columns={columns} data={filtered} loading={loading} emptyText="לא נמצאו דירות" onRowClick={openEdit}/>

      <Modal open={modal} onClose={()=>setModal(false)} title={form.id ? form.ktovet||'דירה' : 'דירה חדשה'} size="xl">
        <Tabs tabs={TABS} active={activeTab} onChange={setActiveTab}/>
        <div style={{ height: '460px', overflowY: 'auto' }} className="pt-1 pl-1 pr-1">

        {/* ── Tab: פרטי דירה ── */}
        {activeTab==='dira' && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <FormField label="כתובת" required><Input value={form.ktovet??''} onChange={set('ktovet')} placeholder="רחוב הרצל 1"/></FormField>
            <FormField label="עיר"><Input value={form.ir??''} onChange={set('ir')} placeholder="ירושלים"/></FormField>
            <FormField label="משכן"><Input value={form.mishkan??''} onChange={set('mishkan')}/></FormField>
            <FormField label="מזכיר"><Input value={form.mazkir??''} onChange={set('mazkir')}/></FormField>
            <FormField label="חדרים"><Input type="number" min="0" value={form.mispar_chadarim??''} onChange={set('mispar_chadarim')}/></FormField>
            <FormField label="מיטות"><Input type="number" min="0" value={form.mispar_mitot??''} onChange={set('mispar_mitot')}/></FormField>
            <FormField label="שירותים"><Input type="number" min="0" value={form.mispar_sherutim??''} onChange={set('mispar_sherutim')}/></FormField>
            <FormField label="מקלחות"><Input type="number" min="0" value={form.mispar_miklachot??''} onChange={set('mispar_miklachot')}/></FormField>
            <FormField label="מספר שעון מים"><Input value={form.sheon_mayim_num??''} onChange={set('sheon_mayim_num')}/></FormField>
            <FormField label="מספר שעון חשמל"><Input value={form.sheon_chashmal_num??''} onChange={set('sheon_chashmal_num')}/></FormField>
            <FormField label="מספר שעון גז"><Input value={form.sheon_gaz_num??''} onChange={set('sheon_gaz_num')}/></FormField>
            <FormField label="ארנונה (₪/חודש)"><Input type="number" min="0" value={form.arnona??''} onChange={set('arnona')}/></FormField>
            <FormField label="סטטוס">
              <Select value={form.status??'פעיל'} onChange={set('status')}>
                <option value="פעיל">פעיל</option>
                <option value="ריק">ריק</option>
                <option value="לא_זמין">לא זמין</option>
              </Select>
            </FormField>
            <FormField label="קישור Google Maps">
              <div className="flex items-center gap-2">
                <Input value={form.google_maps_link??''} onChange={set('google_maps_link')} placeholder="https://maps.google.com/..."/>
                {form.google_maps_link && <a href={form.google_maps_link} target="_blank" rel="noopener noreferrer" className="text-teal-500"><ExternalLink size={16}/></a>}
              </div>
            </FormField>
            <div className="sm:col-span-2">
              <FormField label="פירוט ריהוט"><Textarea value={form.perut_riut??''} onChange={set('perut_riut')} placeholder="מיטות, ספות, מקרר..." rows={2}/></FormField>
            </div>
            <div className="sm:col-span-2">
              <FormField label="הערות תחזוקה"><Textarea value={form.heara??''} onChange={set('heara')} rows={2}/></FormField>
            </div>
          </div>
        )}

        {/* ── Tab: בעלים ── */}
        {activeTab==='baalim' && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <FormField label="שם בעלים"><Input value={form.baalim_shem??''} onChange={set('baalim_shem')}/></FormField>
            <div/>
            <FormField label="טלפון בעלים 1">
              <div className="flex items-center gap-2">
                <Input value={form.baalim_telefon1??''} onChange={set('baalim_telefon1')} placeholder="050-..."/>
                <ContactButtons phone={form.baalim_telefon1} email={form.baalim_email}/>
              </div>
            </FormField>
            <FormField label="טלפון בעלים 2">
              <div className="flex items-center gap-2">
                <Input value={form.baalim_telefon2??''} onChange={set('baalim_telefon2')} placeholder="050-..."/>
                <ContactButtons phone={form.baalim_telefon2}/>
              </div>
            </FormField>
            <FormField label="אימייל בעלים">
              <div className="flex items-center gap-2">
                <Input type="email" value={form.baalim_email??''} onChange={set('baalim_email')}/>
                {form.baalim_email && <ContactButtons email={form.baalim_email}/>}
              </div>
            </FormField>
            <div/>
            <FormField label="כתובת בעלים — רחוב"><Input value={form.baalim_ktovet_rechov??''} onChange={set('baalim_ktovet_rechov')}/></FormField>
            <FormField label="כתובת בעלים — עיר"><Input value={form.baalim_ktovet_ir??''} onChange={set('baalim_ktovet_ir')}/></FormField>
          </div>
        )}

        {/* ── Tab: חוזה ותשלום ── */}
        {activeTab==='chozeh' && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <FormField label="עלות שכירות חודשית (₪)"><Input type="number" min="0" value={form.ola_schirut_chodshi??''} onChange={set('ola_schirut_chodshi')}/></FormField>
            <div/>
            <FormField label="תחילת שכירות">
              <DualDateField value={form.tchilat_schirut??''} onChange={v=>{ set('tchilat_schirut')({target:{value:v}}) }}/>
            </FormField>
            <FormField label="מספר חודשים"><Input type="number" min="1" value={form.mispar_chodashim??''} onChange={set('mispar_chodashim')} placeholder="12"/></FormField>
            <FormField label="סוף שכירות (מחושב)">
              <div className="px-3 py-2 bg-teal-50 rounded-lg text-teal-700 text-sm font-medium">
                {form.sofit_schirut ? formatDate(form.sofit_schirut) : '—'}
              </div>
            </FormField>
            <div/>
            <hr className="sm:col-span-2 border-slate-100"/>
            <p className="sm:col-span-2 text-sm font-semibold text-slate-600">תשלום לבעלים</p>
            <FormField label="אמצעי תשלום">
              <Select value={form.payment_method??''} onChange={set('payment_method')}>
                <option value="">-- בחר --</option>
                <option value="העברה בנקאית">העברה בנקאית</option>
                <option value="אשראי">אשראי</option>
                <option value="צ׳ק">צ׳ק</option>
                <option value="מזומן">מזומן</option>
              </Select>
            </FormField>
            <FormField label="יום חיוב בחודש"><Input type="number" min="1" max="31" value={form.payment_day??''} onChange={set('payment_day')} placeholder="1"/></FormField>
            <FormField label="מקור תשלום (בנק/אשראי)"><Input value={form.payment_source??''} onChange={set('payment_source')} placeholder="בנק לאומי / ויזה"/></FormField>
            <FormField label="פרטי חשבון"><Input value={form.payment_bank_details??''} onChange={set('payment_bank_details')} placeholder="סניף 123, חשבון 456789"/></FormField>
          </div>
        )}

        {/* ── Tab: ביטוח ── */}
        {activeTab==='bituach' && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <FormField label="חברת ביטוח"><Input value={form.bituach_chevra??''} onChange={set('bituach_chevra')} placeholder="מגדל, הראל..."/></FormField>
            <FormField label="מספר פוליסה"><Input value={form.bituach_polisa??''} onChange={set('bituach_polisa')}/></FormField>
            <FormField label="תאריך חידוש">
              <DualDateField value={form.bituach_chadush??''} onChange={v=>setForm(f=>({...f,bituach_chadush:v}))}/>
              {form.bituach_chadush && (() => {
                const d = daysUntil(form.bituach_chadush)
                if (d !== null && d <= 30 && d >= 0) return (
                  <p className="text-xs text-amber-600 mt-1 font-medium">חידוש בעוד {d} ימים</p>
                )
              })()}
            </FormField>
            <FormField label="קישור Google Drive ביטוח">
              <Input value={form.drive_link??''} onChange={set('drive_link')} placeholder="https://drive.google.com/..."/>
            </FormField>
          </div>
        )}

        {/* ── Tab: מסמכים ── */}
        {activeTab==='docs' && (
          <FileUpload entityType="dirot" entityId={form.id} bucket="dirot-docs"/>
        )}

        {/* ── Tab: היסטוריה ── */}
        {activeTab==='history' && (
          <div>
            <p className="text-sm font-semibold text-slate-700 mb-3">שיבוצים בדירה זו</p>
            {history.length === 0
              ? <p className="text-sm text-slate-400">אין שיבוצים</p>
              : (
                <table className="w-full text-sm">
                  <thead><tr className="text-right text-slate-500 border-b">
                    <th className="pb-2 font-medium">בחור</th>
                    <th className="pb-2 font-medium">תחילה</th>
                    <th className="pb-2 font-medium">סיום</th>
                    <th className="pb-2 font-medium">חלק</th>
                    <th className="pb-2 font-medium">סטטוס</th>
                  </tr></thead>
                  <tbody>
                    {history.map((s,i)=>(
                      <tr key={s.id??i} className="border-b border-slate-100">
                        <td className="py-2">{s.bochurim?.shem??''} {s.bochurim?.mishpacha??''}</td>
                        <td className="py-2">{formatDate(s.taarich_tchila)}</td>
                        <td className="py-2">{formatDate(s.taarich_siyum)}</td>
                        <td className="py-2">{currency(s.ola_lebach)}</td>
                        <td className="py-2"><Badge color={s.status==='פעיל'?'green':'gray'}>{s.status}</Badge></td>
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
