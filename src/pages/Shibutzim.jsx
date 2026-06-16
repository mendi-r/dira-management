import React, { useEffect, useState, useCallback } from 'react'
import { useSearchParams } from 'react-router-dom'
import { PlusCircle, Edit2, Trash2, Download, RefreshCw, AlertTriangle, Bed } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { formatDate, toInputDate, currency, logActivity } from '../lib/utils'
import { confirm } from '../lib/confirm'
import { Table } from '../components/ui/Table'
import SearchInput from '../components/ui/SearchInput'
import Modal from '../components/ui/Modal'
import Button from '../components/ui/Button'
import Badge from '../components/ui/Badge'
import { FormField, Input, Select, Textarea } from '../components/ui/FormField'
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
  bochurim_id:'', dirot_id:'', taarich_tchila:'', taarich_siyum:'',
  mispar_chodashim:'',
  status:'פעיל', ola_lebach:'', heara:'',
}
const STATUS_COLORS = { פעיל:'green', הסתיים:'gray', בהמתנה:'yellow' }

/** חישוב תאריך סיום: תחילה + חודשים = יום אחרון של החודש האחרון */
function calcEndDate(startDate, months) {
  if (!startDate || !months || Number(months) <= 0) return ''
  const d = new Date(startDate + 'T12:00:00')
  d.setMonth(d.getMonth() + Number(months))
  d.setDate(0) // יום 0 = יום אחרון של החודש הקודם
  return d.toISOString().slice(0, 10)
}

