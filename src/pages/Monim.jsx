import React, { useEffect, useState, useCallback } from 'react'
import { PlusCircle, Edit2, Trash2, Gauge, RefreshCw } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { formatDate, toInputDate, today } from '../lib/utils'
import { Table } from '../components/ui/Table'
import SearchInput from '../components/ui/SearchInput'
import Modal from '../components/ui/Modal'
import Button from '../components/ui/Button'
import Badge from '../components/ui/Badge'
import { FormField, Input, Select, Textarea } from '../components/ui/FormField'
import { StatCard } from '../components/ui/Card'
import { useToast } from '../components/ui/Toast'

const EMPTY = { dirot_id:'', sug:'חשמל', kriah_kodem:'', kriah_nochchi:'', taarich:'', is_kria_ptika:false, heara:'' }
const SUG_COLORS = { חשמל:'amber', מים:'blue', גז:'red', אחר:'gray' }

function ConsumptionChart({ data, sug }) {
  if (!data || data.length < 2) return <p className="text-sm text-slate-400 py-4">נדרשות לפחות 2 קריאות לגרף</p>
  const vals = data
    .filter(d => !d.is_kria_ptika)
    .map(d => Math.max(0, Number(d.kriah_nochchi??0) - Number(d.kriah_kodem??0)))
  if (!vals.length) return null
  const max = Math.max(...vals, 1)
  const W = 320, H = 120, pad = 20, barW = Math.max(8, (W - pad*2) / vals.length - 4)
  const color = sug==='חשמל' ? '#f59e0b' : sug==='מים' ? '#3b82f6' : '#ef4444'
  return (
    <div className="overflow-x-auto">
      <svg viewBox={`0 0 ${W} ${H+30}`} className="w-full max-w-xs">
        {vals.map((v, i) => {
          const x = pad + i * ((W - pad*2) / vals.length)
          const h = (v / max) * H
          return (
            <g key={i}>
              <rect x={x} y={H - h + 5} width={barW} height={h} fill={color} rx="2" opacity="0.8"/>
              <text x={x + barW/2} y={H+22} textAnchor="middle" fontSize="9" fill="#64748b">{v}</text>
            </g>
          )
        })}
        <line x1={pad} y1={5} x2={pad} y2={H+5} stroke="#e2e8f0" strokeWidth="1"/>
        <line x1={pad} y1={H+5} x2={W-pad} y2={H+5} stroke="#e2e8f0" strokeWidth="1"/>
      </svg>
    </div>
  )
}

function calcConsumption(prev, curr, isPtika) {
  if (isPtika) return null
  const p = Number(prev??0), c = Number(curr??0)
  if (!prev || !curr || c < p) return null
  return c - p
}

