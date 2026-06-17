import React, { useEffect, useState } from 'react'
import { ChevronRight, ChevronLeft, Users, Shield, FileText, Plus, Trash2, Edit2 } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { daysUntil, formatDate } from '../lib/utils'
import { confirm } from '../lib/confirm'
import Badge from '../components/ui/Badge'
import Modal from '../components/ui/Modal'
import Button from '../components/ui/Button'
import { FormField, Input, Select } from '../components/ui/FormField'
import { useToast } from '../components/ui/Toast'
import { useNavigate } from 'react-router-dom'

const MONTHS_HE = ['ינואר','פברואר','מרץ','אפריל','מאי','יוני','יולי','אוגוסט','ספטמבר','אוקטובר','נובמבר','דצמבר']
const DAYS_HE   = ['א׳','ב׳','ג׳','ד׳','ה׳','ו׳','ש׳']

// ── המרת מספר לאותיות עבריות (גימטריה) ──────────────────────
function hebrewNum(n) {
  if (!n || n <= 0) return ''
  if (n === 15) return 'ט"ו'
  if (n === 16) return 'ט"ז'
  const VALS = [
    [400,'ת'],[300,'ש'],[200,'ר'],[100,'ק'],
    [90,'צ'],[80,'פ'],[70,'ע'],[60,'ס'],[50,'נ'],[40,'מ'],[30,'ל'],[20,'כ'],[10,'י'],
    [9,'ט'],[8,'ח'],[7,'ז'],[6,'ו'],[5,'ה'],[4,'ד'],[3,'ג'],[2,'ב'],[1,'א'],
  ]
  let result = '', rem = n
  for (const [val, letter] of VALS) {
    while (rem >= val) { result += letter; rem -= val }
  }
  if (result.length === 1) return result + "'"
  return result.slice(0, -1) + '"' + result.slice(-1)
}

function getHebrewParts(date) {
  try {
    const fmt = new Intl.DateTimeFormat('he-IL-u-ca-hebrew', { day:'numeric', month:'long', year:'numeric' })
    const parts = {}
    fmt.formatToParts(date).forEach(p => { parts[p.type] = p.value })
    return {
      day:   Number(parts.day  ?? 0),
      month: (parts.month ?? '').replace(/^ב/, '').trim(),
      year:  Number(parts.year ?? 0),
    }
  } catch { return { day:0, month:'', year:0 } }
}

function hebrewDay(date) {
  const { day } = getHebrewParts(date)
  return hebrewNum(day)
}

function hebrewFullDate(date) {
  const { day, month, year } = getHebrewParts(date)
  return `${hebrewNum(day)} ${month} ${hebrewNum(year % 1000)}`
}
// ─────────────────────────────────────────────────────────────

function getMonthDays(year, month) {
  const first = new Date(year, month, 1)
  const last  = new Date(year, month + 1, 0)
  const startDow = first.getDay()
  const days = []
  for (let i = 0; i < startDow; i++) days.push(null)
  for (let d = 1; d <= last.getDate(); d++) days.push(new Date(year, month, d))
  return days
}

const EVENT_TYPES = {
  shibutz_end:  { color:'bg-amber-100 text-amber-700',   icon: Users,    label:'סיום שיבוץ' },
  contract_end: { color:'bg-red-100 text-red-700',       icon: FileText, label:'סיום חוזה' },
  visa_expiry:  { color:'bg-orange-100 text-orange-700', icon: Users,    label:'פג ויזה' },
  insurance:    { color:'bg-purple-100 text-purple-700', icon: Shield,   label:'חידוש ביטוח' },
  personal:     { color:'bg-teal-100 text-teal-700',     icon: null,     label:'אירוע אישי' },
}

const EMPTY_EV = { teur:'', taarich:'', sha_a:'', with_reminder:true, reminder_days:1 }