export default function Shibutzim() {
  const toast = useToast()
  const [searchParams] = useSearchParams()
  const [rows, setRows]         = useState([])
  const [bochurim, setBochurim] = useState([])
  const [dirot, setDirot]       = useState([])
  const [loading, setLoading]   = useState(true)
  const [search, setSearch]     = useState('')
  const [statusFilter, setStatusFilter] = useState(searchParams.get('status') ?? '')
  const [modal, setModal]       = useState(false)
  const [form, setForm]         = useState(EMPTY)
  const [saving, setSaving]     = useState(false)
  const [autoSplit, setAutoSplit]       = useState(null)
  const [bedInfo, setBedInfo]           = useState(null)
  const [originalSiyum, setOriginalSiyum] = useState(null)
  const [duplicateWarning, setDuplicateWarning] = useState(null) // { address } אם הבחור כבר משובץ

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true)
    let q = supabase.from('shibutzim')
      .select('*, bochurim!bochurim_id(shem,mishpacha,telefon), dirot!dirot_id(ktovet,ir,ola_schirut_chodshi,mispar_mitot)')
      .order('taarich_tchila', { ascending: true })
    if (statusFilter) q = q.eq('status', statusFilter)
    const [{ data:s },{ data:b },{ data:d }] = await Promise.all([
      q,
      supabase.from('bochurim').select('id,shem,mishpacha').order('shem'),
      supabase.from('dirot').select('id,ktovet,ir,ola_schirut_chodshi,mispar_mitot,payment_day').order('ktovet'),
    ])
    setRows(s??[]); setBochurim(b??[]); setDirot(d??[])
    setLoading(false)
  }, [statusFilter])

  useEffect(() => { load() }, [load])

  // חישוב אוטומטי של חלק + מידע מיטות
  async function calcSplit(dirotId, excludeId) {
    if (!dirotId) { setAutoSplit(null); setBedInfo(null); return }
    const dira = dirot.find(d => d.id === dirotId)
    if (!dira) return
    const { count } = await supabase.from('shibutzim')
      .select('*', { count:'exact', head:true })
      .eq('dirot_id', dirotId)
      .eq('status', 'פעיל')
      .neq('id', excludeId ?? '00000000-0000-0000-0000-000000000000')
    const occupied = count ?? 0
    const totalMitot = Number(dira.mispar_mitot ?? 0)
    const free = Math.max(0, totalMitot - occupied)
    setBedInfo({ total: totalMitot, occupied, free })
    if (dira.ola_schirut_chodshi) {
      const total = occupied + (form.id ? 0 : 1)
      const split = total > 0 ? Math.round(Number(dira.ola_schirut_chodshi) / total) : 0
      setAutoSplit({ total, split, rent: dira.ola_schirut_chodshi })
      return split
    }
  }

  // עדכון חלוקת שכירות לכל הבחורים בדירה מרגע ההצטרפות
  async function recalcBilling(dirotId, fromDate) {
    const { data: dira } = await supabase.from('dirot')
      .select('ola_schirut_chodshi').eq('id', dirotId).single()
    if (!dira?.ola_schirut_chodshi) return
    const { data: active } = await supabase.from('shibutzim')
      .select('id, bochurim_id')
      .eq('dirot_id', dirotId)
      .eq('status', 'פעיל')
    if (!active?.length) return
    const newShare = Math.round(Number(dira.ola_schirut_chodshi) / active.length)
    const fromYM = fromDate ? fromDate.slice(0, 7) : null
    for (const s of active) {
      await supabase.from('shibutzim').update({ ola_lebach: newShare }).eq('id', s.id)
      if (fromYM) {
        await supabase.from('gviya')
          .update({ skhum: newShare })
          .eq('bochurim_id', s.bochurim_id)
          .eq('dirot_id', dirotId)
          .neq('status', 'שולם')
          .gte('chodesh', fromYM)
      }
    }
    toast(`חלוקה עודכנה: ${currency(newShare)}/חודש לכל בחור (${active.length} משובצים)`)
  }

  const filtered = rows.filter(r => {
    const name = `${r.bochurim?.shem??''} ${r.bochurim?.mishpacha??''}`
    const addr = `${r.dirot?.ktovet??''} ${r.dirot?.ir??''}`
    return `${name} ${addr}`.toLowerCase().includes(search.toLowerCase())
  })

  function openNew()  {
    setForm(EMPTY); setAutoSplit(null); setBedInfo(null)
    setOriginalSiyum(null); setDuplicateWarning(null)
    setModal(true)
  }
  function openEdit(r){
    setForm({ ...EMPTY, ...r, taarich_tchila: toInputDate(r.taarich_tchila), taarich_siyum: toInputDate(r.taarich_siyum) })
    setAutoSplit(null); setBedInfo(null); setDuplicateWarning(null)
    setOriginalSiyum(r.taarich_siyum ? toInputDate(r.taarich_siyum) : null)
    setModal(true)
    if (r.dirot_id) calcSplit(r.dirot_id, r.id)
  }

  // בדיקת שיבוץ כפול בזמן אמת בבחירת בחור
  async function onBochurChange(e) {
    const bochurimId = e.target.value
    setForm(f => ({ ...f, bochurim_id: bochurimId }))
    setDuplicateWarning(null)
    if (!bochurimId || form.id) return // בעריכה לא מציגים
    const { data: existing } = await supabase.from('shibutzim')
      .select('id, dirot!dirot_id(ktovet, ir)')
      .eq('bochurim_id', bochurimId)
      .eq('status', 'פעיל')
      .maybeSingle()
    if (existing) {
      const d = existing.dirot
      const addr = d ? `${d.ktovet ?? ''}${d.ir ? ', ' + d.ir : ''}` : '—'
      setDuplicateWarning(addr)
    }
  }

  function set(field) {
    return e => {
      const val = e.target.value
      setForm(f => {
        const next = { ...f, [field]: val }
        // חישוב אוטומטי של תאריך סיום מתאריך תחילה + מספר חודשים
        if (field === 'taarich_tchila' || field === 'mispar_chodashim') {
          const start  = field === 'taarich_tchila'   ? val : f.taarich_tchila
          const months = field === 'mispar_chodashim' ? val : f.mispar_chodashim
          const end = calcEndDate(start, months)
          if (end) next.taarich_siyum = end
        }
        return next
      })
      if (field === 'dirot_id') calcSplit(val, form.id)
    }
  }

  /** יצירת שורות גבייה חודשיות אוטומטית לכל חודש בתקופת השיבוץ */
  async function createMonthlyBilling(bocherImId, dirotId, start, end, ola) {
    if (!start || !bocherImId) return

    // Get billing day from dira settings
    const dira = dirot.find(d => d.id === dirotId)
    const billingDay = Number(dira?.payment_day ?? 1)

    const startD = new Date(start + 'T12:00:00')
    const endD   = end ? new Date(end + 'T12:00:00') : new Date(startD)
    if (!end) endD.setMonth(endD.getMonth() + 12)

    // Check for existing rows to avoid duplicates
    const { count } = await supabase.from('gviya')
      .select('*', { count:'exact', head:true })
      .eq('bochurim_id', bocherImId)
      .eq('dirot_id', dirotId)
      .gte('taarich', start)
    if (count > 0) return // already created

    const billingRows = []
    const cur = new Date(startD.getFullYear(), startD.getMonth(), 1)
    const endMonth = new Date(endD.getFullYear(), endD.getMonth(), 1)

    while (cur <= endMonth) {
      const y  = cur.getFullYear()
      const m  = cur.getMonth() + 1
      const ym = `${y}-${String(m).padStart(2,'0')}`
      // Clamp day to last day of month (e.g. Feb)
      const daysInMonth = new Date(y, m, 0).getDate()
      const day = Math.min(billingDay, daysInMonth)
      billingRows.push({
        bochurim_id: bocherImId,
        dirot_id:    dirotId,
        skhum:       ola,
        taarich:     `${y}-${String(m).padStart(2,'0')}-${String(day).padStart(2,'0')}`,
        chodesh:     ym,
        sug:         'שכר דירה',
        status:      'לא שולם',
        billing_day: day,
      })
      cur.setMonth(cur.getMonth() + 1)
    }

    if (billingRows.length > 0) {
      await supabase.from('gviya').insert(billingRows)
      toast(`נוצרו ${billingRows.length} שורות גבייה (יום ${billingDay} לחודש)`)
    }
  }

  async function save() {
    if (!form.bochurim_id || !form.dirot_id) { toast('יש לבחור בחור ודירה', 'error'); return }
    setSaving(true)
    const isNew = !form.id

    if (isNew) {
      // ── בדיקת מיטות פנויות ──
      const dira = dirot.find(d => d.id === form.dirot_id)
      if (dira?.mispar_mitot) {
        const { count: occupied } = await supabase.from('shibutzim')
          .select('*', { count: 'exact', head: true })
          .eq('dirot_id', form.dirot_id)
          .eq('status', 'פעיל')
        if ((occupied ?? 0) >= Number(dira.mispar_mitot)) {
          toast(`אין מיטות פנויות — הדירה מלאה (${occupied}/${dira.mispar_mitot})`, 'error')
          setSaving(false); return
        }
      }

      // ── בדיקת שיבוץ כפול ──
      const { data: existingShib } = await supabase.from('shibutzim')
        .select('id, dirot!dirot_id(ktovet, ir)')
        .eq('bochurim_id', form.bochurim_id)
        .eq('status', 'פעיל')
        .maybeSingle()
      if (existingShib) {
        const d = existingShib.dirot
        const addr = d ? `${d.ktovet ?? ''}${d.ir ? ', ' + d.ir : ''}` : '—'
        const go = await confirm(
          `בחור זה כבר משובץ בדירה "${addr}".\nלסיים את השיבוץ הנוכחי ולהעביר אותו לדירה החדשה?`,
          { confirmText: 'העבר', cancelText: 'ביטול' }
        )
        if (!go) { setSaving(false); return }
        const endDate = form.taarich_tchila || new Date().toISOString().slice(0, 10)
        await supabase.from('shibutzim').update({ status: 'הסתיים', taarich_siyum: endDate }).eq('id', existingShib.id)
      }
    }

    // שמירת השיבוץ (olla_lebach יתעדכן ע"י recalcBilling)
    const manualSplit = form.ola_lebach ? Number(form.ola_lebach) : null
    const payload = {
      bochurim_id:     form.bochurim_id,
      dirot_id:        form.dirot_id,
      status:          form.status,
      heara:           form.heara,
      ola_lebach:      manualSplit,
      taarich_tchila:  form.taarich_tchila || null,
      taarich_siyum:   form.taarich_siyum  || null,
      mispar_chodashim: form.mispar_chodashim ? Number(form.mispar_chodashim) : null,
    }
    const { data, error } = isNew
      ? await supabase.from('shibutzim').insert(payload).select().single()
      : await supabase.from('shibutzim').update(payload).eq('id', form.id).select().single()
    if (error) { setSaving(false); toast(error.message, 'error'); return }

    // סגירת המודל מיד לאחר שמירה ב-DB (לפני פעולות חיוב)
    logActivity(isNew?'INSERT':'UPDATE','shibutzim',data.id,'')
    setSaving(false)
    toast(isNew ? 'שיבוץ נוסף' : 'עודכן')
    setModal(false)
    load(true)

    // שמירת ערכי הטופס לפני שינויי state
    const _bochurimId   = form.bochurim_id
    const _dirotId      = form.dirot_id
    const _taarichStart = form.taarich_tchila
    const _taarichSiyum = form.taarich_siyum
    const _origSiyum    = originalSiyum

    if (isNew && _taarichStart) {
      // יצירת שורות גבייה (סכום זמני 0, יתעדכן ע"י recalcBilling)
      await createMonthlyBilling(_bochurimId, _dirotId, _taarichStart, _taarichSiyum, 0)
      // ── חלוקה דינמית: עדכון כל הבחורים בדירה ──
      if (!manualSplit) {
        await recalcBilling(_dirotId, _taarichStart)
      }
    }

    // ── עריכה: טיפול בשינוי תקופת שיבוץ ──
    if (!isNew && _taarichSiyum !== _origSiyum) {
      const newSiyum = _taarichSiyum
      const oldSiyum = _origSiyum
      if (newSiyum && oldSiyum) {
        const newEnd = new Date(newSiyum + 'T12:00:00')
        const oldEnd = new Date(oldSiyum + 'T12:00:00')
        if (newEnd < oldEnd) {
          const newEndYM = newSiyum.slice(0, 7)
          const { data: deleted } = await supabase.from('gviya')
            .delete()
            .eq('bochurim_id', _bochurimId)
            .eq('dirot_id', _dirotId)
            .neq('status', 'שולם')
            .gt('chodesh', newEndYM)
            .select('id')
          if (deleted?.length)
            toast(`נמחקו ${deleted.length} שורות גבייה שהוסרו`)
        } else if (newEnd > oldEnd) {
          const nextMonth = new Date(oldEnd.getFullYear(), oldEnd.getMonth() + 1, 1)
          const startFrom = nextMonth.toISOString().slice(0, 10)
          const ola = data.ola_lebach ?? manualSplit ?? autoSplit?.split ?? 0
          await createMonthlyBilling(_bochurimId, _dirotId, startFrom, newSiyum, ola)
        }
      }
    }

    // אם עריכה וסטטוס שונה ל"הסתיים" — עדכן חלוקה לשאר הבחורים בדירה
    if (!isNew && payload.status === 'הסתיים') {
      await recalcBilling(_dirotId, new Date().toISOString().slice(0, 10))
    }
  }

  async function remove(id) {
    if (!await confirm('למחוק שיבוץ זה?', { danger: true })) return
    await supabase.from('shibutzim').delete().eq('id', id)
    toast('נמחק')
    load(true)
  }

  async function endAssignment(row) {
    if (!await confirm('לסיים שיבוץ זה?', { confirmText: 'סיים' })) return
    const todayStr = new Date().toISOString().slice(0,10)
    await supabase.from('shibutzim').update({ status:'הסתיים', taarich_siyum: todayStr }).eq('id', row.id)
    toast('השיבוץ הסתיים')
    // עדכון חלוקת שכירות לשאר הבחורים שנשארו בדירה
    await recalcBilling(row.dirot_id, todayStr)
    load(true)
  }

  const columns = [
    { key:'bochurim', label:'בחור',  render:v => v ? `${v.shem??''} ${v.mishpacha??''}`.trim() : '—' },
    { key:'dirot',    label:'דירה',  render:v => v ? `${v.ktovet??''}, ${v.ir??''}` : '—' },
    { key:'ola_lebach', label:'חלק ₪', render:v => currency(v) },
    { key:'taarich_tchila', label:'תחילה', render:v => formatDate(v) },
    { key:'taarich_siyum',  label:'סיום',  render:v => formatDate(v) },
    { key:'status', label:'סטטוס', render:v=><Badge color={STATUS_COLORS[v]??'gray'}>{v??'—'}</Badge> },
    { key:'actions', label:'', width:120, render:(_,row) => (
      <div className="flex gap-1">
        {row.status==='פעיל' && <button onClick={e=>{e.stopPropagation();endAssignment(row)}} className="px-2 py-1 text-xs rounded bg-amber-50 text-amber-700 hover:bg-amber-100">סיים</button>}
        <button onClick={e=>{e.stopPropagation();openEdit(row)}} className="p-1.5 rounded text-slate-400 hover:text-teal-600 hover:bg-teal-50"><Edit2 size={14}/></button>
        <button onClick={e=>{e.stopPropagation();remove(row.id)}} className="p-1.5 rounded text-slate-400 hover:text-red-600 hover:bg-red-50"><Trash2 size={14}/></button>
      </div>
    )},
  ]

  return (
    <div className="space-y-4 fade-in">
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex-1 min-w-48"><SearchInput value={search} onChange={setSearch} placeholder="שם בחור, כתובת..."/></div>
        <select value={statusFilter} onChange={e=>setStatusFilter(e.target.value)}
          className="px-3 py-2 text-sm rounded-lg border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-teal-400">
          <option value="">כל הסטטוסים</option>
          <option value="פעיל">פעיל</option>
          <option value="הסתיים">הסתיים</option>
          <option value="בהמתנה">בהמתנה</option>
        </select>
        <button onClick={load} className="h-9 w-9 rounded-lg border border-slate-200 bg-white text-slate-500 hover:text-teal-600 hover:border-teal-300 flex items-center justify-center" title="רענן">
          <RefreshCw size={16} className={loading ? 'animate-spin' : ''}/>
        </button>
        <Button variant="secondary" icon={Download}
          onClick={()=>exportCSV(filtered.map(r=>({
            בחור:`${r.bochurim?.shem??''} ${r.bochurim?.mishpacha??''}`,
            דירה:r.dirot?.ktovet??'',
            חלק:r.ola_lebach,
            תחילה:formatDate(r.taarich_tchila),
            סיום:formatDate(r.taarich_siyum),
            סטטוס:r.status
          })),'shibutzim.csv')}>
          ייצוא
        </Button>
        <Button icon={PlusCircle} onClick={openNew}>שיבוץ חדש</Button>
      </div>

      <p className="text-sm text-slate-400">{filtered.length} שיבוצים</p>
      <Table columns={columns} data={filtered} loading={loading} emptyText="לא נמצאו שיבוצים" onRowClick={openEdit}/>

      <Modal open={modal} onClose={()=>setModal(false)} title={form.id ? 'עריכת שיבוץ' : 'שיבוץ חדש'}>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-start">

          {/* דירה קודם */}
          <FormField label="דירה" required>
            <Select value={form.dirot_id??''} onChange={e => { set('dirot_id')(e); calcSplit(e.target.value, form.id) }}>
              <option value="">-- בחר דירה --</option>
              {dirot.map(d=><option key={d.id} value={d.id}>{d.ktovet}{d.ir?`, ${d.ir}`:''} {d.ola_schirut_chodshi?`(${currency(d.ola_schirut_chodshi)}/ח)`:''}</option>)}
            </Select>
          </FormField>

          {/* מידע מיטות */}
          {bedInfo && (
            <div className={`flex items-center gap-2 px-3 py-2 rounded-xl border text-sm self-end mb-0.5 ${
              bedInfo.free <= 0 ? 'bg-red-50 border-red-200 text-red-700' : 'bg-slate-50 border-slate-200 text-slate-600'
            }`}>
              <Bed size={14} className="flex-shrink-0"/>
              <span>
                {bedInfo.free > 0
                  ? `${bedInfo.free} מיטות פנויות מתוך ${bedInfo.total}`
                  : `הדירה מלאה — ${bedInfo.occupied}/${bedInfo.total} מיטות`}
              </span>
              {bedInfo.free <= 0 && <AlertTriangle size={13} className="text-red-500"/>}
            </div>
          )}
          {!bedInfo && <div/>}

          {/* בחור */}
          <FormField label="בחור" required>
            <Select value={form.bochurim_id??''} onChange={onBochurChange}>
              <option value="">-- בחר בחור --</option>
              {bochurim.map(b=><option key={b.id} value={b.id}>{b.shem} {b.mishpacha}</option>)}
            </Select>
          </FormField>

          {/* אזהרת שיבוץ כפול */}
          {duplicateWarning && (
            <div className="col-span-2 flex items-center gap-2 p-3 bg-amber-50 border border-amber-200 rounded-xl">
              <AlertTriangle size={15} className="text-amber-600 flex-shrink-0"/>
              <span className="text-sm text-amber-700">
                בחור זה כבר משובץ ב: <strong>{duplicateWarning}</strong> — שמירה תסיים את השיבוץ הנוכחי ותעביר אותו
              </span>
            </div>
          )}

          {/* חלוקה אוטומטית */}
          {autoSplit ? (
            <div className="bg-teal-50 border border-teal-200 rounded-xl p-3 text-sm self-end mb-0.5">
              <p className="text-teal-700 font-semibold text-xs">חלוקה אוטומטית</p>
              <p className="text-teal-600 mt-0.5">
                {currency(autoSplit.rent)} ÷ {autoSplit.total} = <strong>{currency(autoSplit.split)}</strong>/ח׳
              </p>
            </div>
          ) : <div/>}

          <FormField label="סטטוס">
            <Select value={form.status??'פעיל'} onChange={e=>setForm(f=>({...f,status:e.target.value}))}>
              <option value="פעיל">פעיל</option>
              <option value="הסתיים">הסתיים</option>
              <option value="בהמתנה">בהמתנה</option>
            </Select>
          </FormField>
          <FormField label="חלק מהשכירות (₪) — ריק = אוטומטי">
            <Input type="number" min="0" value={form.ola_lebach??''} onChange={e=>setForm(f=>({...f,ola_lebach:e.target.value}))} placeholder={autoSplit?.split??''}/>
          </FormField>
          <FormField label="תאריך תחילה">
            <Input type="date" value={form.taarich_tchila??''} onChange={set('taarich_tchila')}/>
          </FormField>
          <FormField label="מספר חודשים (לחישוב סיום)">
            <Input type="number" min="1" max="60" placeholder="לדוגמה: 4"
              value={form.mispar_chodashim??''} onChange={set('mispar_chodashim')}/>
          </FormField>
          <FormField label="תאריך סיום">
            <Input type="date" value={form.taarich_siyum??''} onChange={e=>setForm(f=>({...f,taarich_siyum:e.target.value}))}/>
          </FormField>
        </div>
        <div className="mt-4">
          <FormField label="הערה"><Textarea value={form.heara??''} onChange={e=>setForm(f=>({...f,heara:e.target.value}))}/></FormField>
        </div>
        {!form.id && (
          <p className="text-xs text-teal-600 mt-3 bg-teal-50 rounded-lg p-2">
            ✓ שורות גבייה חודשיות יוצרו אוטומטית · חלוקת שכירות תתעדכן לכל הבחורים בדירה
          </p>
        )}
        <div className="flex justify-end gap-3 mt-6">
          <Button variant="secondary" onClick={()=>setModal(false)}>ביטול</Button>
          <Button loading={saving} onClick={save}>שמור</Button>
        </div>
      </Modal>
    </div>
  )
}
