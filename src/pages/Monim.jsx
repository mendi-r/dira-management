import React, { useEffect, useState, useCallback } from 'react'
import { PlusCircle, Edit2, Trash2, Gauge, RefreshCw, CheckCircle, XCircle, AlertTriangle } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { formatDate, toInputDate, currency } from '../lib/utils'
import { confirm } from '../lib/confirm'
import { Table } from '../components/ui/Table'
import SearchInput from '../components/ui/SearchInput'
import Modal from '../components/ui/Modal'
import Button from '../components/ui/Button'
import Badge from '../components/ui/Badge'
import { FormField, Input, Select, Textarea } from '../components/ui/FormField'
import { StatCard } from '../components/ui/Card'
import { useToast } from '../components/ui/Toast'

const EMPTY = {
  dirot_id: '', sug_mone: 'חשמל',
  kriah_nochchit: '', kriah_kodem: '',
  taarich_kriah: '', is_kriah_ptika: false,
  shulam: false, skhum_leshalem: '', heara: '',
}

const SUG_COLORS  = { חשמל: 'amber', מים: 'blue', גז: 'red', אחר: 'gray' }
const SUG_UNITS   = { חשמל: 'קוט״ש', מים: 'קוב', גז: 'מ״ק', אחר: '' }
const SUG_EMOJI   = { חשמל: '⚡', מים: '💧', גז: '🔥', אחר: '📊' }

function calcCons(prev, curr, isPtika) {
  if (isPtika) return null
  const p = Number(prev ?? 0), c = Number(curr ?? 0)
  if (!prev && prev !== 0) return null
  if (!curr) return null
  return Math.max(0, c - p)
}

function ConsumptionChart({ data, sug }) {
  if (!data || data.length < 2) return (
    <p className="text-sm text-slate-400 py-3 text-center">נדרשות לפחות 2 קריאות לגרף</p>
  )
  const vals = data
    .filter(d => !d.is_kriah_ptika)
    .map(d => ({ v: calcCons(d.kriah_kodem, d.kriah_nochchit, false) ?? 0, label: formatDate(d.taarich_kriah)?.slice(0,5) ?? '' }))
    .filter(d => d.v >= 0)
  if (!vals.length) return null
  const max = Math.max(...vals.map(d => d.v), 1)
  const W = 400, H = 100, pad = 24
  const barW = Math.max(16, (W - pad * 2) / vals.length - 6)
  const color = sug === 'חשמל' ? '#f59e0b' : sug === 'מים' ? '#3b82f6' : '#ef4444'
  return (
    <div className="overflow-x-auto">
      <svg viewBox={`0 0 ${W} ${H + 36}`} className="w-full">
        {vals.map((d, i) => {
          const x = pad + i * ((W - pad * 2) / vals.length) + 3
          const h = Math.max(4, (d.v / max) * H)
          return (
            <g key={i}>
              <rect x={x} y={H - h + 5} width={barW} height={h} fill={color} rx="3" opacity="0.85"/>
              <text x={x + barW / 2} y={H + 18} textAnchor="middle" fontSize="10" fill="#64748b">{d.v}</text>
              <text x={x + barW / 2} y={H + 32} textAnchor="middle" fontSize="9" fill="#94a3b8">{d.label}</text>
            </g>
          )
        })}
        <line x1={pad} y1={5} x2={pad} y2={H + 5} stroke="#e2e8f0" strokeWidth="1"/>
        <line x1={pad} y1={H + 5} x2={W - pad} y2={H + 5} stroke="#e2e8f0" strokeWidth="1"/>
      </svg>
    </div>
  )
}

