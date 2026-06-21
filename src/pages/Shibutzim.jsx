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
const HE_MONTHS = ['ינואר','פברואר','מרץ','אפריל','מאי','יוני','יולי','אוגוסט','ספטמבר','אוקטובר','נובמבר','דצמבר']

function hebrewMonthLabel(ym) {
  const [y, m] = ym.split('-').map(Number)
  return `${HE_MONTHS[m-1]} ${String(y).slice(2)}`
}

function getMonthsInRange(start, end, maxMonths = 36) {
  if (!start) return []
  const months = []
  const s = new Date(start.slice(0,7) + '-01T12:00:00')
  const e = end ? new Date(end.slice(0,7) + '-01T12:00:00') : new Date(s)
  while (s <= e && months.length < maxMonths) {
    months.push(s.toISOString().slice(0,7))
    s.setMonth(s.getMonth() + 1)
  }
  return months
}

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
  const [capacityInfo, setCapacityInfo] = useState(null) // תפוסה לפי חודש כשיש תאריכים
  const [calcLoading, setCalcLoading]   = useState(false)
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
      supabase.from('dirot').select('id,ktovet,ir,ola_schirut_chodshi,mispar_mitot,payment_day,tchilat_schirut,sofit_schirut').order('ktovet'),
    ])
    setRows(s??[]); setBochurim(b??[]); setDirot(d??[])
    setLoading(false)
  }, [statusFilter])

  useEffect(() => { load() }, [load])

  // חישוב אוטומטי של חלק + מידע מיטות (לפי חודש אם יש תאריכים)
  async function calcSplit(dirotId, excludeId, startDate, endDate) {
    if (!dirotId) { setAutoSplit(null); setBedInfo(null); setCapacityInfo(null); setCalcLoading(false); return }
    setCalcLoading(true)
    const dira = dirot.find(d => d.id === dirotId)
    if (!dira) return

    const totalMitot = Number(dira.mispar_mitot ?? 0)

    // שלוף את כל השיבוצים לדירה פעם אחת
    const { data: allShibs } = await supabase.from('shibutzim')
      .select('taarich_tchila, taarich_siyum, status')
      .eq('dirot_id', dirotId)
      .in('status', ['פעיל', 'הסתיים'])
      .neq('id', excludeId ?? '00000000-0000-0000-0000-000000000000')

    if (startDate && totalMitot > 0) {
      // מצב עם תאריכים: הצג תפוסה לפי חודש
      const months = getMonthsInRange(startDate, endDate || startDate)
      const monthData = months.map(ym => {
        const [y, m] = ym.split('-').map(Number)
        const monthStart = `${ym}-01`
        const monthEnd   = `${ym}-${String(new Date(y, m, 0).getDate()).padStart(2,'0')}`
        const count = (allShibs ?? []).filter(s => {
          const sS = s.taarich_tchila ?? '1900-01-01'
          const sE = s.taarich_siyum  ?? '2999-12-31'
          return sS <= monthEnd && sE >= monthStart
        }).length
        return { ym, label: hebrewMonthLabel(ym), count, full: count >= totalMitot, total: totalMitot }
      })
      setCapacityInfo({ total: totalMitot, months: monthData, hasFullMonth: monthData.some(m => m.full) })
      setBedInfo(null)
    } else {
      // מצב ללא תאריכים: הצג תפוסה נוכחית פשוטה
      const occupied = (allShibs ?? []).filter(s => s.status === 'פעיל').length
      setBedInfo({ total: totalMitot, occupied, free: Math.max(0, totalMitot - occupied) })
      setCapacityInfo(null)
    }

    if (!dira.ola_schirut_chodshi) return

    // חישוב חלוקת שכירות
    let overlapCount = (allShibs ?? []).filter(s => s.status === 'פעיל').length
    if (startDate && allShibs) {
      const assignEnd = endDate ?? '2999-12-31'
      overlapCount = allShibs.filter(s => {
        const sS = s.taarich_tchila ?? '1900-01-01'
        const sE = s.taarich_siyum  ?? '2999-12-31'
        return sS <= assignEnd && sE >= startDate
      }).length
    }
    const total = overlapCount + (form.id ? 0 : 1)
    const split = total > 0 ? Math.round(Number(dira.ola_schirut_chodshi) / total) : 0
    setAutoSplit({ total, split, rent: dira.ola_schirut_chodshi, dateAware: !!startDate })
    setCalcLoading(false)
    return split
  }

  // עדכון חלוקת שכירות — חישוב לפי חודש: כמה בחורים פעילים בכל חודש בנפרד
  async function recalcBilling(dirotId, fromDate) {
    const { data: dira } = await supabase.from('dirot')
      .select('ola_schirut_chodshi').eq('id', dirotId).single()
    if (!dira?.ola_schirut_chodshi) return
    const rent = Number(dira.ola_schirut_chodshi)

    // כל השיבוצים בדירה (פעיל + הסתיים) — לצורך זיהוי חפיפה לפי חודש
    const { data: shibutzim } = await supabase.from('shibutzim')
      .select('bochurim_id, taarich_tchila, taarich_siyum, status')
      .eq('dirot_id', dirotId)
      .in('status', ['פעיל', 'הסתיים'])
    if (!shibutzim?.length) return

    // שורות גבייה לא שולמות מ-fromDate ואילך
    const fromYM = fromDate ? fromDate.slice(0, 7) : '2000-01'
    const { data: gviyaRows } = await supabase.from('gviya')
      .select('id, bochurim_id, chodesh')
      .eq('dirot_id', dirotId)
      .neq('status', 'שולם')
      .gte('chodesh', fromYM)
    if (!gviyaRows?.length) return

    // עבור כל שורת גבייה — מצא כמה בחורים חופפים לאותו חודש
    const updates = []
    for (const gviya of gviyaRows) {
      const ym = gviya.chodesh
      const [y, m] = ym.split('-').map(Number)
      const monthStart = `${ym}-01`
      const monthEnd = `${ym}-${String(new Date(y, m, 0).getDate()).padStart(2,'0')}`
      const count = shibutzim.filter(s => {
        const sStart = s.taarich_tchila ?? '1900-01-01'
        const sEnd   = s.taarich_siyum  ?? '2999-12-31'
        return sStart <= monthEnd && sEnd >= monthStart
      }).length
      const split = count > 0 ? Math.round(rent / count) : rent
      updates.push({ id: gviya.id, bochurimId: gviya.bochurim_id, skhum: split })
    }

    // עדכון במקביל (ולא סדרתי)
    await Promise.all(updates.map(u =>
      supabase.from('gviya').update({ skhum: u.skhum }).eq('id', u.id)
    ))

    const uniqueSplits = [...new Set(updates.map(u => u.skhum))]
    if (uniqueSplits.length === 1) {
      toast(`חלוקה עודכנה: ${currency(uniqueSplits[0])}/חודש לכל בחור`)
    } else {
      toast(`חלוקה עודכנה לפי חודשים (${updates.length} שורות עודכנו)`)
    }
  }

  const filtered = rows.filter(r => {
    const name = `${r.bochurim?.shem??''} ${r.bochurim?.mishpacha??''}`
    const addr = `${r.dirot?.ktovet??''} ${r.dirot?.ir??''}`
    return `${name} ${addr}`.toLowerCase().includes(search.toLowerCase())
  })

  function openNew()  {
    setForm(EMPTY); setAutoSplit(null); setBedInfo(null); setCapacityInfo(null)
    setOriginalSiyum(null); setDuplicateWarning(null)
    setModal(true)
  }
  function openEdit(r){
    setForm({ ...EMPTY, ...r, taarich_tchila: toInputDate(r.taarich_tchila), taarich_siyum: toInputDate(r.taarich_siyum) })
    setAutoSplit(null); setBedInfo(null); setCapacityInfo(null); setDuplicateWarning(null)
    setOriginalSiyum(r.taarich_siyum ? toInputDate(r.taarich_siyum) : null)
    setModal(true)
    if (r.dirot_id) calcSplit(r.dirot_id, r.id, r.taarich_tchila ? toInputDate(r.taarich_tchila) : null, r.taarich_siyum ? toInputDate(r.taarich_siyum) : null)
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
      // חשב תאריכים מעודכנים לצורך calcSplit
      let newStart = form.taarich_tchila
      let newEnd   = form.taarich_siyum
      if (field === 'taarich_tchila') {
        newStart = val
        const end = calcEndDate(val, form.mispar_chodashim)
        if (end) newEnd = end
      } else if (field === 'mispar_chodashim') {
        const end = calcEndDate(form.taarich_tchila, val)
        if (end) newEnd = end
      }
      setForm(f => {
        const next = { ...f, [field]: val }
        if (field === 'taarich_tchila' || field === 'mispar_chodashim') {
          const start  = field === 'taarich_tchila'   ? val : f.taarich_tchila
          const months = field === 'mispar_chodashim' ? val : f.mispar_chodashim
          const end = calcEndDate(start, months)
          if (end) next.taarich_siyum = end
        }
        return next
      })
      if (field === 'dirot_id') {
        calcSplit(val, form.id, form.taarich_tchila, form.taarich_siyum)
      } else if (['taarich_tchila', 'mispar_chodashim'].includes(field) && form.dirot_id) {
        calcSplit(form.dirot_id, form.id, newStart, newEnd)
      }
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

    // ── ולידציה: תאריכי שיבוץ בתוך טווח חוזה הדירה ──
    const selDira = dirot.find(d => d.id === form.dirot_id)
    if (selDira?.tchilat_schirut && form.taarich_tchila && form.taarich_tchila < selDira.tchilat_schirut) {
      toast(`תאריך תחילה מוקדם מתחילת חוזה הדירה (${formatDate(selDira.tchilat_schirut)})`, 'error')
      return
    }
    if (selDira?.sofit_schirut && form.taarich_siyum && form.taarich_siyum > selDira.sofit_schirut) {
      toast(`תאריך סיום חורג מסיום חוזה הדירה (${formatDate(selDira.sofit_schirut)})`, 'error')
      return
    }

    setSaving(true)
    const isNew = !form.id

    // ── בדיקת מיטות פנויות לפי חודש (גם בשיבוץ חדש וגם בעריכה) ──
    const dira = dirot.find(d => d.id === form.dirot_id)
    if (dira?.mispar_mitot) {
      const { data: existingShibs } = await supabase.from('shibutzim')
        .select('taarich_tchila, taarich_siyum')
        .eq('dirot_id', form.dirot_id)
        .in('status', ['פעיל', 'הסתיים'])
        .neq('id', form.id ?? '00000000-0000-0000-0000-000000000000')
      const totalMitot = Number(dira.mispar_mitot)
      if (form.taarich_tchila) {
        const rangeMonths = getMonthsInRange(form.taarich_tchila, form.taarich_siyum || form.taarich_tchila)
        const fullMonth = rangeMonths.find(ym => {
          const [y, m] = ym.split('-').map(Number)
          const monthStart = `${ym}-01`
          const monthEnd   = `${ym}-${String(new Date(y, m, 0).getDate()).padStart(2,'0')}`
          const count = (existingShibs ?? []).filter(s => {
            const sS = s.taarich_tchila ?? '1900-01-01'
            const sE = s.taarich_siyum  ?? '2999-12-31'
            return sS <= monthEnd && sE >= monthStart
          }).length
          return count >= totalMitot
        })
        if (fullMonth) {
          toast(`הדירה מלאה בחודש ${hebrewMonthLabel(fullMonth)} — ${totalMitot}/${totalMitot} מיטות תפוסות`, 'error')
          setSaving(false); return
        }
      } else if (isNew) {
        // אין תאריך ושיבוץ חדש — בדיקת תפוסה נוכחית
        const occupied = (existingShibs ?? []).filter(s => !s.taarich_siyum || s.taarich_siyum >= new Date().toISOString().slice(0,10)).length
        if (occupied >= totalMitot) {
          toast(`אין מיטות פנויות — הדירה מלאה (${occupied}/${totalMitot})`, 'error')
          setSaving(false); return
        }
      }
    }

    if (isNew) {

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

    // ── בדיקה לפני שמירה: קיצור תקופת שיבוץ → שאל על שורות גבייה ──
    if (!isNew && form.taarich_siyum && originalSiyum && form.taarich_siyum !== originalSiyum) {
      const newEnd = new Date(form.taarich_siyum + 'T12:00:00')
      const oldEnd = new Date(originalSiyum + 'T12:00:00')
      if (newEnd < oldEnd) {
        const newEndYM = form.taarich_siyum.slice(0, 7)
        const { data: extraGviya } = await supabase.from('gviya')
          .select('id, status, chodesh')
          .eq('bochurim_id', form.bochurim_id)
          .eq('dirot_id', form.dirot_id)
          .gt('chodesh', newEndYM)
        if (extraGviya?.length > 0) {
          const paid = extraGviya.filter(r => r.status === 'שולם').length
          const unpaid = extraGviya.length - paid
          const paidNote = paid > 0 ? `\n⚠️ ${paid} מהן כבר שולמו!` : ''
          const ok = await confirm(
            `הקיצור ייסיר ${extraGviya.length} שורות גבייה (${unpaid} לא שולמו${paidNote}).\n\nהאם למחוק אותן?`,
            { danger: true, confirmText: 'מחק', cancelText: 'ביטול (שמור חודשים)' }
          )
          if (!ok) { setSaving(false); return }
        }
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
            .gt('chodesh', newEndYM)
            .select('id')
          if (deleted?.length)
            toast(`נמחקו ${deleted.length} שורות גבייה`)
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

    // רענון נוסף אחרי סיום כל פעולות הגבייה
    load(true)
  }

  async function remove(id) {
    const row = rows.find(r => r.id === id)
    const name = row?.bochurim ? `${row.bochurim.shem??''} ${row.bochurim.mishpacha??''}`.trim() : ''
    if (!await confirm(`למחוק שיבוץ זה${name ? ` של ${name}` : ''}?`, { danger: true })) return

    // בדוק שורות גבייה קשורות
    let needsRecalc = false
    if (row?.bochurim_id && row?.dirot_id) {
      const { data: gviyaRows } = await supabase.from('gviya')
        .select('id, status')
        .eq('bochurim_id', row.bochurim_id)
        .eq('dirot_id', row.dirot_id)
      if (gviyaRows?.length > 0) {
        const paid   = gviyaRows.filter(r => r.status === 'שולם').length
        const unpaid = gviyaRows.length - paid
        const paidNote = paid > 0 ? `\n⚠️ ${paid} מהן כבר שולמו!` : ''
        const delGviya = await confirm(
          `יש ${gviyaRows.length} שורות גבייה לשיבוץ זה (${unpaid} לא שולמו${paidNote}).\n\nהאם למחוק גם את שורות הגבייה?`,
          { danger: true, confirmText: 'מחק הכל', cancelText: 'שמור גבייה' }
        )
        if (delGviya) {
          await supabase.from('gviya').delete()
            .eq('bochurim_id', row.bochurim_id)
            .eq('dirot_id', row.dirot_id)
          needsRecalc = true
        }
      }
    }

    await supabase.from('shibutzim').delete().eq('id', id)

    // עדכון חלוקה לשאר הבחורים בדירה — רק אם הגבייה נמחקה
    if (needsRecalc && row?.dirot_id) {
      await recalcBilling(row.dirot_id, row.taarich_tchila ?? new Date().toISOString().slice(0,10))
    }

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

  // חישוב מספר הבחורים הפעילים בכל דירה בחודש הנוכחי — לצורך הצגת חלק נכון בטבלה
  const currentYM = new Date().toISOString().slice(0,7)
  const [cY, cM] = currentYM.split('-').map(Number)
  const cMonthStart = `${currentYM}-01`
  const cMonthEnd = `${currentYM}-${String(new Date(cY, cM, 0).getDate()).padStart(2,'0')}`
  const diraCounts = {}
  rows.forEach(r => {
    if (!r.dirot_id || !['פעיל', 'הסתיים'].includes(r.status)) return
    const s = r.taarich_tchila ?? '1900-01-01'
    const e = r.taarich_siyum  ?? '2999-12-31'
    if (s <= cMonthEnd && e >= cMonthStart) {
      diraCounts[r.dirot_id] = (diraCounts[r.dirot_id] ?? 0) + 1
    }
  })

  const columns = [
    { key:'bochurim', label:'בחור',  render:v => v ? `${v.shem??''} ${v.mishpacha??''}`.trim() : '—' },
    { key:'dirot',    label:'דירה',  render:v => v ? `${v.ktovet??''}, ${v.ir??''}` : '—' },
    { key:'ola_lebach', label:'חלק ₪', render:(_, row) => {
      const rent = Number(row.dirot?.ola_schirut_chodshi ?? 0)
      const count = diraCounts[row.dirot_id] ?? 0
      if (rent > 0 && count > 0) return currency(Math.round(rent / count))
      return currency(row.ola_lebach)
    }},
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

      <Modal open={modal} onClose={()=>setModal(false)} title={form.id ? 'עריכת שיבוץ' : 'שיבוץ חדש'} size="lg">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-start">

          {/* דירה קודם */}
          <FormField label="דירה" required>
            <Select value={form.dirot_id??''} onChange={e => { set('dirot_id')(e); calcSplit(e.target.value, form.id) }}>
              <option value="">-- בחר דירה --</option>
              {dirot.map(d=><option key={d.id} value={d.id}>{d.ktovet}{d.ir?`, ${d.ir}`:''} {d.ola_schirut_chodshi?`(${currency(d.ola_schirut_chodshi)}/ח)`:''}</option>)}
            </Select>
          </FormField>

          {/* תקופת חוזה הדירה */}
          {(() => {
            const sd = dirot.find(d => d.id === form.dirot_id)
            if (!sd || (!sd.tchilat_schirut && !sd.sofit_schirut)) return <div/>
            return (
              <div className="col-span-2 flex items-center gap-2 px-3 py-2 rounded-xl border border-blue-200 bg-blue-50 text-sm text-blue-700">
                <span className="text-base">📅</span>
                <span>חוזה דירה: <strong>{sd.tchilat_schirut ? formatDate(sd.tchilat_schirut) : '—'}</strong> עד <strong>{sd.sofit_schirut ? formatDate(sd.sofit_schirut) : '—'}</strong></span>
              </div>
            )
          })()}

          {/* מידע מיטות — לפי חודש אם יש תאריכים, אחרת תפוסה נוכחית */}
          {capacityInfo ? (
            <div className={`col-span-2 rounded-xl border p-4 ${
              capacityInfo.hasFullMonth ? 'bg-red-50 border-red-200' : 'bg-emerald-50 border-emerald-200'
            }`}>
              {/* כותרת */}
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Bed size={16} className={capacityInfo.hasFullMonth ? 'text-red-500' : 'text-emerald-600'}/>
                  <span className="font-semibold text-sm text-slate-700">זמינות לפי חודשים — {capacityInfo.total} מיטות</span>
                </div>
                {capacityInfo.hasFullMonth ? (
                  <span className="flex items-center gap-1 text-xs font-medium text-red-600 bg-red-100 border border-red-200 px-2 py-0.5 rounded-full">
                    <AlertTriangle size={11}/> יש חודשים מלאים
                  </span>
                ) : (
                  <span className="text-xs font-medium text-emerald-700 bg-emerald-100 border border-emerald-200 px-2 py-0.5 rounded-full">
                    ✓ כל החודשים פנויים
                  </span>
                )}
              </div>
              {/* רשת חודשים */}
              <div className="grid gap-2" style={{gridTemplateColumns: `repeat(${Math.min(capacityInfo.months.length, 6)}, 1fr)`}}>
                {capacityInfo.months.map(mo => {
                  const free = mo.total - mo.count
                  return (
                    <div key={mo.ym} className={`rounded-xl p-2.5 text-center border ${
                      mo.full
                        ? 'bg-red-100 border-red-300'
                        : free === 1
                          ? 'bg-amber-50 border-amber-200'
                          : 'bg-white border-emerald-200'
                    }`}>
                      <div className={`text-xs font-bold mb-1 ${mo.full ? 'text-red-700' : free === 1 ? 'text-amber-700' : 'text-slate-700'}`}>
                        {mo.label}
                      </div>
                      <div className={`text-lg leading-none ${mo.full ? 'text-red-600' : free === 1 ? 'text-amber-600' : 'text-emerald-600'}`}>
                        {mo.full ? '🔴' : free === 1 ? '⚠️' : '✓'}
                      </div>
                      <div className={`text-xs mt-1 ${mo.full ? 'text-red-600' : free === 1 ? 'text-amber-600' : 'text-emerald-600'}`}>
                        {mo.full ? 'מלאה' : `${free} פנויות`}
                      </div>
                      <div className="text-xs text-slate-400 mt-0.5">{mo.count}/{mo.total} תפוס</div>
                    </div>
                  )
                })}
              </div>
            </div>
          ) : bedInfo ? (
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
          ) : <div/>}

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
              <p className="text-teal-700 font-semibold text-xs">
                חלוקה אוטומטית{autoSplit.dateAware ? ' — לפי תאריכי השיבוץ' : ''}
              </p>
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
            <Input type="date" value={form.taarich_tchila??''}
              min={dirot.find(d=>d.id===form.dirot_id)?.tchilat_schirut ?? undefined}
              max={dirot.find(d=>d.id===form.dirot_id)?.sofit_schirut ?? undefined}
              onChange={set('taarich_tchila')}/>
          </FormField>
          <FormField label="מספר חודשים (לחישוב סיום)">
            <Input type="number" min="1" max="60" placeholder="לדוגמה: 4"
              value={form.mispar_chodashim??''} onChange={set('mispar_chodashim')}/>
          </FormField>
          <FormField label="תאריך סיום">
            <Input type="date" value={form.taarich_siyum??''}
              min={form.taarich_tchila || dirot.find(d=>d.id===form.dirot_id)?.tchilat_schirut || undefined}
              max={dirot.find(d=>d.id===form.dirot_id)?.sofit_schirut ?? undefined}
              onChange={e => {
                const val = e.target.value
                setForm(f => ({ ...f, taarich_siyum: val }))
                if (form.dirot_id && form.taarich_tchila) {
                  calcSplit(form.dirot_id, form.id, form.taarich_tchila, val)
                }
              }}/>
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
          <Button
            loading={saving || calcLoading}
            disabled={capacityInfo?.hasFullMonth}
            title={capacityInfo?.hasFullMonth ? 'לא ניתן לשמור — יש חודשים עם תפוסה מלאה' : undefined}
            onClick={save}
          >שמור</Button>
        </div>
      </Modal>
    </div>
  )
}