export default function Monim() {
  const toast = useToast()
  const [rows, setRows]           = useState([])
  const [dirot, setDirot]         = useState([])
  const [loading, setLoading]     = useState(true)
  const [search, setSearch]       = useState('')
  const [sugFilter, setSugFilter] = useState('')
  const [dirotFilter, setDirotFilter] = useState('')
  const [modal, setModal]         = useState(false)
  const [form, setForm]           = useState(EMPTY)
  const [saving, setSaving]       = useState(false)
  const [chartData, setChartData] = useState([])

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true)
    let q = supabase.from('riut').select('*, dirot(ktovet,ir)')
      .order('taarich', { ascending: true })
    if (sugFilter)   q = q.eq('sug', sugFilter)
    if (dirotFilter) q = q.eq('dirot_id', dirotFilter)
    const [{ data:r }, { data:d }] = await Promise.all([
      q,
      supabase.from('dirot').select('id,ktovet,ir').order('ktovet'),
    ])
    setRows(r ?? [])
    setDirot(d ?? [])
    setLoading(false)
  }, [sugFilter, dirotFilter])

  useEffect(() => { load() }, [load])

  async function loadChart(dirotId, sug) {
    if (!dirotId || !sug) return
    const { data } = await supabase.from('riut')
      .select('*')
      .eq('dirot_id', dirotId)
      .eq('sug', sug)
      .order('taarich', { ascending: true })
      .limit(12)
    setChartData(data ?? [])
  }

  const filtered = rows.filter(r =>
    `${r.dirot?.ktovet??''} ${r.dirot?.ir??''} ${r.sug??''}`
      .toLowerCase().includes(search.toLowerCase())
  )

  // Totals by type
  const totalChashmal = filtered.filter(r=>r.sug==='חשמל')
    .reduce((s,r) => s + (calcConsumption(r.kriah_kodem, r.kriah_nochchi, r.is_kria_ptika) ?? 0), 0)
  const totalMayim = filtered.filter(r=>r.sug==='מים')
    .reduce((s,r) => s + (calcConsumption(r.kriah_kodem, r.kriah_nochchi, r.is_kria_ptika) ?? 0), 0)
  const totalGaz = filtered.filter(r=>r.sug==='גז')
    .reduce((s,r) => s + (calcConsumption(r.kriah_kodem, r.kriah_nochchi, r.is_kria_ptika) ?? 0), 0)

  // Per-dira breakdown
  const byDira = {}
  filtered.forEach(r => {
    if (!r.dirot_id) return
    const key = r.dirot_id
    if (!byDira[key]) byDira[key] = { ktovet: r.dirot?.ktovet ?? '—', ir: r.dirot?.ir ?? '', חשמל:0, מים:0, גז:0 }
    const c = calcConsumption(r.kriah_kodem, r.kriah_nochchi, r.is_kria_ptika)
    if (c !== null) byDira[key][r.sug] = (byDira[key][r.sug] ?? 0) + c
  })
  const diraBreakdown = Object.values(byDira)

  function openNew()  { setForm({ ...EMPTY, taarich: today() }); setChartData([]); setModal(true) }
  function openEdit(r){
    setForm({ ...EMPTY, ...r, taarich: toInputDate(r.taarich) })
    loadChart(r.dirot_id, r.sug)
    setModal(true)
  }

  async function save() {
    if (!form.dirot_id)      { toast('יש לבחור דירה','error'); return }
    if (!form.kriah_nochchi) { toast('קריאה נוכחית חובה','error'); return }
    setSaving(true)
    const payload = {
      dirot_id: form.dirot_id,
      sug: form.sug,
      kriah_kodem:   form.is_kria_ptika ? null : (form.kriah_kodem ? Number(form.kriah_kodem) : null),
      kriah_nochchi: Number(form.kriah_nochchi),
      is_kria_ptika: !!form.is_kria_ptika,
      taarich: form.taarich || null,
      heara: form.heara,
    }
    const isNew = !form.id
    const { error } = isNew
      ? await supabase.from('riut').insert(payload)
      : await supabase.from('riut').update(payload).eq('id', form.id)
    setSaving(false)
    if (error) { toast(error.message, 'error'); return }
    toast(isNew ? 'נוסף' : 'עודכן')
    setModal(false)
    load(true)
  }

  async function remove(id) {
    if (!confirm('למחוק קריאה זו?')) return
    await supabase.from('riut').delete().eq('id', id)
    toast('נמחק')
    load(true)
  }

  const columns = [
    { key:'dirot',         label:'דירה',   render:v => v ? v.ktovet : '—' },
    { key:'sug',           label:'סוג',     render:v => <Badge color={SUG_COLORS[v]??'gray'}>{v??'—'}</Badge> },
    { key:'is_kria_ptika', label:'קריאה',  render:v => <span className="text-xs text-slate-500">{v?'פתיחה':'המשך'}</span> },
    { key:'kriah_kodem',   label:'קודמת' },
    { key:'kriah_nochchi', label:'נוכחית' },
    { key:'_consumption',  label:'צריכה',   render:(_,row) => {
      if (row.is_kria_ptika) return <span className="text-slate-300 text-xs">—</span>
      const c = calcConsumption(row.kriah_kodem, row.kriah_nochchi, row.is_kria_ptika)
      return c !== null
        ? <span className="font-bold text-teal-700">{c}</span>
        : <span className="text-slate-300">—</span>
    }},
    { key:'taarich', label:'תאריך', render:v => formatDate(v) },
    { key:'actions', label:'', width:80, render:(_,row) => (
      <div className="flex gap-1">
        <button onClick={e=>{e.stopPropagation();openEdit(row)}} className="p-1.5 rounded text-slate-400 hover:text-teal-600 hover:bg-teal-50"><Edit2 size={14}/></button>
        <button onClick={e=>{e.stopPropagation();remove(row.id)}} className="p-1.5 rounded text-slate-400 hover:text-red-600 hover:bg-red-50"><Trash2 size={14}/></button>
      </div>
    )},
  ]

  return (
    <div className="space-y-4 fade-in">

      {/* StatCards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard label="סה״כ צריכת חשמל" value={`${totalChashmal} יח׳`} icon={Gauge} color="amber"/>
        <StatCard label="סה״כ צריכת מים"  value={`${totalMayim} יח׳`}   icon={Gauge} color="blue"/>
        <StatCard label="סה״כ צריכת גז"   value={`${totalGaz} יח׳`}     icon={Gauge} color="red"/>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex-1 min-w-48">
          <SearchInput value={search} onChange={setSearch} placeholder="כתובת, סוג..."/>
        </div>
        <select value={sugFilter} onChange={e=>setSugFilter(e.target.value)}
          className="px-3 py-2 text-sm rounded-lg border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-teal-400">
          <option value="">כל סוגי המונים</option>
          <option value="חשמל">חשמל</option>
          <option value="מים">מים</option>
          <option value="גז">גז</option>
        </select>
        <select value={dirotFilter} onChange={e=>setDirotFilter(e.target.value)}
          className="px-3 py-2 text-sm rounded-lg border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-teal-400">
          <option value="">כל הדירות</option>
          {dirot.map(d => <option key={d.id} value={d.id}>{d.ktovet}</option>)}
        </select>
        <button onClick={() => load()} className="p-2 rounded-lg border border-slate-200 bg-white text-slate-500 hover:text-teal-600 hover:border-teal-300" title="רענן">
          <RefreshCw size={16}/>
        </button>
        <Button icon={PlusCircle} onClick={openNew}>קריאה חדשה</Button>
      </div>

      <p className="text-sm text-slate-400">{filtered.length} קריאות</p>
      <Table columns={columns} data={filtered} loading={loading} emptyText="לא נמצאו קריאות" onRowClick={openEdit}/>

      {/* Per-dira breakdown */}
      {diraBreakdown.length > 0 && (
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
          <div className="px-4 py-3 border-b border-slate-100">
            <h3 className="font-semibold text-slate-800 text-sm">צריכה לפי דירה</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-right text-xs text-slate-500 border-b border-slate-100 bg-slate-50">
                  <th className="px-4 py-2 font-medium">דירה</th>
                  <th className="px-4 py-2 font-medium text-amber-600">⚡ חשמל</th>
                  <th className="px-4 py-2 font-medium text-blue-600">💧 מים</th>
                  <th className="px-4 py-2 font-medium text-red-500">🔥 גז</th>
                </tr>
              </thead>
              <tbody>
                {diraBreakdown.map((d, i) => (
                  <tr key={i} className="border-b border-slate-50 hover:bg-slate-50">
                    <td className="px-4 py-2.5 font-medium text-slate-700">
                      {d.ktovet}{d.ir ? `, ${d.ir}` : ''}
                    </td>
                    <td className="px-4 py-2.5 text-amber-700 font-semibold">
                      {d['חשמל'] > 0 ? `${d['חשמל']} יח׳` : <span className="text-slate-300">—</span>}
                    </td>
                    <td className="px-4 py-2.5 text-blue-700 font-semibold">
                      {d['מים'] > 0 ? `${d['מים']} יח׳` : <span className="text-slate-300">—</span>}
                    </td>
                    <td className="px-4 py-2.5 text-red-600 font-semibold">
                      {d['גז'] > 0 ? `${d['גז']} יח׳` : <span className="text-slate-300">—</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-slate-200 bg-slate-50 font-bold text-sm">
                  <td className="px-4 py-2.5 text-slate-600">סה״כ</td>
                  <td className="px-4 py-2.5 text-amber-700">{totalChashmal > 0 ? `${totalChashmal} יח׳` : '—'}</td>
                  <td className="px-4 py-2.5 text-blue-700">{totalMayim > 0 ? `${totalMayim} יח׳` : '—'}</td>
                  <td className="px-4 py-2.5 text-red-600">{totalGaz > 0 ? `${totalGaz} יח׳` : '—'}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}

      {/* Modal */}
      <Modal open={modal} onClose={()=>setModal(false)} title={form.id ? 'עריכת קריאה' : 'קריאה חדשה'} size="lg">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <FormField label="דירה" required>
            <Select value={form.dirot_id??''} onChange={e=>{
              setForm(f=>({...f, dirot_id:e.target.value}))
              loadChart(e.target.value, form.sug)
            }}>
              <option value="">-- בחר דירה --</option>
              {dirot.map(d => <option key={d.id} value={d.id}>{d.ktovet}{d.ir?`, ${d.ir}`:''}</option>)}
            </Select>
          </FormField>
          <FormField label="סוג מונה">
            <Select value={form.sug??'חשמל'} onChange={e=>{
              setForm(f=>({...f, sug:e.target.value}))
              loadChart(form.dirot_id, e.target.value)
            }}>
              <option value="חשמל">חשמל ⚡</option>
              <option value="מים">מים 💧</option>
              <option value="גז">גז 🔥</option>
              <option value="אחר">אחר</option>
            </Select>
          </FormField>
          <div className="sm:col-span-2 flex items-center gap-2">
            <input type="checkbox" id="is_kria_ptika" checked={!!form.is_kria_ptika}
              onChange={e=>setForm(f=>({...f, is_kria_ptika:e.target.checked}))}
              className="w-4 h-4 text-teal-600 rounded"/>
            <label htmlFor="is_kria_ptika" className="text-sm text-slate-700">
              קריאת פתיחה (ראשונה לדירה/מונה זה)
            </label>
          </div>
          {!form.is_kria_ptika && (
            <FormField label="קריאה קודמת">
              <Input type="number" value={form.kriah_kodem??''} onChange={e=>setForm(f=>({...f,kriah_kodem:e.target.value}))} placeholder="0"/>
            </FormField>
          )}
          <FormField label="קריאה נוכחית" required>
            <Input type="number" value={form.kriah_nochchi??''} onChange={e=>setForm(f=>({...f,kriah_nochchi:e.target.value}))} placeholder="0"/>
          </FormField>
          <FormField label="תאריך קריאה">
            <Input type="date" value={form.taarich??''} onChange={e=>setForm(f=>({...f,taarich:e.target.value}))}/>
          </FormField>
          {!form.is_kria_ptika && form.kriah_kodem && form.kriah_nochchi && (
            <FormField label="צריכה מחושבת">
              <div className="px-3 py-2 bg-teal-50 rounded-lg text-teal-700 font-bold">
                {Math.max(0, Number(form.kriah_nochchi) - Number(form.kriah_kodem))} יחידות
              </div>
            </FormField>
          )}
        </div>
        <div className="mt-4">
          <FormField label="הערה">
            <Textarea value={form.heara??''} onChange={e=>setForm(f=>({...f,heara:e.target.value}))}/>
          </FormField>
        </div>

        {chartData.length >= 2 && (
          <div className="mt-4 pt-4 border-t border-slate-100">
            <p className="text-sm font-semibold text-slate-700 mb-2">גרף צריכה — {form.sug}</p>
            <ConsumptionChart data={chartData} sug={form.sug}/>
          </div>
        )}

        <div className="flex justify-end gap-3 mt-6">
          <Button variant="secondary" onClick={()=>setModal(false)}>ביטול</Button>
          <Button loading={saving} onClick={save}>שמור</Button>
        </div>
      </Modal>
    </div>
  )
}