export default function Monim() {
  const toast = useToast()
  const [rows, setRows]           = useState([])
  const [dirot, setDirot]         = useState([])
  const [loading, setLoading]     = useState(true)
  const [search, setSearch]       = useState('')
  const [sugFilter, setSugFilter] = useState('')
  const [dirotFilter, setDirotFilter] = useState('')
  const [shulamFilter, setShulamFilter] = useState('')
  const [modal, setModal]         = useState(false)
  const [form, setForm]           = useState(EMPTY)
  const [saving, setSaving]       = useState(false)
  const [prevReading, setPrevReading] = useState(null) // קריאה קודמת אוטומטית
  const [chartData, setChartData] = useState([])

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true)
    let q = supabase.from('riut')
      .select('*, dirot!dirot_id(ktovet,ir)')
      .order('taarich_kriah', { ascending: false })
    if (sugFilter)    q = q.eq('sug_mone', sugFilter)
    if (dirotFilter)  q = q.eq('dirot_id', dirotFilter)
    if (shulamFilter !== '') q = q.eq('shulam', shulamFilter === 'שולם')
    const [{ data: r }, { data: d }] = await Promise.all([
      q,
      supabase.from('dirot').select('id,ktovet,ir').order('ktovet'),
    ])
    setRows(r ?? [])
    setDirot(d ?? [])
    setLoading(false)
  }, [sugFilter, dirotFilter, shulamFilter])

  useEffect(() => { load() }, [load])

  // שלוף קריאה קודמת אוטומטית — autoFill=true ממלא kriah_kodem בשדה
  async function fetchPrevReading(dirotId, sugMone, excludeId, autoFill = false) {
    if (!dirotId || !sugMone) { setPrevReading(null); return }
    const { data } = await supabase.from('riut')
      .select('*')
      .eq('dirot_id', dirotId)
      .eq('sug_mone', sugMone)
      .order('taarich_kriah', { ascending: false })
      .limit(1)
      .neq('id', excludeId || '00000000-0000-0000-0000-000000000000')
    const prev = data?.[0] ?? null
    setPrevReading(prev)
    if (autoFill && prev && prev.kriah_nochchit != null) {
      setForm(f => ({ ...f, kriah_kodem: String(prev.kriah_nochchit) }))
    }
  }

  async function loadChart(dirotId, sug) {
    if (!dirotId || !sug) return
    const { data } = await supabase.from('riut')
      .select('*')
      .eq('dirot_id', dirotId)
      .eq('sug_mone', sug)
      .order('taarich_kriah', { ascending: true })
      .limit(12)
    setChartData(data ?? [])
  }

  const filtered = rows.filter(r =>
    `${r.dirot?.ktovet ?? ''} ${r.dirot?.ir ?? ''} ${r.sug_mone ?? ''}`
      .toLowerCase().includes(search.toLowerCase())
  )

  // כרטיסי סיכום
  const totalChashmal = filtered.filter(r => r.sug_mone === 'חשמל')
    .reduce((s, r) => s + (calcCons(r.kriah_kodem, r.kriah_nochchit, r.is_kriah_ptika) ?? 0), 0)
  const totalMayim = filtered.filter(r => r.sug_mone === 'מים')
    .reduce((s, r) => s + (calcCons(r.kriah_kodem, r.kriah_nochchit, r.is_kriah_ptika) ?? 0), 0)
  const unpaidCount = filtered.filter(r => !r.shulam && !r.is_kriah_ptika).length
  const unpaidSum   = filtered.filter(r => !r.shulam).reduce((s, r) => s + Number(r.skhum_leshalem ?? 0), 0)

  // דירות שלא עודכנו 30+ יום
  const thirtyDaysAgo = new Date(); thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
  const staleAlert = (() => {
    const lastByDira = {}
    rows.forEach(r => {
      if (!r.dirot_id || !r.taarich_kriah) return
      const d = new Date(r.taarich_kriah)
      if (!lastByDira[r.dirot_id] || d > lastByDira[r.dirot_id]) lastByDira[r.dirot_id] = d
    })
    return dirot.filter(d => {
      const last = lastByDira[d.id]
      return !last || last < thirtyDaysAgo
    })
  })()

  function openNew() {
    setForm({ ...EMPTY, taarich_kriah: new Date().toISOString().slice(0, 10) })
    setPrevReading(null); setChartData([])
    setModal(true)
  }
  function openEdit(r) {
    setForm({ ...EMPTY, ...r, taarich_kriah: toInputDate(r.taarich_kriah) })
    fetchPrevReading(r.dirot_id, r.sug_mone, r.id)
    loadChart(r.dirot_id, r.sug_mone)
    setModal(true)
  }

  function setField(field, val) {
    setForm(f => {
      const next = { ...f, [field]: val }
      if (field === 'dirot_id' || field === 'sug_mone') {
        const newDirotId  = field === 'dirot_id' ? val : f.dirot_id
        const newSugMone  = field === 'sug_mone'  ? val : f.sug_mone
        // autoFill=true רק לרשומה חדשה ולא בעת עריכה
        fetchPrevReading(newDirotId, newSugMone, f.id, !f.id)
        loadChart(newDirotId, newSugMone)
      }
      if (field === 'is_kriah_ptika' && val) {
        next.kriah_kodem = ''
      }
      return next
    })
  }

  const consumption = calcCons(form.kriah_kodem, form.kriah_nochchit, form.is_kriah_ptika)

  async function save() {
    if (!form.dirot_id)       { toast('יש לבחור דירה', 'error'); return }
    if (!form.kriah_nochchit) { toast('קריאה נוכחית חובה', 'error'); return }

    // ולידציה: תאריך לא לפני הקריאה הקודמת
    if (prevReading?.taarich_kriah && form.taarich_kriah &&
        form.taarich_kriah < prevReading.taarich_kriah) {
      toast(`תאריך הקריאה לא יכול להיות לפני הקריאה הקודמת (${formatDate(prevReading.taarich_kriah)})`, 'error')
      return
    }

    // ולידציה: קריאה נוכחית לא קטנה מקודמת
    if (!form.is_kriah_ptika && form.kriah_kodem &&
        Number(form.kriah_nochchit) < Number(form.kriah_kodem)) {
      toast('קריאה נוכחית לא יכולה להיות קטנה מהקריאה הקודמת', 'error')
      return
    }

    setSaving(true)
    const payload = {
      dirot_id:       form.dirot_id,
      sug_mone:       form.sug_mone,
      kriah_nochchit: Number(form.kriah_nochchit),
      kriah_kodem:    form.is_kriah_ptika ? null : (form.kriah_kodem !== '' ? Number(form.kriah_kodem) : null),
      taarich_kriah:  form.taarich_kriah || null,
      is_kriah_ptika: !!form.is_kriah_ptika,
      shulam:         !!form.shulam,
      skhum_leshalem: form.skhum_leshalem !== '' ? Number(form.skhum_leshalem) : null,
      heara:          form.heara || null,
    }
    const isNew = !form.id
    const { error } = isNew
      ? await supabase.from('riut').insert(payload)
      : await supabase.from('riut').update(payload).eq('id', form.id)
    setSaving(false)
    if (error) { toast(error.message, 'error'); return }
    toast(isNew ? 'קריאה נוספה' : 'עודכן')
    setModal(false)
    load(true)
  }

  async function remove(id) {
    if (!await confirm('למחוק קריאה זו?', { danger: true })) return
    await supabase.from('riut').delete().eq('id', id)
    toast('נמחק'); load(true)
  }

  // שינוי סטטוס תשלום ישיר מהטבלה
  async function toggleShulam(row) {
    const newVal = !row.shulam
    await supabase.from('riut').update({ shulam: newVal }).eq('id', row.id)
    setRows(prev => prev.map(r => r.id === row.id ? { ...r, shulam: newVal } : r))
    toast(newVal ? 'סומן כשולם' : 'סומן כלא שולם')
  }

  const columns = [
    { key: 'dirot',          label: 'דירה',     render: v => v ? `${v.ktovet}${v.ir ? ', ' + v.ir : ''}` : '—' },
    { key: 'sug_mone',       label: 'סוג',      render: v => <Badge color={SUG_COLORS[v] ?? 'gray'}>{SUG_EMOJI[v] ?? ''} {v ?? '—'}</Badge> },
    { key: 'is_kriah_ptika', label: 'סוג קריאה', render: v => <span className="text-xs text-slate-500">{v ? 'פתיחה' : 'המשך'}</span> },
    { key: 'kriah_kodem',    label: 'קריאה קודמת', render: v => v != null ? <span className="text-slate-500">{v}</span> : '—' },
    { key: 'kriah_nochchit', label: 'קריאה נוכחית', render: v => <span className="font-semibold">{v ?? '—'}</span> },
    { key: '_cons',          label: 'צריכה',    render: (_, r) => {
      const c = calcCons(r.kriah_kodem, r.kriah_nochchit, r.is_kriah_ptika)
      const unit = SUG_UNITS[r.sug_mone] ?? ''
      return c != null
        ? <span className="font-bold text-teal-700">{c} <span className="text-xs font-normal text-slate-400">{unit}</span></span>
        : <span className="text-slate-300 text-xs">—</span>
    }},
    { key: 'taarich_kriah',  label: 'תאריך',    render: v => formatDate(v) },
    { key: 'skhum_leshalem', label: 'סכום',     render: v => v ? currency(v) : '—' },
    { key: 'shulam',         label: 'תשלום',    render: (v, row) => (
      <button onClick={e => { e.stopPropagation(); toggleShulam(row) }}
        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium transition-colors ${
          v ? 'bg-green-100 text-green-700 hover:bg-green-200' : 'bg-red-50 text-red-600 hover:bg-red-100'
        }`}>
        {v ? <CheckCircle size={11}/> : <XCircle size={11}/>}
        {v ? 'שולם' : 'לא שולם'}
      </button>
    )},
    { key: 'actions', label: '', width: 80, render: (_, row) => (
      <div className="flex gap-1">
        <button onClick={e => { e.stopPropagation(); openEdit(row) }} className="p-1.5 rounded text-slate-400 hover:text-teal-600 hover:bg-teal-50"><Edit2 size={14}/></button>
        <button onClick={e => { e.stopPropagation(); remove(row.id) }} className="p-1.5 rounded text-slate-400 hover:text-red-600 hover:bg-red-50"><Trash2 size={14}/></button>
      </div>
    )},
  ]

  return (
    <div className="space-y-4 fade-in">

      {/* התראות */}
      {staleAlert.length > 0 && (
        <div className="flex items-start gap-3 p-3 bg-amber-50 border border-amber-200 rounded-xl">
          <AlertTriangle size={16} className="text-amber-600 flex-shrink-0 mt-0.5"/>
          <div className="text-sm text-amber-800">
            <span className="font-semibold">לא עודכנו מעל 30 יום: </span>
            {staleAlert.map(d => d.ktovet).join(' • ')}
          </div>
        </div>
      )}

      {/* כרטיסי סיכום */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatCard label="סה״כ חשמל"  value={`${totalChashmal} קוט״ש`} icon={Gauge} color="amber"/>
        <StatCard label="סה״כ מים"   value={`${totalMayim} קוב`}      icon={Gauge} color="blue"/>
        <StatCard label="ממתינות לתשלום" value={`${unpaidCount} קריאות`} icon={XCircle}   color="red"/>
        <StatCard label="סה״כ חוב"   value={currency(unpaidSum)}       icon={Gauge} color="red"/>
      </div>

      {/* סינונים */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex-1 min-w-48">
          <SearchInput value={search} onChange={setSearch} placeholder="כתובת, סוג מונה..."/>
        </div>
        <select value={sugFilter} onChange={e => setSugFilter(e.target.value)}
          className="px-3 py-2 text-sm rounded-lg border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-teal-400">
          <option value="">כל סוגי המונים</option>
          <option value="חשמל">⚡ חשמל</option>
          <option value="מים">💧 מים</option>
          <option value="גז">🔥 גז</option>
        </select>
        <select value={dirotFilter} onChange={e => setDirotFilter(e.target.value)}
          className="px-3 py-2 text-sm rounded-lg border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-teal-400">
          <option value="">כל הדירות</option>
          {dirot.map(d => <option key={d.id} value={d.id}>{d.ktovet}</option>)}
        </select>
        <select value={shulamFilter} onChange={e => setShulamFilter(e.target.value)}
          className="px-3 py-2 text-sm rounded-lg border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-teal-400">
          <option value="">כל הסטטוסים</option>
          <option value="שולם">שולם</option>
          <option value="לא שולם">לא שולם</option>
        </select>
        <button onClick={() => load()} className="h-9 w-9 rounded-lg border border-slate-200 bg-white text-slate-500 hover:text-teal-600 hover:border-teal-300 flex items-center justify-center" title="רענן">
          <RefreshCw size={16} className={loading ? 'animate-spin' : ''}/>
        </button>
        <Button icon={PlusCircle} onClick={openNew}>קריאה חדשה</Button>
      </div>

      <p className="text-sm text-slate-400">{filtered.length} קריאות</p>
      <Table columns={columns} data={filtered} loading={loading} emptyText="לא נמצאו קריאות" onRowClick={openEdit}/>

      {/* מודל הוספה/עריכה */}
      <Modal open={modal} onClose={() => setModal(false)} title={form.id ? 'עריכת קריאה' : 'קריאה חדשה'} size="lg">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 min-h-[320px]">

          <FormField label="דירה" required>
            <Select value={form.dirot_id ?? ''} onChange={e => setField('dirot_id', e.target.value)}>
              <option value="">-- בחר דירה --</option>
              {dirot.map(d => <option key={d.id} value={d.id}>{d.ktovet}{d.ir ? `, ${d.ir}` : ''}</option>)}
            </Select>
          </FormField>

          <FormField label="סוג מונה">
            <Select value={form.sug_mone ?? 'חשמל'} onChange={e => setField('sug_mone', e.target.value)}>
              <option value="חשמל">⚡ חשמל</option>
              <option value="מים">💧 מים</option>
              <option value="גז">🔥 גז</option>
              <option value="אחר">📊 אחר</option>
            </Select>
          </FormField>

          <div className="sm:col-span-2 flex items-center gap-2">
            <input type="checkbox" id="is_kriah_ptika" checked={!!form.is_kriah_ptika}
              onChange={e => setField('is_kriah_ptika', e.target.checked)}
              className="w-4 h-4 text-teal-600 rounded"/>
            <label htmlFor="is_kriah_ptika" className="text-sm text-slate-700">
              קריאת פתיחה (ראשונה לדירה/מונה זה) — צריכה = 0
            </label>
          </div>

          {!form.is_kriah_ptika && prevReading && (
            <div className="sm:col-span-2 flex items-center gap-3 px-3 py-2.5 bg-blue-50 border border-blue-200 rounded-xl text-sm">
              <Gauge size={15} className="text-blue-500 flex-shrink-0"/>
              <div className="text-blue-700">
                <span className="font-semibold">קריאה קודמת: {prevReading.kriah_nochchit}</span>
                {prevReading.taarich_kriah && <span className="text-blue-500 mr-2">({formatDate(prevReading.taarich_kriah)})</span>}
                <span className="mr-3 text-xs text-blue-400">✓ הוזן אוטומטית</span>
              </div>
            </div>
          )}

          {!form.is_kriah_ptika && (
            <FormField label="קריאה קודמת">
              <Input type="number" step="0.001" value={form.kriah_kodem ?? ''}
                onChange={e => setField('kriah_kodem', e.target.value)}
                placeholder={prevReading ? String(prevReading.kriah_nochchit) : '0'}/>
            </FormField>
          )}

          <FormField label="קריאה נוכחית" required>
            <Input type="number" step="0.001" value={form.kriah_nochchit ?? ''}
              onChange={e => setField('kriah_nochchit', e.target.value)} placeholder="0"/>
          </FormField>

          <FormField label="תאריך קריאה">
            <Input type="date" value={form.taarich_kriah ?? ''}
              min={prevReading?.taarich_kriah ?? undefined}
              onChange={e => setField('taarich_kriah', e.target.value)}/>
          </FormField>

          {!form.is_kriah_ptika && consumption != null && (
            <div className={`sm:col-span-2 flex items-center gap-3 px-4 py-3 rounded-xl border ${
              consumption >= 0 ? 'bg-teal-50 border-teal-200' : 'bg-red-50 border-red-200'
            }`}>
              <span className="text-sm text-slate-600">צריכה מחושבת:</span>
              <span className={`text-xl font-bold ${consumption >= 0 ? 'text-teal-700' : 'text-red-600'}`}>
                {consumption}
              </span>
              <span className="text-sm text-slate-400">{SUG_UNITS[form.sug_mone] ?? ''}</span>
            </div>
          )}

          <FormField label="סכום לתשלום (₪)">
            <Input type="number" step="0.01" value={form.skhum_leshalem ?? ''}
              onChange={e => setField('skhum_leshalem', e.target.value)} placeholder="0"/>
          </FormField>

          <FormField label="סטטוס תשלום">
            <div className="flex items-center gap-3 h-9">
              <input type="checkbox" id="shulam" checked={!!form.shulam}
                onChange={e => setField('shulam', e.target.checked)}
                className="w-4 h-4 text-teal-600 rounded"/>
              <label htmlFor="shulam" className="text-sm text-slate-700">שולם</label>
            </div>
          </FormField>
        </div>

        <div className="mt-4">
          <FormField label="הערה">
            <Textarea value={form.heara ?? ''} onChange={e => setField('heara', e.target.value)}/>
          </FormField>
        </div>

        {chartData.length >= 2 && (
          <div className="mt-4 pt-4 border-t border-slate-100">
            <p className="text-sm font-semibold text-slate-700 mb-2">
              {SUG_EMOJI[form.sug_mone]} היסטוריית צריכה — {form.sug_mone}
            </p>
            <ConsumptionChart data={chartData} sug={form.sug_mone}/>
          </div>
        )}

        <div className="flex justify-end gap-3 mt-6">
          <Button variant="secondary" onClick={() => setModal(false)}>ביטול</Button>
          <Button loading={saving} onClick={save}>שמור</Button>
        </div>
      </Modal>
    </div>
  )
}
dary" onClick={() => setModal(false)}>ביטול</Button>
          <Button loading={saving} onClick={save}>שמור</Button>
        </div>
      </Modal>
    </div>
  )
}
