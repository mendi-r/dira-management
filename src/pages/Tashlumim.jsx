import React, { useEffect, useState, useCallback } from 'react'
import { PlusCircle, Edit2, Trash2, RefreshCw, Download, CheckCircle, AlertTriangle } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { formatDate, formatMonth, toInputDate, today, currency, logActivity } from '../lib/utils'
import { confirm } from '../lib/confirm'
import { Table } from '../components/ui/Table'
import SearchInput from '../components/ui/SearchInput'
import Modal from '../components/ui/Modal'
import Button from '../components/ui/Button'
import Badge from '../components/ui/Badge'
import { StatCard } from '../components/ui/Card'
import { FormField, Input, Select, Textarea } from '../components/ui/FormField'
import { useToast } from '../components/ui/Toast'
import { TrendingDown } from 'lucide-react'

function exportCSV(data, filename) {
  if (!data.length) return
  const headers = Object.keys(data[0]).join(',')
  const rows = data.map(r => Object.values(r).map(v=>`"${v??''}"`).join(',')).join('\n')
  const blob = new Blob(['﻿' + headers + '\n' + rows], { type:'text/csv;charset=utf-8;' })
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob)
  a.download = filename; a.click()
}

const EMPTY = {
  dirot_id:'', skhum:'', skhum_shulam:'0', taarich:'', chodesh:'',
  payment_day:'', status:'לא שולם', heara:'',
}
const STATUS_COLORS = { שולם:'green', 'לא שולם':'red', חלקי:'yellow' }