export default function CalendarPage() {
  const navigate  = useNavigate()
  const toast     = useToast()
  const [now,     setNow]     = useState(new Date())
  const [events,  setEvents]  = useState({})
  const [persEvs, setPersEvs] = useState({})
  const [sel,     setSel]     = useState(null)
  const [loading, setLoading] = useState(false)
  const [evModal, setEvModal] = useState(false)
  const [evForm,  setEvForm]  = useState(EMPTY_EV)
  const [evSaving,setEvSaving]= useState(false)

  const year  = now.getFullYear()
  const month = now.getMonth()

  useEffect(() => { load(year, month) }, [year, month])

  async function load(y, m) {
    setLoading(true)
    const start = new Date(y, m, 1).toISOString().slice(0,10)
    const end   = new Date(y, m+1, 0).toISOString().slice(0,10)

    const [
      { data: shibutzim },
      { data: dirot },
      { data: bochurim },
      { data: calEvs },
    ] = await Promise.all([
      supabase.from('shibutzim')
        .select('id,taarich_siyum,bochurim!bochurim_id(shem,mishpacha),dirot!dirot_id(ktovet)')
        .gte('taarich_siyum', start).lte('taarich_siyum', end).eq('status','פעיל'),
      supabase.from('dirot').select('id,ktovet,sofit_schirut,bituach_chadush'),
      supabase.from('bochurim').select('id,shem,mishpacha,tokef_viza'),
      supabase.from('calendar_events').select('*').gte('taarich', start).lte('taarich', end),
    ])

    const ev = {}
    function add(date, obj) {
      if (!date || date < start || date > end) return
      if (!ev[date]) ev[date] = []
      ev[date].push(obj)
    }

    ;(shibutzim??[]).forEach(s => {
      if (s.taarich_siyum) add(s.taarich_siyum, {
        type:'shibutz_end',
        title:`${s.bochurim?.shem??''} ${s.bochurim?.mishpacha??''}`.trim(),
        subtitle: s.dirot?.ktovet ?? '',
        label:`${s.bochurim?.shem??''} ${s.bochurim?.mishpacha??''} — ${s.dirot?.ktovet??''}`,
        id:s.id, nav:'/shibutzim',
      })
    })
    ;(dirot??[]).forEach(d => {
      if (d.sofit_schirut) add(d.sofit_schirut, { type:'contract_end', title:d.ktovet??'', subtitle:null, label:`חוזה: ${d.ktovet}`, id:d.id, nav:'/dirot' })
      if (d.bituach_chadush) add(d.bituach_chadush, { type:'insurance', title:d.ktovet??'', subtitle:null, label:`ביטוח: ${d.ktovet}`, id:d.id, nav:'/dirot' })
    })
    ;(bochurim??[]).forEach(b => {
      if (b.tokef_viza) add(b.tokef_viza, { type:'visa_expiry', title:`${b.shem??''} ${b.mishpacha??''}`.trim(), subtitle:null, label:`ויזה: ${b.shem??''} ${b.mishpacha??''}`, id:b.id, nav:'/bochurim' })
    })

    // אירועים אישיים
    const pev = {}
    ;(calEvs??[]).forEach(e => {
      if (!pev[e.taarich]) pev[e.taarich] = []
      pev[e.taarich].push(e)
    })

    setEvents(ev)
    setPersEvs(pev)
    setLoading(false)
  }

  function prev() { setNow(d => new Date(d.getFullYear(), d.getMonth()-1, 1)); setSel(null) }
  function next() { setNow(d => new Date(d.getFullYear(), d.getMonth()+1, 1)); setSel(null) }

  const days       = getMonthDays(year, month)
  const todayKey   = new Date().toISOString().slice(0,10)
  const selKey     = sel ? sel.toISOString().slice(0,10) : null
  const selEvents  = selKey ? (events[selKey] ?? []) : []
  const selPersEvs = selKey ? (persEvs[selKey] ?? []) : []
  const totalEvents = Object.values(events).flat().length + Object.values(persEvs).flat().length

  // ── פתיחת מודל אירוע ──
  function openNewEv(date) {
    setEvForm({ ...EMPTY_EV, taarich: date ? date.toISOString().slice(0,10) : '' })
    setEvModal(true)
  }
  function openEditEv(ev) {
    setEvForm({ teur:ev.teur, taarich:ev.taarich, sha_a:ev.sha_a??'', with_reminder:ev.with_reminder, reminder_days:ev.reminder_days??1, _id:ev.id })
    setEvModal(true)
  }

  async function saveEv() {
    if (!evForm.teur) { toast('יש להזין תיאור', 'error'); return }
    if (!evForm.taarich) { toast('יש להזין תאריך', 'error'); return }
    setEvSaving(true)
    const { data: { user } } = await supabase.auth.getUser()
    const payload = {
      user_id: user.id,
      teur: evForm.teur,
      taarich: evForm.taarich,
      sha_a: evForm.sha_a || null,
      with_reminder: !!evForm.with_reminder,
      reminder_days: Number(evForm.reminder_days ?? 1),
    }
    const isNew = !evForm._id
    const { error } = isNew
      ? await supabase.from('calendar_events').insert(payload)
      : await supabase.from('calendar_events').update(payload).eq('id', evForm._id)
    setEvSaving(false)
    if (error) { toast(error.message, 'error'); return }
    toast(isNew ? 'אירוע נוסף' : 'עודכן')
    setEvModal(false)
    load(year, month)
  }

  async function deleteEv(id) {
    if (!await confirm('למחוק אירוע זה?', { danger:true })) return
    await supabase.from('calendar_events').delete().eq('id', id)
    toast('נמחק')
    load(year, month)
  }

  return (
    <div className="space-y-4 fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <button onClick={prev} className="p-2 rounded-lg hover:bg-slate-100"><ChevronRight size={20} className="text-slate-600"/></button>
        <div className="text-center">
          <h2 className="text-lg font-bold text-slate-800">{MONTHS_HE[month]} {year}</h2>
          {loading
            ? <p className="text-xs text-slate-400">טוען...</p>
            : <p className="text-xs text-slate-400">{totalEvents} אירועים החודש</p>
          }
        </div>
        <button onClick={next} className="p-2 rounded-lg hover:bg-slate-100"><ChevronLeft size={20} className="text-slate-600"/></button>
      </div>

      {/* Legend + כפתור הוסף */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap gap-2">
          {Object.entries(EVENT_TYPES).map(([k,v]) => (
            <span key={k} className={`text-xs px-2 py-1 rounded-full ${v.color}`}>{v.label}</span>
          ))}
        </div>
        <Button icon={Plus} onClick={() => openNewEv(sel)}>אירוע חדש</Button>
      </div>

      {/* Calendar grid */}
      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
        <div className="grid grid-cols-7 bg-slate-50 border-b border-slate-100">
          {DAYS_HE.map(d => (
            <div key={d} className="py-2 text-center text-xs font-semibold text-slate-500">{d}</div>
          ))}
        </div>
        <div className="grid grid-cols-7">
          {days.map((day, i) => {
            if (!day) return <div key={`empty-${i}`} className="h-28 border-b border-r border-slate-50"/>
            const key    = day.toISOString().slice(0,10)
            const isToday = key === todayKey
            const isSel  = key === selKey
            const dayEvs = events[key] ?? []
            const dayPev = persEvs[key] ?? []
            const allEvs = [...dayEvs, ...dayPev.map(e => ({ ...e, type:'personal', label:e.teur }))]

            return (
              <div key={key}
                onClick={() => setSel(isSel ? null : day)}
                className={`h-28 border-b border-r border-slate-100 p-1.5 cursor-pointer transition-colors relative group
                  ${isSel ? 'bg-teal-50 border-teal-200' : 'hover:bg-slate-50'}`}>
                <div className="flex flex-col items-start">
                  <span className={`text-xs font-semibold inline-flex items-center justify-center w-6 h-6 rounded-full
                    ${isToday ? 'bg-teal-600 text-white' : 'text-slate-700'}`}>
                    {day.getDate()}
                  </span>
                  <span className="text-[9px] text-slate-400 leading-tight pr-0.5">{hebrewDay(day)}</span>
                </div>
                {/* כפתור + בhover */}
                <button
                  onClick={e => { e.stopPropagation(); openNewEv(day) }}
                  className="absolute top-1 left-1 w-5 h-5 rounded-full bg-teal-500 text-white items-center justify-center text-xs hidden group-hover:flex hover:bg-teal-600"
                  title="הוסף אירוע">+</button>
                <div className="mt-0.5 space-y-0.5 overflow-hidden">
                  {allEvs.slice(0,2).map((ev, j) => {
                    const t = EVENT_TYPES[ev.type] ?? EVENT_TYPES.personal
                    return (
                      <div key={j} className={`text-[10px] px-1 py-0.5 rounded truncate ${t.color}`}>
                        {ev.label ?? ev.teur}
                      </div>
                    )
                  })}
                  {allEvs.length > 2 && (
                    <div className="text-[10px] text-slate-400 px-1">+{allEvs.length-2} נוספים</div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Selected day panel */}
      {sel && (
        <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm">
          <div className="flex items-start justify-between mb-3">
            <div>
              <h3 className="font-semibold text-slate-800">{sel.getDate()} {MONTHS_HE[sel.getMonth()]} {sel.getFullYear()}</h3>
              <p className="text-xs text-slate-400">{hebrewFullDate(sel)}</p>
            </div>
            <button onClick={() => openNewEv(sel)}
              className="flex items-center gap-1 text-xs text-teal-600 hover:text-teal-800 border border-teal-200 rounded-lg px-2 py-1 hover:bg-teal-50">
              <Plus size={12}/> הוסף אירוע
            </button>
          </div>

          {selEvents.length === 0 && selPersEvs.length === 0 &&
            <p className="text-sm text-slate-400">אין אירועים ביום זה</p>
          }

          <div className="space-y-2">
            {/* אירועי מערכת */}
            {selEvents.map((ev, i) => {
              const t = EVENT_TYPES[ev.type]
              const Icon = t.icon
              return (
                <div key={i} onClick={() => navigate(ev.nav)}
                  className={`flex items-start gap-3 px-3 py-3 rounded-xl cursor-pointer hover:opacity-80 ${t.color}`}>
                  {Icon && <div className="mt-0.5"><Icon size={16}/></div>}
                  <div className="flex-1 min-w-0">
                    <span className="text-[10px] font-semibold uppercase tracking-wide opacity-60">{t.label}</span>
                    <p className="text-sm font-semibold leading-tight mt-0.5">{ev.title || ev.label}</p>
                    {ev.subtitle && <p className="text-xs opacity-70 mt-0.5">{ev.subtitle}</p>}
                  </div>
                </div>
              )
            })}

            {/* אירועים אישיים */}
            {selPersEvs.map((ev, i) => (
              <div key={i} className="flex items-start gap-3 px-3 py-3 rounded-xl bg-teal-50 border border-teal-100">
                <div className="flex-1 min-w-0">
                  <span className="text-[10px] font-semibold text-teal-500 uppercase tracking-wide">אירוע אישי</span>
                  <p className="text-sm font-semibold text-teal-800 leading-tight mt-0.5">{ev.teur}</p>
                  {ev.sha_a && <p className="text-xs text-teal-600 mt-0.5">🕐 {ev.sha_a.slice(0,5)}</p>}
                  {ev.with_reminder && <p className="text-xs text-slate-400 mt-0.5">🔔 תזכורת {ev.reminder_days} יום לפני</p>}
                </div>
                <div className="flex gap-1 flex-shrink-0">
                  <button onClick={() => openEditEv(ev)} className="p-1.5 rounded text-teal-400 hover:text-teal-700 hover:bg-teal-100"><Edit2 size={13}/></button>
                  <button onClick={() => deleteEv(ev.id)} className="p-1.5 rounded text-red-400 hover:text-red-600 hover:bg-red-50"><Trash2 size={13}/></button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* אירועים קרובים */}
      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
        <div className="px-4 py-3 border-b border-slate-100">
          <h3 className="font-semibold text-slate-800">אירועים קרובים</h3>
        </div>
        <div className="divide-y divide-slate-100">
          {[
            ...Object.entries(events).flatMap(([date, evs]) => evs.map(ev => ({ ...ev, date }))),
            ...Object.entries(persEvs).flatMap(([date, evs]) => evs.map(ev => ({ ...ev, type:'personal', label:ev.teur, date }))),
          ]
            .sort((a,b) => a.date.localeCompare(b.date))
            .slice(0,10)
            .map((ev, i) => {
              const t = EVENT_TYPES[ev.type] ?? EVENT_TYPES.personal
              const Icon = t.icon
              const days = daysUntil(ev.date)
              return (
                <div key={i}
                  onClick={() => ev.nav ? navigate(ev.nav) : undefined}
                  className={`flex items-center gap-3 px-4 py-3 hover:bg-slate-50 ${ev.nav ? 'cursor-pointer' : ''}`}>
                  <div className={`p-2 rounded-lg ${t.color}`}>{Icon ? <Icon size={14}/> : <span className="text-xs">✦</span>}</div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-700 truncate">{ev.label ?? ev.teur}</p>
                    <p className="text-xs text-slate-400">{t.label} · {formatDate(ev.date)}</p>
                  </div>
                  <span className={`text-xs font-medium px-2 py-1 rounded-full whitespace-nowrap
                    ${(days??99)<=7?'bg-red-100 text-red-700':(days??99)<=30?'bg-amber-100 text-amber-700':'bg-slate-100 text-slate-500'}`}>
                    {days === 0 ? 'היום' : days === 1 ? 'מחר' : `בעוד ${days} ימים`}
                  </span>
                </div>
              )
            })}
          {totalEvents === 0 && (
            <div className="px-4 py-8 text-center text-slate-400 text-sm">אין אירועים החודש</div>
          )}
        </div>
      </div>

      {/* מודל אירוע אישי */}
      <Modal open={evModal} onClose={() => setEvModal(false)} title={evForm._id ? 'עריכת אירוע' : 'אירוע חדש'} size="sm">
        <div className="space-y-4">
          <FormField label="תיאור האירוע" required>
            <Input value={evForm.teur} onChange={e => setEvForm(f => ({...f, teur:e.target.value}))} placeholder="פגישה, תשלום, חג..."/>
          </FormField>
          <FormField label="תאריך" required>
            <Input type="date" value={evForm.taarich} onChange={e => setEvForm(f => ({...f, taarich:e.target.value}))}/>
          </FormField>
          <FormField label="שעה (אופציונלי)">
            <Input type="time" value={evForm.sha_a} onChange={e => setEvForm(f => ({...f, sha_a:e.target.value}))}/>
          </FormField>
          <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl">
            <input type="checkbox" id="reminder" checked={!!evForm.with_reminder}
              onChange={e => setEvForm(f => ({...f, with_reminder:e.target.checked}))}
              className="w-4 h-4 accent-teal-600"/>
            <label htmlFor="reminder" className="text-sm text-slate-700">תזכורת בפעמון</label>
            {evForm.with_reminder && (
              <div className="flex items-center gap-1.5 mr-auto">
                <Input type="number" min="1" max="30"
                  value={evForm.reminder_days}
                  onChange={e => setEvForm(f => ({...f, reminder_days:e.target.value}))}
                  className="w-16 text-center text-sm"/>
                <span className="text-sm text-slate-500">ימים לפני</span>
              </div>
            )}
          </div>
        </div>
        <div className="flex justify-between mt-6 pt-4 border-t border-slate-100">
          {evForm._id
            ? <button onClick={() => deleteEv(evForm._id)} className="text-sm text-red-500 hover:text-red-700">מחק אירוע</button>
            : <span/>
          }
          <div className="flex gap-3">
            <Button variant="secondary" onClick={() => setEvModal(false)}>ביטול</Button>
            <Button loading={evSaving} onClick={saveEv}>שמור</Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
