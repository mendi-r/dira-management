import React, { useEffect, useState, useCallback } from 'react'
import { useSearchParams } from 'react-router-dom'
import { PlusCircle, Edit2, Trash2, MapPin, ExternalLink, Download, RefreshCw } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useRealtime } from '../hooks/useRealtime'
import { formatDate, toInputDate, calcLeaseEnd, daysUntil, currency, logActivity } from '../lib/utils'
import { confirm } from '../lib/confirm'
import { toHebrewDate } from '../components/ui/DualDateField'
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
  arnona:'', status:'פעיל', status_vaad:'', luch_shanah:'לועזי', heara:'',
  baalim_shem:'', baalim_telefon1:'', baalim_telefon2:'', baalim_email:'',
  baalim_ktovet_rechov:'', baalim_ktovet_ir:'',
  ola_schirut_chodshi:'', tchilat_schirut:'', mispar_chodashim:'', sofit_schirut:'',
  hearot_chozeh:'',
  payment_method:'', payment_day:'', payment_source:'', payment_bank_details:'',
  bituach_chevra:'', bituach_polisa:'', bituach_chadush:'',
  google_maps_link:'', drive_link:'',
}

const STATUS_COLORS = { פעיל:'green', ריק:'yellow', 'לא_זמין':'red', 'לא_פעיל':'gray' }

const TABS = [
  { key:'dira',    label:'פרטי דירה' },
  { key:'baalim',  label:'בעלים' },
  { key:'chozeh',  label:'חוזה ותשלום' },
  { key:'bituach', label:'ביטוח' },
  { key:'docs',    label:'מסמכים' },
  { key:'chozim',  label:'היסטוריית חוזים' },
  { key:'history', label:'שיבוצים' },
]