export default function Tashlumim() {
  const toast = useToast()
  const [rows, setRows]       = useState([])
  const [dirot, setDirot]     = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch]   = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [monthFilter, setMonthFilter]   = useState('')
  const [overdueFilter, setOverdueFilter] = useState(false)
  const [modal, setModal]     = useState(false)
  const [form, setForm]       = useState(EMPTY)
  const [saving, setSaving]   = useState(false)

  const today = new Date(); today.setHours(0,0,0,0)
  function isOverdue(row) {
    return row.status !== 'שולם' && row.taarich && new Date(row.taarich) < today
  }

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true)
    let q = supabase.from('tashlumim_baalim')
      .select('*, dirot(ktovet,ir,baalim_shem,baalim_telefon1)')
      .order('taarich', { ascending: true })
    if (statusFilter) q = q.eq('status', statusFilter)
    if (monthFilter)  q = q.eq('chodesh', monthFilter)
    const [{ data: t }, { data: d }] = await Promise.all([
      q,
      supabase.from('dirot').select('id,ktovet,ir,baalim_shem,ola_schirut_chodshi,payment_day').order('ktovet'),
    ])
    setRows(t ?? [])
    setDirot(d ?? [])
    setLoading(false)
  }, [statusFilter, monthFilter])

  useEffect(() => { load() }, [load])

  const filtered = rows.filter(r => {
    const addr = `${r.dirot?.ktovet??''} ${r.dirot?.ir??''} ${r.dirot?.baalim_shem??''}`
    const textMatch = addr.toLowerCase().includes(search.toLowerCase())
    const overdueMatch = !overdueFilter || isOverdue(r)
    return textMatch && overdueMatch
  })

  const totalCharged = filtered.reduce((s,r) => s + Number(r.skhum??0), 0)
  const totalPaid    = filtered.reduce((s,r) => s + Number(r.skhum_shulam??0), 0)
  const totalDebt    = totalCharged - totalPaid
  const pct          = totalCharged > 0 ? Math.round((totalPaid/totalCharged)*100) : 0

  function openNew()  { setForm({ ...EMPTY, taarich: today() }); setModal(true) }
  function openEdit(r){ setForm({ ...EMPTY, ...r, taarich: toInputDate(r.taarich) }); setModal(true) }
  function set(field) { return e => setForm(f => ({ ...f, [field]: e.target.value })) }

  // כשבוחרים דירה — ממלא אוטומטית את הסכום ויום התשלום
  function onDiraChange(e) {
    const id = e.target.value
    const dira = dirot.find(d => d.id === id)
    setForm(f => ({
      ...f,
      dirot_id: id,
      skhum: dira?.ola_schirut_chodshi ?? f.skhum,
      payment_day: dira?.payment_day ?? f.payment_day,
    }))
  }

  async function save() {
    if (!form.dirot_id) { toast('יש לבחור דירה', 'error'); return }
    if (!form.skhum)    { toast('סכום חובה', 'error'); return }
    setSaving(true)
    const payload = {
      dirot_id: form.dirot_id,
      skhum: Number(form.skhum),
      skhum_shulam: Number(form.skhum_shulam ?? 0),
      taarich: form.taarich || null,
      chodesh: form.chodesh || null,
      payment_day: form.payment_day ? Number(form.payment_day) : null,
      heara: form.heara,
    }
    const paid = Number(payload.skhum_shulam), total = Number(payload.skhum)
    payload.status = paid >= total ? 'שולם' : paid > 0 ? 'חלקי' : 'לא שולם'

    const isNew = !form.id
    const { error } = isNew
      ? await supabase.from('tashlumim_baalim').insert(payload)
      : await supabase.from('tashlumim_baalim').update(payload).eq('id', form.id)
    setSaving(false)
    if (error) { toast(error.message, 'error'); return }
    toast(isNew ? 'נוסף' : 'עודכן')
    setModal(false); load(true)
  }

  async function remove(id) {
    if (!await confirm('למחוק תשלום זה?', { danger: true })) return
    await supabase.from('tashlumim_baalim').delete().eq('id', id)
    toast('נמחק'); load(true)
  }

  async function deleteAll() {
    if (!await confirm(
      `למחוק את כל ${rows.length} הרשומות בתשלומים לבעלים?\n\nפעולה זו בלתי הפיכה לחלוטין.`,
      { danger: true, confirmText: 'מחק הכל', cancelText: 'ביטול' }
    )) return
    const { error } = await supabase.from('tashlumim_baalim').delete().not('id', 'is', null)
    if (error) { toast(error.message, 'error'); return }
    toast('כל הרשומות נמחקו')
    load(true)
  }

  async function togglePaid(row) {
    const isFullyPaid = row.status === 'שולם'
    const { error } = await supabase.from('tashlumim_baalim').update(
      isFullyPaid
        ? { skhum_shulam: 0, status: 'לא שולם' }
        : { skhum_shulam: row.skhum, status: 'שולם' }
    ).eq('id', row.id)
    if (error) { toast(error.message, 'error'); return }
    toast(isFullyPaid ? 'סומן כלא שולם' : 'שולם ✓')
    load(true)
  }

  function clearFilters() {
    setSearch(''); setStatusFilter(''); setMonthFilter(''); setOverdueFilter(false)
  }

  const currentMonth = new Date().toISOString().slice(0, 7)
  const prevMonth = (() => {
    const d = new Date(); d.setMonth(d.getMonth() - 1)
    return d.toISOString().slice(0, 7)
  })()

  const columns = [
    { key:'dirot', label:'דירה', render:v => v ? `${v.ktovet??''}${v.ir?`, ${v.ir}`:''}` : '—' },
    { key:'dirot', label:'בעלים', render:v => v?.baalim_shem ?? '—' },
    { key:'chodesh', label:'חודש', render:v => formatMonth(v) },
    { key:'skhum', label:'לתשלום', render:v => currency(v) },
    { key:'skhum_shulam', label:'שולם', render:v => <span className="text-emerald-600 font-medium">{currency(v)}</span> },
    { key:'_yitrat', label:'יתרה', render:(_,r) => {
      const d = Number(r.skhum??0) - Number(r.skhum_shulam??0)
      return d > 0
        ? <span className="text-red-600 font-semibold">{currency(d)}</span>
        : <span className="text-emerald-600">✓</span>
    }},
    { key:'taarich', label:'תאריך', render:v => formatDate(v) },
    { key:'status', label:'סטטוס', render:v => <Badge color={STATUS_COLORS[v]??'gray'}>{v??'—'}</Badge> },
    { key:'actions', label:'', width:110, render:(_,row) => (
      <div className="flex gap-1 items-center">
        <button
          onClick={e=>{e.stopPropagation();togglePaid(row)}}
          title={row.status==='שולם' ? 'סמן כלא שולם' : 'סמן כשולם'}
          className={`p-1.5 rounded transition-colors ${row.status==='שולם' ? 'text-emerald-600 hover:bg-emerald-50' : 'text-slate-300 hover:text-emerald-500 hover:bg-emerald-50'}`}>
          <CheckCircle size={15}/>
        </button>
        <button onClick={e=>{e.stopPropagation();openEdit(row)}} className="p-1.5 rounded text-slate-400 hover:text-teal-600 hover:bg-teal-50"><Edit2 size={14}/></button>
        <button onClick={e=>{e.stopPropagation();remove(row.id)}} className="p-1.5 rounded text-slate-400 hover:text-red-600 hover:bg-red-50"><Trash2 size={14}/></button>
      </div>
    )},
  ]

  return (
    <div className="space-y-4 fade-in">
      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="סה״כ לתשלום"  value={currency(totalCharged)} icon={TrendingDown} color="red"/>
        <StatCard label="סה״כ שולם"     value={currency(totalPaid)}    icon={TrendingDown} color="green"/>
        <StatCard label="יתרה לתשלום"  value={currency(totalDebt)}    icon={TrendingDown} color="amber"/>
        <StatCard label="אחוז תשלום"   value={`${pct}%`}              icon={TrendingDown} color="blue" sub={`${filtered.length} רשומות`}/>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex-1 min-w-48">
          <SearchInput value={search} onChange={setSearch} placeholder="כתובת דירה, בעלים..."/>
        </div>
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
          className={`h-9 px-3 text-sm rounded-lg border transition-colors ${monthFilter===currentMonth?'bg-teal-600 text-white border-teal-600':'bg-white text-slate-600 border-slate-200 hover:border-teal-300'}`}>
          חודש נוכחי
        </button>
        <button onClick={()=>setMonthFilter(prevMonth)}
          className={`h-9 px-3 text-sm rounded-lg border transition-colors ${monthFilter===prevMonth?'bg-teal-600 text-white border-teal-600':'bg-white text-slate-600 border-slate-200 hover:border-teal-300'}`}>
          חודש קודם
        </button>
        {(search || statusFilter || monthFilter || overdueFilter) && (
          <button onClick={clearFilters} className="h-9 px-3 text-sm rounded-lg border border-slate-200 bg-white text-red-500 hover:border-red-300 hover:bg-red-50">
            ✕ נקה סינון
          </button>
        )}
        <button onClick={() => load()} className="h-9 w-9 rounded-lg border border-slate-200 bg-white text-slate-500 hover:text-teal-600 hover:border-teal-300 flex items-center justify-center" title="רענן">
          <RefreshCw size={16} className={loading ? 'animate-spin' : ''}/>
        </button>
        <Button variant="secondary" icon={Download}
          onClick={()=>exportCSV(filtered.map(r=>({
            דירה: r.dirot?.ktovet??'',
            בעלים: r.dirot?.baalim_shem??'',
            חודש: formatMonth(r.chodesh),
            לתשלום: r.skhum,
            שולם: r.skhum_shulam,
            תאריך: formatDate(r.taarich),
            סטטוס: r.status,
          })), 'tashlumim_baalim.csv')}>
          ייצוא
        </Button>
        <button onClick={deleteAll}
          className="h-9 px-3 text-sm rounded-lg border border-red-200 bg-white text-red-500 hover:bg-red-50 hover:border-red-400 flex items-center gap-1.5 transition-colors">
          <Trash2 size={14}/>
          מחק הכל
        </button>
        <Button icon={PlusCircle} onClick={openNew}>תשלום חדש</Button>
      </div>

          {/* התראת תשלומים באיחור */}
      {(() => {
        const overdueRows = rows.filter(r => isOverdue(r))
        if (!overdueRows.length) return null
        return (
          <button
            onClick={() => setOverdueFilter(true)}
            className="w-full flex items-center gap-3 p-3 bg-red-50 border border-red-200 rounded-xl hover:bg-red-100 transition-colors text-right">
            <AlertTriangle size={16} className="text-red-600 flex-shrink-0"/>
            <div className="flex-1">
              <span className="text-sm font-semibold text-red-700">יש {overdueRows.length} תשלומים באיחור</span>
              <span className="text-xs text-red-500 mr-2">לחץ לסינון</span>
            </div>
          </button>
        )
      })()}

      <p className="text-sm text-slate-400">{filtered.length} רשומות</p>
      <Table columns={columns} data={filtered} loading={loading} emptyText="לא נמצאו רשומות" onRowClick={openEdit}/>

      <Modal open={modal} onClose={()=>setModal(false)} title={form.id ? 'עריכת תשלום' : 'תשלום חדש לבעלים'} size="lg">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <FormField label="דירה" required>
            <Select value={form.dirot_id??''} onChange={onDiraChange}>
              <option value="">-- בחר דירה --</option>
              {dirot.map(d => (
                <option key={d.id} value={d.id}>
                  {d.ktovet}{d.ir?`, ${d.ir}`:''}{d.ola_schirut_chodshi?` (${currency(d.ola_schirut_chodshi)}/ח)`:''}
                </option>
              ))}
            </Select>
          </FormField>
          <FormField label="חודש (YYYY-MM)">
            <Input type="month" value={form.chodesh??''} onChange={set('chodesh')}/>
          </FormField>
          <FormField label="תאריך תשלום">
            <Input type="date" value={form.taarich??''} onChange={set('taarich')}/>
          </FormField>
          <FormField label="יום חיוב בחודש">
            <Input type="number" min="1" max="31" value={form.payment_day??''} onChange={set('payment_day')}/>
          </FormField>
          <FormField label="סכום לתשלום (₪)" required>
            <Input type="number" min="0" value={form.skhum??''} onChange={set('skhum')}/>
          </FormField>
          <FormField label="סכום ששולם (₪)">
            <Input type="number" min="0" value={form.skhum_shulam??''} onChange={set('skhum_shulam')}/>
          </FormField>
        </div>
        <div className="mt-4">
          <FormField label="הערה"><Textarea value={form.heara??''} onChange={set('heara')}/></FormField>
        </div>
        <div className="flex justify-end gap-3 mt-6">
          <Button variant="secondary" onClick={()=>setModal(false)}>ביטול</Button>
          <Button loading={saving} onClick={save}>שמור</Button>
        </div>
      </Modal>
    </div>
  )
}
