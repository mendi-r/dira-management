import React, { useEffect, useState, useCallback } from 'react'
import { useSearchParams } from 'react-router-dom'
import { PlusCircle, Edit2, Trash2, TrendingUp, MessageCircle, Download, RefreshCw, CheckCircle, XCircle } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { formatDate, formatMonth, toInputDate, today, currency, logActivity } from '../lib/utils'
import { confirm } from '../lib/confirm'
import { WhatsAppTemplate } from '../components/ui/ContactButtons'
import { Table } from '../components/ui/Table'
import SearchInput from '../components/ui/SearchInput'
import Modal from '../components/ui/Modal'
import Button from '../components/ui/Button'
import Badge from '../components/ui/Badge'
import { FormField, Input, Select, Textarea } from '../components/ui/FormField'
import { StatCard } from '../components/ui/Card'
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
  bochurim_id:'', dirot_id:'', skhum:'', skhum_shulam:'0', taarich:'', chodesh:'',
  sug:'שכר דירה', payment_method:'', billing_day:'', is_amla:false, status:'לא שולם', heara:'',
}
const STATUS_COLORS = { שולם:'green', 'לא שולם':'red', חלקי:'yellow' }

export default function Gviya() {
  const toast = useToast()
  const [searchParams] = useSearchParams()
  const [rows, setRows]         = useState([])
  const [bochurim, setBochurim] = useState([])
  const [dirot, setDirot]       = useState([])
  const [loading, setLoading]   = useState(true)
  const [search, setSearch]     = useState('')
  const [statusFilter, setStatusFilter] = useState(searchParams.get('status') ?? '')
  const [monthFilter, setMonthFilter]   = useState(searchParams.get('chodesh') ?? '')
  const [modal, setModal]       = useState(false)
  const [waModal, setWaModal]   = useState(null) // row for WA template
  const [form, setForm]         = useState(EMPTY)
  const [saving, setSaving]     = useState(false)

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true)
    let q = supabase.from('gviya')
      .select('*, bochurim!bochurim_id(shem,mishpacha,telefon,amla_chodshit), dirot!dirot_id(ktovet,ir)')
      .order('taarich', { ascending: true })
    if (statusFilter) q = q.eq('status', statusFilter)
    if (monthFilter)  q = q.eq('chodesh', monthFilter)
    const [{ data:g },{ data:b },{ data:d }] = await Promise.all([
      q,
      supabase.from('bochurim').select('id,shem,mishpacha,telefon,amla_chodshit').order('shem'),
      supabase.from('dirot').select('id,ktovet,ir').order('ktovet'),
    ])
    setRows(g??[]); setBochurim(b??[]); setDirot(d??[])
    setLoading(false)
  }, [statusFilter, monthFilter])

  useEffect(() => { load() }, [load])

  const filtered = rows.filter(r => {
    const name = `${r.bochurim?.shem??''} ${r.bochurim?.mishpacha??''}`
    const addr = `${r.dirot?.ktovet??''}`
    return `${name} ${addr} ${r.sug??''}`.toLowerCase().includes(search.toLowerCase())
  })

  // Statistics
  const totalCharged = filtered.reduce((s,r) => s + Number(r.skhum??0), 0)
  const totalPaid    = filtered.reduce((s,r) => s + Number(r.skhum_shulam??0), 0)
  const totalDebt    = totalCharged - totalPaid
  const overdue      = filtered.filter(r => r.status !== 'שולם' && r.taarich && new Date(r.taarich) < new Date())
  const pct          = totalCharged > 0 ? Math.round((totalPaid/totalCharged)*100) : 0

  function openNew()  { setForm({ ...EMPTY, taarich: today() }); setModal(true) }
  function openEdit(r){ setForm({ ...EMPTY, ...r, taarich: toInputDate(r.taarich) }); setModal(true) }
  function set(field) { return e => setForm(f=>({...f, [field]: e.target.value})) }

  async function save() {
    if (!form.bochurim_id) { toast('יש לבחור בחור', 'error'); return }
    if (!form.skhum)       { toast('סכום חובה', 'error'); return }
    setSaving(true)
    const payload = {
      bochurim_id: form.bochurim_id, dirot_id: form.dirot_id||null,
      skhum: Number(form.skhum), skhum_shulam: Number(form.skhum_shulam??0),
      taarich: form.taarich||null, chodesh: form.chodesh||null,
      sug: form.sug, payment_method: form.payment_method, billing_day: form.billing_day?Number(form.billing_day):null,
      is_amla: form.is_amla, status: form.status, heara: form.heara,
    }
    // auto-set status
    const paid = Number(payload.skhum_shulam); const total = Number(payload.skhum)
    payload.status = paid >= total ? 'שולם' : paid > 0 ? 'חלקי' : 'לא שולם'

    const isNew = !form.id
    const { error } = isNew
      ? await supabase.from('gviya').insert(payload)
      : await supabase.from('gviya').update(payload).eq('id', form.id)
    setSaving(false)
    if (error) { toast(error.message,'error'); return }
    toast(isNew ? 'נוסף' : 'עודכן')
    setModal(false); load(true)
  }

  async function remove(id) {
    if (!await confirm('למחוק?', { danger: true })) return
    await supabase.from('gviya').delete().eq('id', id)
    toast('נמחק'); load(true)
  }

  async function deleteAll() {
    if (!await confirm(
      `למחוק את כל ${rows.length} הרשומות בגבייה מבחורים?\n\nפעולה זו בלתי הפיכה לחלוטין.`,
      { danger: true, confirmText: 'מחק הכל', cancelText: 'ביטול' }
    )) return
    const { error } = await supabase.from('gviya').delete().not('id', 'is', null)
    if (error) { toast(error.message, 'error'); return }
    toast('כל הרשומות נמחקו')
    load(true)
  }

  async function togglePaid(row) {
    const isFullyPaid = row.status === 'שולם'
    const { error } = await supabase.from('gviya').update(
      isFullyPaid
        ? { skhum_shulam: 0, status: 'לא שולם' }
        : { skhum_shulam: row.skhum, status: 'שולם' }
    ).eq('id', row.id)
    if (error) { toast(error.message, 'error'); return }
    toast(isFullyPaid ? 'סומן כלא שולם' : 'סומן כשולם ✓')
    load(true)
  }

  const todayDate = new Date(); todayDate.setHours(0,0,0,0)
  function isOverdue(row) {
    return row.status !== 'שולם' && row.taarich && new Date(row.taarich) < todayDate
  }

  function clearFilters() {
    setSearch(''); setStatusFilter(''); setMonthFilter('')
  }

  const currentMonth = new Date().toISOString().slice(0, 7)
  const prevMonth = (() => {
    const d = new Date(); d.setMonth(d.getMonth() - 1)
    return d.toISOString().slice(0, 7)
  })()

  function buildWaMessage(row) {
    const name = `${row.bochurim?.shem??''} ${row.bochurim?.mishpacha??''}`
    const addr = row.dirot?.ktovet ?? ''
    const debt = Number(row.skhum??0) - Number(row.skhum_shulam??0)
    return `שלום ${name},\nתזכורת לתשלום שכר דירה${addr?` עבור ${addr}`:''} בסך ${currency(debt)}.\nאנא שלם בהקדם.\nתודה`
  }

  const columns = [
    { key:'bochurim', label:'בחור',    render:v => v?`${v.shem??''} ${v.mishpacha??''}`.trim():'—' },
    { key:'dirot',    label:'דירה',    render:v => v?`${v.ktovet??''}`.trim():'—' },
    { key:'chodesh',  label:'חודש', render:v => formatMonth(v) },
    { key:'sug',      label:'סוג' },
    { key:'skhum',    label:'חיוב',    render:v => currency(v) },
    { key:'skhum_shulam', label:'שולם', render:v => <span className="text-emerald-600 font-medium">{currency(v)}</span> },
    { key:'_debt',    label:'יתרה',    render:(_,r) => {
      const d = Number(r.skhum??0)-Number(r.skhum_shulam??0)
      return d>0 ? <span className="text-red-600 font-semibold">{currency(d)}</span> : <span className="text-emerald-600">✓</span>
    }},
    { key:'taarich',  label:'תאריך',   render:v => formatDate(v) },
    { key:'status',   label:'סטטוס',   render:v=><Badge color={STATUS_COLORS[v]??'gray'}>{v??'—'}</Badge> },
    { key:'actions',  label:'', width:140, render:(_,row) => (
      <div className="flex gap-1 items-center">
        <button
          onClick={e=>{e.stopPropagation();togglePaid(row)}}
          title={row.status==='שולם' ? 'סמן כלא שולם' : 'סמן כשולם'}
          className={`p-1.5 rounded transition-colors ${row.status==='שולם' ? 'text-emerald-600 hover:bg-emerald-50' : 'text-slate-300 hover:text-emerald-500 hover:bg-emerald-50'}`}>
          <CheckCircle size={15}/>
        </button>
        {row.bochurim?.telefon && (
          <button onClick={e=>{e.stopPropagation();setWaModal(row)}} className="p-1.5 rounded text-emerald-500 hover:bg-emerald-50" title="שלח WhatsApp">
            <MessageCircle size={14}/>
          </button>
        )}
        <button onClick={e=>{e.stopPropagation();openEdit(row)}} className="p-1.5 rounded text-slate-400 hover:text-teal-600 hover:bg-teal-50"><Edit2 size={14}/></button>
        <button onClick={e=>{e.stopPropagation();remove(row.id)}} className="p-1.5 rounded text-slate-400 hover:text-red-600 hover:bg-red-50"><Trash2 size={14}/></button>
      </div>
    )},
  ]

  return (
    <div className="space-y-4 fade-in">
      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="סה״כ חיוב" value={currency(totalCharged)} icon={TrendingUp} color="teal"/>
        <StatCard label="סה״כ שולם"  value={currency(totalPaid)}    icon={TrendingUp} color="green"/>
        <StatCard label="יתרת חוב"   value={currency(totalDebt)}    icon={TrendingUp} color="red"/>
        <StatCard label="אחוז גבייה"  value={`${pct}%`}             icon={TrendingUp} color="blue" sub={`${filtered.length} רשומות`}/>
      </div>

      {/* חיובים באיחור — ספירה קטנה */}
      {overdue.length > 0 && (
        <div className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-xl px-4 py-2">
          {overdue.length} חיובים באיחור — מסומנים באדום בטבלה
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex-1 min-w-48"><SearchInput value={search} onChange={setSearch} placeholder="שם, דירה, סוג..."/></div>
        <select value={statusFilter} onChange={e=>setStatusFilter(e.target.value)}
          className="px-3 py-2 text-sm rounded-lg border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-teal-400">
          <option value="">כל הסטטוסים</option>
          <option value="שולם">שולם</option>
          <option value="לא שולם">לא שולם</option>
          <option value="חלקי">חלקי</option>
        </select>
        <input type="month" value={monthFilter} onChange={e=>setMonthFilter(e.target.value)}
          className="px-3 py-2 text-sm rounded-lg border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-teal-400"/>
        <button onClick={()=>setMonthFilter(currentMonth)}
          className={`px-3 py-2 text-xs rounded-lg border transition-colors ${monthFilter===currentMonth?'bg-teal-600 text-white border-teal-600':'bg-white text-slate-600 border-slate-200 hover:border-teal-300'}`}>
          חודש נוכחי
        </button>
        <button onClick={()=>setMonthFilter(prevMonth)}
          className={`px-3 py-2 text-xs rounded-lg border transition-colors ${monthFilter===prevMonth?'bg-teal-600 text-white border-teal-600':'bg-white text-slate-600 border-slate-200 hover:border-teal-300'}`}>
          חודש קודם
        </button>
        {(search || statusFilter || monthFilter) && (
          <button onClick={clearFilters} className="h-9 px-3 text-sm rounded-lg border border-slate-200 bg-white text-red-500 hover:border-red-300 hover:bg-red-50">
            ✕ נקה סינון
          </button>
        )}
        <button onClick={load} className="h-9 w-9 rounded-lg border border-slate-200 bg-white text-slate-500 hover:text-teal-600 hover:border-teal-300 flex items-center justify-center" title="רענן">
          <RefreshCw size={16} className={loading ? 'animate-spin' : ''}/>
        </button>
        <Button variant="secondary" icon={Download}
          onClick={()=>exportCSV(filtered.map(r=>({
            בחור:`${r.bochurim?.shem??''} ${r.bochurim?.mishpacha??''}`,
            דירה:r.dirot?.ktovet??'',
            חודש:formatMonth(r.chodesh),
            סוג:r.sug,
            חיוב:r.skhum,
            שולם:r.skhum_shulam,
            תאריך:formatDate(r.taarich),
            סטטוס:r.status
          })),'gviya.csv')}>
          ייצוא
        </Button>
        <button onClick={deleteAll}
          className="h-9 px-3 text-sm rounded-lg border border-red-200 bg-white text-red-500 hover:bg-red-50 hover:border-red-400 flex items-center gap-1.5 transition-colors">
          <Trash2 size={14}/>
          מחק הכל
        </button>
        <Button icon={PlusCircle} onClick={openNew}>חיוב חדש</Button>
      </div>

      <p className="text-sm text-slate-400">{filtered.length} רשומות</p>
      <Table columns={columns} data={filtered} loading={loading} emptyText="לא נמצאו רשומות" onRowClick={openEdit}
        rowClassName={row => isOverdue(row) ? 'bg-red-50 hover:bg-red-100' : 'hover:bg-slate-50'}/>

      {/* Form Modal */}
      <Modal open={modal} onClose={()=>setModal(false)} title={form.id?'עריכת חיוב':'חיוב חדש'} size="lg">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <FormField label="בחור" required>
            <Select value={form.bochurim_id??''} onChange={set('bochurim_id')}>
              <option value="">-- בחר בחור --</option>
              {bochurim.map(b=><option key={b.id} value={b.id}>{b.shem} {b.mishpacha}</option>)}
            </Select>
          </FormField>
          <FormField label="דירה">
            <Select value={form.dirot_id??''} onChange={set('dirot_id')}>
              <option value="">-- ללא דירה --</option>
              {dirot.map(d=><option key={d.id} value={d.id}>{d.ktovet}</option>)}
            </Select>
          </FormField>
          <FormField label="חודש (YYYY-MM)"><Input type="month" value={form.chodesh??''} onChange={set('chodesh')}/></FormField>
          <FormField label="תאריך חיוב"><Input type="date" value={form.taarich??''} onChange={set('taarich')}/></FormField>
          <FormField label="סוג">
            <Select value={form.sug??'שכר דירה'} onChange={set('sug')}>
              <option value="שכר דירה">שכר דירה</option>
              <option value="עמלה">עמלה</option>
              <option value="ארנונה">ארנונה</option>
              <option value="חשמל">חשמל</option>
              <option value="מים">מים</option>
              <option value="אחר">אחר</option>
            </Select>
          </FormField>
          <FormField label="אמצעי תשלום">
            <Select value={form.payment_method??''} onChange={set('payment_method')}>
              <option value="">-- בחר --</option>
              <option value="מזומן">מזומן</option>
              <option value="העברה">העברה</option>
              <option value="אשראי">אשראי</option>
              <option value="ביט">ביט</option>
              <option value="פייבוקס">פייבוקס</option>
            </Select>
          </FormField>
          <FormField label="סכום חיוב (₪)" required><Input type="number" min="0" value={form.skhum??''} onChange={set('skhum')}/></FormField>
          <FormField label="סכום ששולם (₪)"><Input type="number" min="0" value={form.skhum_shulam??''} onChange={set('skhum_shulam')}/></FormField>
          <FormField label="יום חיוב בחודש"><Input type="number" min="1" max="31" value={form.billing_day??''} onChange={set('billing_day')}/></FormField>
          <div className="flex items-center gap-2 pt-6">
            <input type="checkbox" id="is_amla" checked={!!form.is_amla} onChange={e=>setForm(f=>({...f,is_amla:e.target.checked}))} className="w-4 h-4 text-teal-600 rounded"/>
            <label htmlFor="is_amla" className="text-sm text-slate-700">עמלה חודשית</label>
          </div>
        </div>
        <div className="mt-4">
          <FormField label="הערה"><Textarea value={form.heara??''} onChange={set('heara')}/></FormField>
        </div>
        <div className="flex justify-end gap-3 mt-6">
          <Button variant="secondary" onClick={()=>setModal(false)}>ביטול</Button>
          <Button loading={saving} onClick={save}>שמור</Button>
        </div>
      </Modal>

      {/* WhatsApp Template Modal */}
      <Modal open={!!waModal} onClose={()=>setWaModal(null)} title="שליחת תזכורת WhatsApp" size="sm">
        {waModal && (
          <div className="space-y-4">
            <p className="text-sm text-slate-600 bg-slate-50 rounded-xl p-3 whitespace-pre-line">{buildWaMessage(waModal)}</p>
            <div className="flex justify-center">
              <WhatsAppTemplate phone={waModal.bochurim?.telefon} message={buildWaMessage(waModal)}/>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}