import { useAuth } from '../contexts/AuthContext'
export default function Dirot() {
  const { isSuperAdmin, viewAsOwnerId } = useAuth()
  const toast = useToast()
  const [searchParams] = useSearchParams()
  const [rows, setRows]         = useState([])
  const [loading, setLoading]   = useState(true)
  const [search, setSearch]     = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [alertFilter, setAlertFilter] = useState(searchParams.get('alert') ?? '')
  const [freeBedFilter, setFreeBedFilter] = useState(searchParams.get('free_beds') === 'true')
  const [occupantsMap, setOccupantsMap] = useState({})
  const [modal, setModal]       = useState(false)
  const [form, setForm]         = useState(EMPTY)
  const [activeTab, setActiveTab] = useState('dira')
  const [saving, setSaving]     = useState(false)
  const [history, setHistory]   = useState([])
  const [alerts, setAlerts]     = useState([])
  const [originalRent, setOriginalRent] = useState(null)
  const [originalMisparChodashim, setOriginalMisparChodashim] = useState(null)
  const [renewModal, setRenewModal] = useState(false)
  const [renewForm, setRenewForm]   = useState({ tchilat_schirut:'', mispar_chodashim:'', ola_schirut_chodshi:'', hearot_chozeh:'' })
  const [renewSaving, setRenewSaving] = useState(false)
  const [chozim, setChozim]           = useState([])
  const [chozimCountMap, setChozimCountMap] = useState({})
  const [currentRentMap, setCurrentRentMap] = useState({})
  const [availabilityMap, setAvailabilityMap] = useState({})
  const [availPopup, setAvailPopup]   = useState(null) // dirot_id
  const [editChoza, setEditChoza]     = useState(null)
  const [editChozaForm, setEditChozaForm] = useState({})
  const [editChozaSaving, setEditChozaSaving] = useState(false)

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true)
    let q = supabase.from('dirot').select('*').order('ktovet')
    if (statusFilter) q = q.eq('status', statusFilter)
    const [{ data }, { data: activeShibutzim }, { data: chozimAll }] = await Promise.all([
      q,
      supabase.from('shibutzim').select('dirot_id, taarich_siyum').eq('status','פעיל'),
      supabase.from('chozim').select('dirot_id, tchilat_schirut, sofit_schirut, ola_schirut_chodshi'),
    ])
    const rows = data ?? []
    // ספירת משובצים פעילים לכל דירה
    const oMap = {}
    ;(activeShibutzim ?? []).forEach(s => {
      if (s.dirot_id) oMap[s.dirot_id] = (oMap[s.dirot_id] ?? 0) + 1
    })
    setOccupantsMap(oMap)
    // ספירת חוזים לכל דירה
    const cMap = {}
    ;(chozimAll ?? []).forEach(c => {
      if (c.dirot_id) cMap[c.dirot_id] = (cMap[c.dirot_id] ?? 0) + 1
    })
    setChozimCountMap(cMap)
    // שכירות נכון לחודש הנוכחי — לפי חוזה פעיל
    const currentYM = new Date().toISOString().slice(0,7)
    const rMap = {}
    ;(chozimAll ?? []).forEach(c => {
      const from = c.tchilat_schirut?.slice(0,7)
      const to   = c.sofit_schirut?.slice(0,7) ?? '2999-12' // חוזה פתוח ללא תאריך סיום = תמיד פעיל
      if (from && from <= currentYM && to >= currentYM && c.ola_schirut_chodshi) {
        rMap[c.dirot_id] = c.ola_schirut_chodshi
      }
    })
    setCurrentRentMap(rMap)

    // ── חישוב חלונות זמינות מיטות לפי דירה ──
    const todayStr = new Date().toISOString().slice(0, 10)
    function dayAfter(dateStr) {
      const d = new Date(dateStr + 'T12:00:00'); d.setDate(d.getDate() + 1); return d.toISOString().slice(0, 10)
    }
    const avMap = {}
    rows.forEach(d => {
      const sofit = d.sofit_schirut
      if (!sofit || sofit <= todayStr) return
      const totalBeds = Number(d.mispar_mitot ?? 0)
      if (!totalBeds) return
      const diraShib = (activeShibutzim ?? []).filter(s => s.dirot_id === d.id)
      const currentFree = totalBeds - diraShib.length
      const endingShib = diraShib
        .filter(s => s.taarich_siyum && s.taarich_siyum < sofit)
        .sort((a, b) => a.taarich_siyum.localeCompare(b.taarich_siyum))
      if (currentFree === 0 && endingShib.length === 0) return
      const milestones = []
      if (currentFree > 0) milestones.push({ fromDate: todayStr, freeBeds: currentFree, isNow: true })
      const uniqueEnds = [...new Set(endingShib.map(s => s.taarich_siyum))]
      uniqueEnds.forEach(endDate => {
        const stillActive = diraShib.filter(sh => !sh.taarich_siyum || sh.taarich_siyum > endDate).length
        const free = totalBeds - stillActive
        if (free > 0) milestones.push({ fromDate: dayAfter(endDate), freeBeds: free, isNow: false })
      })
      if (milestones.length > 0) avMap[d.id] = { sofit, milestones }
    })
    setAvailabilityMap(avMap)

    setRows(rows)
    const warn = rows.filter(r => {
      const dc = r.sofit_schirut ? daysUntil(r.sofit_schirut) : null
      const db = r.bituach_chadush ? daysUntil(r.bituach_chadush) : null
      return (dc !== null && dc <= 30 && dc >= 0) || (db !== null && db <= 30 && db >= 0)
    })
    setAlerts(warn)
    setLoading(false)
  }, [statusFilter])

  useEffect(() => { load() }, [load])
  useEffect(() => { if (isSuperAdmin) load(false) }, [viewAsOwnerId])
  // סנכרון זמן-אמת
  useRealtime('dirot', () => { load(true) })


  async function loadHistory(dirotId) {
    const [{ data: shibs }, { data: chozimRows }] = await Promise.all([
      supabase.from('shibutzim')
        .select('*, bochurim!bochurim_id(shem,mishpacha)')
        .eq('dirot_id', dirotId)
        .order('taarich_tchila', { ascending: false }),
      supabase.from('chozim')
        .select('*')
        .eq('dirot_id', dirotId)
        .order('tchilat_schirut', { ascending: false }),
    ])
    setHistory(shibs ?? [])
    setChozim(chozimRows ?? [])
  }

  const filtered = rows.filter(r => {
    const textMatch = `${r.ktovet??''} ${r.ir??''} ${r.mishkan??''} ${r.mazkir??''} ${r.baalim_shem??''}`
      .toLowerCase().includes(search.toLowerCase())
    const alertMatch = !alertFilter ||
      (alertFilter === 'contract' && daysUntil(r.sofit_schirut) !== null && (daysUntil(r.sofit_schirut)??999) <= 30) ||
      (alertFilter === 'insurance' && daysUntil(r.bituach_chadush) !== null && (daysUntil(r.bituach_chadush)??999) <= 30)
    const freeBedMatch = !freeBedFilter ||
      ((r.mispar_mitot ?? 0) - (occupantsMap[r.id] ?? 0)) > 0 ||
      !!availabilityMap[r.id]  // מתפנות בעתיד
    return textMatch && alertMatch && freeBedMatch
  })

  function openNew()  { setForm(EMPTY); setActiveTab('dira'); setHistory([]); setOriginalRent(null); setOriginalMisparChodashim(null); setModal(true) }
  async function openEdit(r){
    setForm({
      ...EMPTY, ...r,
      tchilat_schirut: toInputDate(r.tchilat_schirut),
      sofit_schirut:   toInputDate(r.sofit_schirut),
      bituach_chadush: toInputDate(r.bituach_chadush),
      hearot_chozeh: '',
    })
    setOriginalRent(r.ola_schirut_chodshi ?? null)
    setOriginalMisparChodashim(r.mispar_chodashim ?? null)
    setActiveTab('dira')
    if (r.id) {
      loadHistory(r.id)
      // טעינת הערות החוזה הפעיל האחרון
      const { data: latestChozeh } = await supabase.from('chozim')
        .select('hearot').eq('dirot_id', r.id)
        .order('tchilat_schirut', { ascending: false }).limit(1).single()
      if (latestChozeh?.hearot) setForm(f => ({ ...f, hearot_chozeh: latestChozeh.hearot }))
    }
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
    const isNewDira = !form.id
    if (isNewDira && !form.mispar_mitot)         { toast('כמות מיטות חובה', 'error'); setActiveTab('dira'); return }
    if (isNewDira && !form.ola_schirut_chodshi)  { toast('עלות שכירות חודשית חובה', 'error'); setActiveTab('chozeh'); return }
    if (isNewDira && !form.tchilat_schirut)      { toast('תאריך תחילת חוזה חובה', 'error'); setActiveTab('chozeh'); return }
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

    // ── בדיקה לפני שמירה: קיצור חודשי שכירות ──
    if (form.id && payload.mispar_chodashim && originalMisparChodashim &&
        payload.mispar_chodashim < Number(originalMisparChodashim) &&
        form.tchilat_schirut) {
      const cutoffYM = monthAt(form.tchilat_schirut, payload.mispar_chodashim)
      const { data: extraRows } = await supabase.from('tashlumim_baalim')
        .select('id, status, chodesh')
        .eq('dirot_id', form.id)
        .gte('chodesh', cutoffYM)
      if (extraRows?.length > 0) {
        const paid = extraRows.filter(r => r.status === 'שולם').length
        const unpaid = extraRows.length - paid
        const paidNote = paid > 0 ? `\n⚠️ ${paid} מהן כבר שולמו!` : ''
        const ok = await confirm(
          `הקיצור מ-${originalMisparChodashim} ל-${payload.mispar_chodashim} חודשים ייסיר ${extraRows.length} תשלומים לבעלים (${unpaid} לא שולמו${paidNote}).\n\nהאם למחוק אותם?`,
          { danger: true, confirmText: 'מחק', cancelText: 'ביטול' }
        )
        if (!ok) { setSaving(false); return }
      }
    }

    const isNew = !form.id
    const { data, error } = isNew
      ? await supabase.from('dirot').insert(payload).select().single()
      : await supabase.from('dirot').update(payload).eq('id', form.id).select().single()
    setSaving(false)
    if (error) { toast(error.message, 'error'); return }
    logActivity(isNew ? 'INSERT' : 'UPDATE', 'dirot', data.id, form.ktovet)

    // ── פידבק מיידי למשתמש ──
    toast(isNew ? 'דירה נוספה' : 'עודכן')
    setModal(false)
    if (isNew) {
      setForm(f => ({ ...f, id: data.id }))
      // הוסף מיד לרשימה המקומית — אפס המתנה
      setRows(prev => [...prev, data].sort((a,b) => (a.ktovet??'').localeCompare(b.ktovet??'','he')))
    } else {
      setRows(prev => prev.map(r => r.id === data.id ? { ...r, ...data } : r))
    }

    // ── פעולות רקע (לא חוסמות את ה-UI) ──
    ;(async () => {
      // עדכון רטרואקטיבי — כשסכום שכירות משתנה, עדכן שורות גבייה פתוחות
      const rentChanged = payload.ola_schirut_chodshi !== null &&
        payload.ola_schirut_chodshi !== Number(originalRent)
      if (!isNew && rentChanged) {
        const { count: occupants } = await supabase
          .from('shibutzim')
          .select('*', { count: 'exact', head: true })
          .eq('dirot_id', data.id)
          .eq('status', 'פעיל')
        if (occupants > 0) {
          const newSplit = Math.round(payload.ola_schirut_chodshi / occupants)
          const { data: updated } = await supabase
            .from('gviya')
            .update({ skhum: newSplit })
            .eq('dirot_id', data.id)
            .eq('status', 'לא שולם')
            .select('id')
          if (updated?.length > 0)
            toast(`עודכנו ${updated.length} שורות גבייה ל-₪${newSplit.toLocaleString('he-IL')}/ח`)
        }
      }

      // יצירת תשלומים לבעלים אוטומטית לדירה חדשה
      if (isNew && payload.tchilat_schirut && payload.mispar_chodashim && payload.ola_schirut_chodshi) {
        await createOwnerPayments(data.id, payload.tchilat_schirut, payload.mispar_chodashim,
          payload.ola_schirut_chodshi, payload.payment_day ?? 1)
        await supabase.from('chozim').insert({
          dirot_id: data.id,
          tchilat_schirut: payload.tchilat_schirut,
          sofit_schirut: payload.sofit_schirut || null,
          mispar_chodashim: payload.mispar_chodashim,
          ola_schirut_chodshi: payload.ola_schirut_chodshi,
          hearot: payload.hearot_chozeh || null,
          status: 'פעיל',
        })
      }

      // הגדלת חודשי שכירות
      if (!isNew && payload.mispar_chodashim && payload.tchilat_schirut &&
          payload.mispar_chodashim > Number(originalMisparChodashim ?? 0)) {
        await addOwnerPaymentMonths(
          data.id, payload.tchilat_schirut,
          Number(originalMisparChodashim ?? 0), payload.mispar_chodashim,
          payload.ola_schirut_chodshi, payload.payment_day ?? 1
        )
      }

      // קיצור חודשי שכירות
      if (!isNew && payload.mispar_chodashim && originalMisparChodashim &&
          payload.mispar_chodashim < Number(originalMisparChodashim) &&
          payload.tchilat_schirut) {
        const cutoffYM = monthAt(payload.tchilat_schirut, payload.mispar_chodashim)
        await supabase.from('tashlumim_baalim')
          .delete()
          .eq('dirot_id', data.id)
          .gte('chodesh', cutoffYM)
      }

      load(true)
    })()
  }

  /** יצירת שורות תשלום לבעלים לכל חודשי השכירות */
  async function createOwnerPayments(dirotId, start, months, skhum, payDay) {
    // בדיקת שורות קיימות
    const { count } = await supabase.from('tashlumim_baalim')
      .select('*', { count:'exact', head:true })
      .eq('dirot_id', dirotId)
    if (count > 0) return // כבר קיימות שורות

    const startD = new Date(start + 'T12:00:00')
    const rows = []
    for (let i = 0; i < Number(months); i++) {
      const d = new Date(startD.getFullYear(), startD.getMonth() + i, 1)
      const y = d.getFullYear(), m = d.getMonth() + 1
      const daysInMonth = new Date(y, m, 0).getDate()
      const day = Math.min(Number(payDay), daysInMonth)
      rows.push({
        dirot_id: dirotId,
        skhum: Number(skhum),
        taarich: `${y}-${String(m).padStart(2,'0')}-${String(day).padStart(2,'0')}`,
        chodesh: `${y}-${String(m).padStart(2,'0')}`,
        payment_day: day,
        status: 'לא שולם',
      })
    }
    if (rows.length > 0) {
      await supabase.from('tashlumim_baalim').insert(rows)
      toast(`נוצרו ${rows.length} שורות תשלום לבעלים`)
    }
  }

  /** YYYY-MM של החודש ה-`index` מ-`start` (0 = חודש ראשון) */
  function monthAt(start, index) {
    const d = new Date(start + 'T12:00:00')
    d.setMonth(d.getMonth() + index)
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`
  }

  /** יצירת שורות תשלום לבעלים רק עבור חודשים fromIdx..toIdx-1 (הגדלת תקופה) */
  async function addOwnerPaymentMonths(dirotId, start, fromIdx, toIdx, skhum, payDay) {
    const rows = []
    for (let i = fromIdx; i < toIdx; i++) {
      const d = new Date(start + 'T12:00:00')
      d.setMonth(d.getMonth() + i)
      const y = d.getFullYear(), m = d.getMonth() + 1
      const ym = `${y}-${String(m).padStart(2,'0')}`
      const daysInMonth = new Date(y, m, 0).getDate()
      const day = Math.min(Number(payDay || 1), daysInMonth)
      rows.push({
        dirot_id: dirotId,
        skhum: Number(skhum),
        taarich: `${ym}-${String(day).padStart(2,'0')}`,
        chodesh: ym,
        payment_day: day,
        status: 'לא שולם',
      })
    }
    if (rows.length > 0) {
      const { error } = await supabase.from('tashlumim_baalim').insert(rows)
      if (!error) toast(`נוצרו ${rows.length} תשלומים חדשים לבעלים`)
    }
  }

  /** עדכון גבייה לפי חודש עם שכירות חדשה — זהה ללוגיקה בשיבוצים */
  async function recalcGviyaForDira(dirotId, rent, fromDate) {
    const { data: shibutzim } = await supabase.from('shibutzim')
      .select('bochurim_id, taarich_tchila, taarich_siyum')
      .eq('dirot_id', dirotId)
      .in('status', ['פעיל', 'הסתיים'])
    if (!shibutzim?.length) return
    const fromYM = fromDate ? fromDate.slice(0, 7) : '2000-01'
    const { data: gviyaRows } = await supabase.from('gviya')
      .select('id, chodesh')
      .eq('dirot_id', dirotId)
      .neq('status', 'שולם')
      .gte('chodesh', fromYM)
    if (!gviyaRows?.length) return
    for (const g of gviyaRows) {
      const ym = g.chodesh
      const [y, m] = ym.split('-').map(Number)
      const monthStart = `${ym}-01`
      const monthEnd = `${ym}-${String(new Date(y, m, 0).getDate()).padStart(2,'0')}`
      const count = shibutzim.filter(s => {
        const sStart = s.taarich_tchila ?? '1900-01-01'
        const sEnd   = s.taarich_siyum  ?? '2999-12-31'
        return sStart <= monthEnd && sEnd >= monthStart
      }).length
      await supabase.from('gviya').update({ skhum: count > 0 ? Math.round(rent / count) : rent }).eq('id', g.id)
    }
    toast('עודכנו תנועות גבייה לפי שכירות חדשה')
  }

  /** חידוש חוזה — תקופה חדשה על אותה דירה */
  async function renewContract() {
    const { tchilat_schirut, mispar_chodashim, ola_schirut_chodshi } = renewForm
    if (!tchilat_schirut || !mispar_chodashim || !ola_schirut_chodshi) {
      toast('יש למלא תאריך תחילה, מספר חודשים וסכום', 'error'); return
    }
    // ולידציה: תאריך תחילה לא יכול להיות לפני סיום החוזה הנוכחי
    if (form.sofit_schirut && tchilat_schirut < form.sofit_schirut) {
      toast(`תאריך תחילה חייב להיות ${formatDate(form.sofit_schirut)} או אחריו`, 'error'); return
    }
    const newEnd    = calcLeaseEnd(tchilat_schirut, mispar_chodashim)
    const newRent   = Number(ola_schirut_chodshi)
    const newMonths = Number(mispar_chodashim)

    const ok = await confirm(
      `חידוש חוזה לדירה ${form.ktovet}:\n` +
      `תחילה: ${formatDate(tchilat_schirut)}\n` +
      `סיום: ${formatDate(newEnd)}\n` +
      `עלות: ${currency(newRent)}/חודש\n\n` +
      `יווצרו ${newMonths} שורות תשלום חדשות לבעלים.`,
      { confirmText: 'חדש חוזה', cancelText: 'ביטול' }
    )
    if (!ok) return

    setRenewSaving(true)
    const { error } = await supabase.from('dirot').update({
      tchilat_schirut,
      mispar_chodashim: newMonths,
      sofit_schirut: newEnd || null,
      ola_schirut_chodshi: newRent,
    }).eq('id', form.id)
    if (error) { toast(error.message, 'error'); setRenewSaving(false); return }

    // יצירת שורות תשלום לבעלים לתקופה החדשה
    await addOwnerPaymentMonths(form.id, tchilat_schirut, 0, newMonths, newRent, form.payment_day ?? 1)

    // עדכון גבייה אם השכירות השתנתה
    if (newRent !== Number(form.ola_schirut_chodshi)) {
      await recalcGviyaForDira(form.id, newRent, tchilat_schirut)
    }

    // הוספת חוזה חדש להיסטוריה — סטטוס מחושב אוטומטית מהתאריכים בטאב
    await supabase.from('chozim').insert({
      dirot_id: form.id,
      tchilat_schirut,
      sofit_schirut: newEnd || null,
      mispar_chodashim: newMonths,
      ola_schirut_chodshi: newRent,
      hearot: renewForm.hearot_chozeh || null,
    })

    logActivity('RENEW', 'dirot', form.id, form.ktovet)
    toast('החוזה חודש בהצלחה')
    setRenewSaving(false)
    setRenewModal(false)
    setForm(f => ({ ...f, tchilat_schirut, mispar_chodashim: newMonths, sofit_schirut: newEnd || '', ola_schirut_chodshi: newRent }))
    setOriginalRent(newRent)
    setOriginalMisparChodashim(newMonths)
    loadHistory(form.id)
    load(true)
  }

  /** שמירת עריכת חוזה — כולל סנכרון תנועות והתנגשויות */
  async function saveChoza() {
    if (!editChozaForm.tchilat_schirut || !editChozaForm.ola_schirut_chodshi) {
      toast('יש למלא תאריך תחילה וסכום', 'error'); return
    }
    setEditChozaSaving(true)

    const newStart  = editChozaForm.tchilat_schirut
    const newMonths = editChozaForm.mispar_chodashim ? Number(editChozaForm.mispar_chodashim) : null
    const newRent   = Number(editChozaForm.ola_schirut_chodshi)
    const newEnd    = newMonths
      ? calcLeaseEnd(newStart, newMonths)
      : editChozaForm.sofit_schirut || null

    // ── בדיקת התנגשות עם חוזים אחרים ──
    const { data: otherChozim } = await supabase.from('chozim')
      .select('id, tchilat_schirut, sofit_schirut')
      .eq('dirot_id', form.id)
      .neq('id', editChoza.id)
    const conflict = (otherChozim ?? []).some(c => {
      const cS = c.tchilat_schirut ?? '1900-01-01'
      const cE = c.sofit_schirut  ?? '2999-12-31'
      return cS <= (newEnd ?? '2999-12-31') && cE >= newStart
    })
    if (conflict) {
      toast('יש חפיפת תאריכים עם חוזה אחר — בדוק את התאריכים', 'error')
      setEditChozaSaving(false); return
    }

    // ── טיפול בשינוי חודשי שכירות ↔ תנועות לבעלים ──
    const oldMonths = Number(editChoza.mispar_chodashim ?? 0)
    const oldEnd    = editChoza.sofit_schirut
    if (newMonths && oldMonths && newStart) {
      if (newMonths < oldMonths) {
        const cutoffYM = monthAt(newStart, newMonths)
        const endYM    = oldEnd ? oldEnd.slice(0,7) : '2999-12'
        const { data: extraRows } = await supabase.from('tashlumim_baalim')
          .select('id, status').eq('dirot_id', form.id)
          .gte('chodesh', cutoffYM).lte('chodesh', endYM)
        if (extraRows?.length > 0) {
          const paid = extraRows.filter(r => r.status === 'שולם').length
          const unpaid = extraRows.length - paid
          const paidNote = paid > 0 ? `\n⚠️ ${paid} מהן שולמו כבר!` : ''
          const ok = await confirm(
            `הקיצור מ-${oldMonths} ל-${newMonths} חודשים ייסיר ${extraRows.length} תשלומים לבעלים (${unpaid} לא שולמו${paidNote}).\nהאם למחוק אותם?`,
            { danger: true, confirmText: 'מחק', cancelText: 'ביטול' }
          )
          if (!ok) { setEditChozaSaving(false); return }
          await supabase.from('tashlumim_baalim').delete()
            .eq('dirot_id', form.id).gte('chodesh', cutoffYM).lte('chodesh', endYM)
        }
      } else if (newMonths > oldMonths) {
        await addOwnerPaymentMonths(form.id, newStart, oldMonths, newMonths, newRent, form.payment_day ?? 1)
      }
    }

    const { error } = await supabase.from('chozim').update({
      tchilat_schirut:     newStart,
      sofit_schirut:       newEnd || null,
      mispar_chodashim:    newMonths,
      ola_schirut_chodshi: newRent,
      heara:               editChozaForm.heara || null,
    }).eq('id', editChoza.id)
    setEditChozaSaving(false)
    if (error) { toast(error.message, 'error'); return }

    // ── סנכרון לדירה אם זה החוזה הפעיל הנוכחי ──
    const todayStr = new Date().toISOString().slice(0,10)
    if (newStart <= todayStr && (!newEnd || newEnd >= todayStr)) {
      await supabase.from('dirot').update({
        tchilat_schirut:     newStart,
        sofit_schirut:       newEnd || null,
        mispar_chodashim:    newMonths,
        ola_schirut_chodshi: newRent,
      }).eq('id', form.id)
      setForm(f => ({ ...f, tchilat_schirut: newStart, sofit_schirut: newEnd ?? '', mispar_chodashim: newMonths ?? '', ola_schirut_chodshi: newRent }))
      setOriginalRent(newRent)
      setOriginalMisparChodashim(newMonths)
    }

    toast('חוזה עודכן')
    setEditChoza(null)
    loadHistory(form.id)
    load(true)
  }

  /** ביטול חוזה ספציפי + תשלומים לבעלים שלו */
  async function removeChoza(choza) {
    const from = formatDate(choza.tchilat_schirut)
    const to   = formatDate(choza.sofit_schirut)
    const fromYM = choza.tchilat_schirut ? choza.tchilat_schirut.slice(0,7) : null
    const toYM   = choza.sofit_schirut   ? choza.sofit_schirut.slice(0,7)   : null

    // בדיקת תשלומים לבעלים בתקופה זו
    let q = supabase.from('tashlumim_baalim').select('id, status').eq('dirot_id', form.id)
    if (fromYM) q = q.gte('chodesh', fromYM)
    if (toYM)   q = q.lte('chodesh', toYM)
    const { data: tashlumim } = await q

    if (tashlumim?.length > 0) {
      const paid   = tashlumim.filter(t => t.status === 'שולם').length
      const unpaid = tashlumim.length - paid
      const paidNote = paid > 0 ? `\n⚠️ ${paid} מהם שולמו כבר!` : ''
      const ok = await confirm(
        `ביטול חוזה ${from} — ${to}\n\n` +
        `יש ${tashlumim.length} תשלומים לבעלים בתקופה זו (${unpaid} לא שולמו${paidNote}).\n\n` +
        `האם למחוק גם את התשלומים?`,
        { danger: true, confirmText: 'בטל חוזה ומחק תשלומים', cancelText: 'ביטול' }
      )
      if (!ok) return
      let dq = supabase.from('tashlumim_baalim').delete().eq('dirot_id', form.id)
      if (fromYM) dq = dq.gte('chodesh', fromYM)
      if (toYM)   dq = dq.lte('chodesh', toYM)
      await dq
    } else {
      if (!await confirm(`לבטל את החוזה ${from} — ${to}?`, { danger: true, confirmText: 'בטל חוזה' })) return
    }

    await supabase.from('chozim').delete().eq('id', choza.id)
    toast('החוזה בוטל')
    loadHistory(form.id)
    load(true)
  }

  async function remove(id, addr) {
    if (!await confirm(`למחוק את הדירה ${addr}?`, { danger: true })) return

    // בדוק תשלומים לבעלים
    const { data: tashlumim } = await supabase.from('tashlumim_baalim')
      .select('id, status').eq('dirot_id', id)
    if (tashlumim?.length > 0) {
      const paid   = tashlumim.filter(t => t.status === 'שולם').length
      const unpaid = tashlumim.length - paid
      const paidNote = paid > 0 ? `\n⚠️ ${paid} מהם שולמו כבר!` : ''
      const ok = await confirm(
        `יש ${tashlumim.length} תשלומים לבעלים לדירה זו (${unpaid} לא שולמו${paidNote}).\n\nהאם למחוק גם אותם?`,
        { danger: true, confirmText: 'מחק הכל', cancelText: 'ביטול' }
      )
      if (!ok) return
      await supabase.from('tashlumim_baalim').delete().eq('dirot_id', id)
    }

    // מחיקת כל הנתונים הקשורים לדירה
    await supabase.from('gviya').delete().eq('dirot_id', id)
    await supabase.from('shibutzim').delete().eq('dirot_id', id)
    await supabase.from('chozim').delete().eq('dirot_id', id)
    await supabase.from('tachzuka').delete().eq('dirot_id', id)
    await supabase.from('riut').delete().eq('dirot_id', id)
    await supabase.from('documents').delete().eq('dirot_id', id)
    await supabase.from('dirot').delete().eq('id', id)
    logActivity('DELETE', 'dirot', id, addr)
    toast('נמחק')
    load(true)
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
    { key:'mispar_mitot', label:'מיטות', render:(v,r) => {
      const occ = occupantsMap[r.id] ?? 0
      const total = v ?? 0
      const free = total - occ
      return total > 0
        ? <span className={free > 0 ? 'text-emerald-600 font-medium' : 'text-slate-500'}>{occ}/{total} ({free} פנויות)</span>
        : '—'
    }},
    { key:'ola_schirut_chodshi', label:'שכירות', render:(v,r) => currency(currentRentMap[r.id] ?? v) },
    { key:'sofit_schirut', label:'סיום חוזה', render:(v,r)=>{
      const dateEl = !v ? <span>—</span> : (() => {
        const d = daysUntil(v)
        return <span className={d!==null&&d<=30&&d>=0?'text-amber-600 font-semibold':''}>{formatDate(v)}</span>
      })()
      const cnt = chozimCountMap[r.id] ?? 0
      return (
        <div className="flex items-center gap-1.5 flex-wrap">
          {dateEl}
          {cnt > 1 && (
            <span className="text-xs bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded-full font-medium whitespace-nowrap">
              {cnt} חוזים
            </span>
          )}
        </div>
      )
    }},
    { key:'_avail', label:'זמינות', render:(_, r) => {
      const av = availabilityMap[r.id]
      if (!av) return null
      const ms = av.milestones[0]
      return (
        <button
          onClick={e => { e.stopPropagation(); setAvailPopup(p => p === r.id ? null : r.id) }}
          className="flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-blue-50 border border-blue-200 text-blue-700 hover:bg-blue-100 transition-colors"
        >
          🛏 {ms.isNow ? 'פנוי עכשיו' : `מ-${formatDate(ms.fromDate)}`}
          {av.milestones.length > 1 && <span className="text-blue-400 mr-0.5">+{av.milestones.length - 1}</span>}
        </button>
      )
    }},
    { key:'status',      label:'סטטוס', render:v=><Badge color={STATUS_COLORS[v]??'gray'}>{v??'—'}</Badge> },
    { key:'actions',     label:'', width:80, render:(_,row)=>(
      <div className="flex gap-1">
        <button onClick={e=>{e.stopPropagation();openEdit(row)}} className="p-1.5 rounded text-slate-400 hover:text-teal-600 hover:bg-teal-50"><Edit2 size={14}/></button>
        <button onClick={e=>{e.stopPropagation();remove(row.id,row.ktovet)}} className="p-1.5 rounded text-slate-400 hover:text-red-600 hover:bg-red-50"><Trash2 size={14}/></button>
      </div>
    )},
  ]

  // ── Popup זמינות מיטות ──
  const AvailPopup = availPopup && availabilityMap[availPopup] && (() => {
    const av = availabilityMap[availPopup]
    const row = rows.find(r => r.id === availPopup)
    if (!row) return null
    return (
      <div className="fixed inset-0 bg-black/20 z-50 flex items-center justify-center" onClick={() => setAvailPopup(null)}>
        <div className="bg-white rounded-2xl shadow-xl p-5 max-w-sm w-full mx-4" onClick={e => e.stopPropagation()}>
          <div className="flex items-center justify-between mb-1">
            <h3 className="font-bold text-slate-800">{row.ktovet}{row.ir ? `, ${row.ir}` : ''}</h3>
            <button onClick={() => setAvailPopup(null)} className="text-slate-400 hover:text-slate-600 text-xl leading-none px-1">×</button>
          </div>
          <p className="text-xs text-slate-400 mb-3">חוזה עד {formatDate(av.sofit)}</p>
          <div className="space-y-2">
            {av.milestones.map((ms, i) => (
              <div key={i} className="flex items-center gap-2 p-2.5 rounded-xl bg-blue-50">
                <span className={`text-xs font-semibold px-2 py-0.5 rounded-full whitespace-nowrap ${ms.isNow ? 'bg-emerald-100 text-emerald-700' : 'bg-white border border-blue-200 text-blue-700'}`}>
                  {ms.isNow ? 'עכשיו' : `מ-${formatDate(ms.fromDate)}`}
                </span>
                <span className="text-sm font-bold text-slate-700">
                  {'🛏'.repeat(Math.min(ms.freeBeds, 4))} {ms.freeBeds} מיט{ms.freeBeds === 1 ? 'ה' : 'ות'} פנוי{ms.freeBeds === 1 ? 'ה' : 'ות'}
                </span>
                <span className="text-xs text-slate-400 mr-auto whitespace-nowrap">עד {formatDate(av.sofit)}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    )
  })()

  return (
    <div className="space-y-4 fade-in">
      {AvailPopup}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex-1 min-w-48"><SearchInput value={search} onChange={setSearch} placeholder="כתובת, עיר, בעלים..."/></div>
        <select value={statusFilter} onChange={e=>setStatusFilter(e.target.value)}
          className="px-3 py-2 text-sm rounded-lg border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-teal-400">
          <option value="">כל הסטטוסים</option>
          <option value="פעיל">פעיל</option>
          <option value="ריק">ריק</option>
          <option value="לא_זמין">לא זמין</option>
          <option value="לא_פעיל">לא פעיל</option>
        </select>
        <button
          onClick={() => setFreeBedFilter(f => !f)}
          className={`px-3 py-2 text-sm rounded-lg border transition-colors ${
            freeBedFilter
              ? 'bg-teal-600 text-white border-teal-600'
              : 'bg-white text-slate-600 border-slate-200 hover:border-teal-300'
          }`}>
          מיטות פנויות / מתפנות
        </button>
        <button onClick={load} className="h-9 w-9 rounded-lg border border-slate-200 bg-white text-slate-500 hover:text-teal-600 hover:border-teal-300 flex items-center justify-center" title="רענן">
          <RefreshCw size={16} className={loading ? 'animate-spin' : ''}/>
        </button>
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
      <Table columns={columns} data={filtered} loading={loading} emptyText="לא נמצאו דירות" onRowClick={openEdit}
        rowClassName={row => {
          const dc = row.sofit_schirut ? daysUntil(row.sofit_schirut) : null
          const db = row.bituach_chadush ? daysUntil(row.bituach_chadush) : null
          const isExpiring = (dc !== null && dc <= 30 && dc >= 0) || (db !== null && db <= 30 && db >= 0)
          return isExpiring ? 'bg-amber-50 hover:bg-amber-100' : 'hover:bg-slate-50'
        }}/>

      <Modal open={modal} onClose={()=>setModal(false)} title={form.id ? form.ktovet||'דירה' : 'דירה חדשה'} size="xl">
        <Tabs tabs={TABS} active={activeTab} onChange={setActiveTab}/>
        <div style={{ height: '460px', overflowY: 'auto' }} className="pt-1 pl-1 pr-1">

        {/* ── Tab: פרטי דירה ── */}
        {activeTab==='dira' && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-start">
            <FormField label="כתובת" required><Input value={form.ktovet??''} onChange={set('ktovet')} placeholder="רחוב הרצל 1"/></FormField>
            <FormField label="עיר"><Input value={form.ir??''} onChange={set('ir')} placeholder="ירושלים"/></FormField>
            <FormField label="משכן"><Input value={form.mishkan??''} onChange={set('mishkan')}/></FormField>
            <FormField label="מזכיר"><Input value={form.mazkir??''} onChange={set('mazkir')}/></FormField>
            <FormField label="חדרים"><Input type="number" min="0" value={form.mispar_chadarim??''} onChange={set('mispar_chadarim')}/></FormField>
            <FormField label="מיטות" required><Input type="number" min="0" value={form.mispar_mitot??''} onChange={set('mispar_mitot')}/></FormField>
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
                <option value="לא_פעיל">לא פעיל</option>
              </Select>
            </FormField>
            <FormField label="סטטוס ועד">
              <Select value={form.status_vaad??''} onChange={set('status_vaad')}>
                <option value="">-- בחר --</option>
                <option value="חתום מול הועד">חתום מול הועד</option>
                <option value="אינו תחת הועד">אינו תחת הועד</option>
                <option value="מאושר">מאושר</option>
                <option value="חתום מול הישיבה">חתום מול הישיבה</option>
                <option value="עדיין לא נבדק">עדיין לא נבדק</option>
              </Select>
            </FormField>
            <FormField label="לוח שנה לשכירות">
              <Select value={form.luch_shanah??'לועזי'} onChange={set('luch_shanah')}>
                <option value="לועזי">לועזי</option>
                <option value="עברי">עברי</option>
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
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-start">
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
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-start">
            <FormField label="עלות שכירות חודשית (₪)" required>
              {form.id ? (
                <div className="flex items-center gap-2">
                  <div className="flex-1 px-3 py-2 bg-slate-100 rounded-lg text-slate-700 text-sm font-medium border border-slate-200">
                    {currency(form.ola_schirut_chodshi) || '—'}
                  </div>
                  <span className="text-xs text-slate-400 whitespace-nowrap">🔒 נעול</span>
                </div>
              ) : (
                <Input type="number" min="0" value={form.ola_schirut_chodshi??''} onChange={set('ola_schirut_chodshi')}/>
              )}
            </FormField>
            <div/>
            <div className="sm:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-4 items-end">
              <FormField label="תחילת שכירות" required>
                <DualDateField value={form.tchilat_schirut??''} onChange={v=>{ set('tchilat_schirut')({target:{value:v}}) }}/>
              </FormField>
              <FormField label="מספר חודשים">
                <Input type="number" min="1" value={form.mispar_chodashim??''} onChange={set('mispar_chodashim')} placeholder="12"/>
              </FormField>
            </div>
            <FormField label="סוף שכירות (מחושב)">
              <div className="px-3 py-2 bg-teal-50 rounded-lg text-teal-700 text-sm font-medium">
                {form.sofit_schirut ? formatDate(form.sofit_schirut) : '—'}
              </div>
              {form.sofit_schirut && (
                <p className="text-xs text-slate-400 mt-1 px-1">{toHebrewDate(form.sofit_schirut)}</p>
              )}
            </FormField>
            {form.id ? (
              <div className="flex items-end pb-0.5">
                <button
                  onClick={() => {
                    const nextStart = form.sofit_schirut
                      ? new Date(new Date(form.sofit_schirut + 'T12:00:00').getTime() + 86400000).toISOString().slice(0,10)
                      : ''
                    setRenewForm({
                      tchilat_schirut: nextStart,
                      mispar_chodashim: form.mispar_chodashim ?? '',
                      ola_schirut_chodshi: form.ola_schirut_chodshi ?? '',
                    })
                    setRenewModal(true)
                  }}
                  className="w-full px-4 py-2 rounded-lg bg-amber-50 border border-amber-300 text-amber-700 text-sm font-medium hover:bg-amber-100 transition-colors">
                  🔄 חדש חוזה
                </button>
              </div>
            ) : <div/>}
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
            <hr className="sm:col-span-2 border-slate-100"/>
            <div className="sm:col-span-2">
              <FormField label="הערות חוזה (לחוזה הנוכחי בלבד)">
                <Textarea value={form.hearot_chozeh??''} onChange={set('hearot_chozeh')} rows={3} placeholder="הערות לחוזה זה..."/>
              </FormField>
            </div>
          </div>
        )}

        {/* ── Tab: ביטוח ── */}
        {activeTab==='bituach' && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-start">
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

        {/* ── Tab: היסטוריית חוזים ── */}
        {activeTab==='chozim' && (
          <div>
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm font-semibold text-slate-700">חוזים לדירה זו</p>
              {chozim.length > 1 && (
                <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-medium">
                  {chozim.length} חוזים
                </span>
              )}
            </div>
            {chozim.length === 0
              ? <p className="text-sm text-slate-400">אין חוזים רשומים עדיין (חוזים חדשים נרשמים אוטומטית)</p>
              : (
                <div className="space-y-2">
                  {chozim.map((c, i) => {
                    const todayStr = new Date().toISOString().slice(0,10)
                    const chozaStatus = !c.tchilat_schirut ? 'פעיל'
                      : c.tchilat_schirut > todayStr ? 'עתידי'
                      : (c.sofit_schirut && c.sofit_schirut < todayStr) ? 'הסתיים'
                      : 'פעיל'
                    const chozaBorder = chozaStatus === 'פעיל' ? 'border-teal-200 bg-teal-50'
                      : chozaStatus === 'עתידי' ? 'border-blue-200 bg-blue-50'
                      : 'border-slate-200 bg-slate-50'
                    const chozaBadge = chozaStatus === 'פעיל' ? 'green' : chozaStatus === 'עתידי' ? 'blue' : 'gray'
                    return (
                    <div key={c.id ?? i} className={`flex items-center gap-3 p-3 rounded-xl border ${chozaBorder}`}>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <Badge color={chozaBadge}>{chozaStatus}</Badge>
                          <span className="text-sm font-medium text-slate-700">
                            {formatDate(c.tchilat_schirut)} — {formatDate(c.sofit_schirut)}
                          </span>
                          {c.mispar_chodashim && (
                            <span className="text-xs text-slate-500">({c.mispar_chodashim} חודשים)</span>
                          )}
                        </div>
                        <p className="text-sm text-slate-600 mt-0.5">{currency(c.ola_schirut_chodshi)}/חודש</p>
                      </div>
                      <div className="flex gap-1 flex-shrink-0">
                        <button
                          onClick={() => {
                            setEditChoza(c)
                            setEditChozaForm({
                              ...c,
                              tchilat_schirut: toInputDate(c.tchilat_schirut),
                              sofit_schirut:   toInputDate(c.sofit_schirut),
                              mispar_chodashim: c.mispar_chodashim ?? '',
                            })
                          }}
                          className="p-1.5 rounded text-slate-400 hover:text-teal-600 hover:bg-teal-50"
                          title="ערוך חוזה">
                          <Edit2 size={14}/>
                        </button>
                        <button
                          onClick={() => removeChoza(c)}
                          className="p-1.5 rounded text-slate-400 hover:text-red-600 hover:bg-red-50"
                          title="בטל חוזה זה">
                          <Trash2 size={14}/>
                        </button>
                      </div>
                    </div>
                    )
                  })}
                </div>
              )
            }
          </div>
        )}

        {/* ── Tab: שיבוצים ── */}
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

      {/* ── מודל עריכת חוזה ── */}
      <Modal open={!!editChoza} onClose={() => setEditChoza(null)} title="עריכת חוזה" size="sm">
        <div className="space-y-4">
          <FormField label="תאריך תחילה" required>
            <Input type="date" value={editChozaForm.tchilat_schirut ?? ''}
              onChange={e => {
                const val = e.target.value
                const newEnd = calcLeaseEnd(val, editChozaForm.mispar_chodashim)
                setEditChozaForm(f => ({ ...f, tchilat_schirut: val, ...(newEnd ? { sofit_schirut: newEnd } : {}) }))
              }}/>
          </FormField>
          <FormField label="מספר חודשים">
            <Input type="number" min="1" value={editChozaForm.mispar_chodashim ?? ''}
              onChange={e => {
                const val = e.target.value
                const newEnd = calcLeaseEnd(editChozaForm.tchilat_schirut, val)
                setEditChozaForm(f => ({ ...f, mispar_chodashim: val, ...(newEnd ? { sofit_schirut: newEnd } : {}) }))
              }} placeholder="12"/>
            {editChozaForm.sofit_schirut && (
              <p className="text-xs text-teal-600 mt-1 px-1">סיום: {formatDate(editChozaForm.sofit_schirut)}</p>
            )}
          </FormField>
          <FormField label="עלות שכירות (₪)" required>
            <Input type="number" min="0" value={editChozaForm.ola_schirut_chodshi ?? ''}
              onChange={e => setEditChozaForm(f => ({ ...f, ola_schirut_chodshi: e.target.value }))}/>
          </FormField>
          <FormField label="סטטוס">
            <Select value={editChozaForm.status ?? 'פעיל'}
              onChange={e => setEditChozaForm(f => ({ ...f, status: e.target.value }))}>
              <option value="פעיל">פעיל</option>
              <option value="הסתיים">הסתיים</option>
            </Select>
          </FormField>
          <FormField label="הערה">
            <Textarea value={editChozaForm.heara ?? ''} rows={2}
              onChange={e => setEditChozaForm(f => ({ ...f, heara: e.target.value }))}/>
          </FormField>
        </div>
        <div className="flex justify-end gap-3 mt-6">
          <Button variant="secondary" onClick={() => setEditChoza(null)}>ביטול</Button>
          <Button loading={editChozaSaving} onClick={saveChoza}>שמור</Button>
        </div>
      </Modal>

      {/* ── מודל חידוש חוזה ── */}
      <Modal open={renewModal} onClose={()=>setRenewModal(false)} title={`חידוש חוזה — ${form.ktovet ?? ''}`} size="sm">
        <div className="space-y-4">
          <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-sm text-amber-700">
            חוזה נוכחי: <strong>{formatDate(form.tchilat_schirut)}</strong> עד <strong>{formatDate(form.sofit_schirut)}</strong>
          </div>
          <FormField label="תאריך תחילה חדש" required>
            <Input type="date" value={renewForm.tchilat_schirut}
              min={form.sofit_schirut || undefined}
              onChange={e => {
                const val = e.target.value
                const newEnd = calcLeaseEnd(val, renewForm.mispar_chodashim)
                setRenewForm(f => ({ ...f, tchilat_schirut: val, _sofit: newEnd }))
              }}/>
          </FormField>
          <FormField label="מספר חודשים" required>
            <Input type="number" min="1" value={renewForm.mispar_chodashim}
              onChange={e => {
                const val = e.target.value
                const newEnd = calcLeaseEnd(renewForm.tchilat_schirut, val)
                setRenewForm(f => ({ ...f, mispar_chodashim: val, _sofit: newEnd }))
              }} placeholder="12"/>
            {renewForm._sofit && (
              <p className="text-xs text-teal-600 mt-1 px-1">סיום: {formatDate(renewForm._sofit)}</p>
            )}
          </FormField>
          <FormField label="עלות שכירות חודשית (₪)" required>
            <Input type="number" min="0" value={renewForm.ola_schirut_chodshi}
              onChange={e => setRenewForm(f => ({ ...f, ola_schirut_chodshi: e.target.value }))}/>
          </FormField>
          <FormField label="הערות חוזה">
            <Textarea value={renewForm.hearot_chozeh??''} onChange={e => setRenewForm(f => ({ ...f, hearot_chozeh: e.target.value }))} rows={2} placeholder="הערות לחוזה החדש..."/>
          </FormField>
          <p className="text-xs text-slate-500">
            ✓ יווצרו שורות תשלום לבעלים לתקופה החדשה<br/>
            ✓ ההיסטוריה של החוזה הנוכחי תישמר בתנו</p>
          <div className="flex justify-end gap-3 mt-4">
            <Button variant="secondary" onClick={() => setRenewModal(false)}>ביטול</Button>
            <Button loading={renewSaving} onClick={renewContract}>חדש חוזה</Button>
          </div>
        </div>
      </Modal>

      </div>
  )
}
