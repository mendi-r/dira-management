import React, { useEffect, useState } from 'react'
import { ChevronRight, ChevronLeft, Home, Users, Shield, FileText } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { daysUntil, formatDate } from '../lib/utils'
import Badge from '../components/ui/Badge'
import { useNavigate } from 'react-router-dom'

const MONTHS_HE = ['ינואר','פברואר','מרץ','אפריל','מאי','יוני','יולי','אוגוסט','ספטמבר','אוקטובר','נובמבר','דצמבר']
const DAYS_HE   = ['א׳','ב׳','ג׳','ד׳','ה׳','ו׳','ש׳']

function getMonthDays(year, month) {
  const first = new Date(year, month, 1)
  const last  = new Date(year, month + 1, 0)
  const startDow = first.getDay() // 0=Sun
  const days = []
  for (let i = 0; i < startDow; i++) days.push(null)
  for (let d = 1; d <= last.getDate(); d++) days.push(new Date(year, month, d))
  return days
}

const EVENT_TYPES = {
  shibutz_end:   { color:'bg-amber-100 text-amber-700',   icon: Users,   label:'סיום שיבוץ' },
  contract_end:  { color:'bg-red-100 text-red-700',       icon: FileText, label:'סיום חוזה' },
  visa_expiry:   { color:'bg-orange-100 text-orange-700', icon: Users,   label:'פג ויזה' },
  insurance:     { color:'bg-purple-100 text-purple-700', icon: Shield,   label:'חידוש ביטוח' },
}

export default function CalendarPage() {
  const navigate = useNavigate()
  const [now,    setNow]    = useState(new Date())
  const [events, setEvents] = useState({}) // { 'YYYY-MM-DD': [{...}] }
  const [sel,    setSel]    = useState(null)
  const [loading,setLoading]= useState(false)

  const year  = now.getFullYear()
  const month = now.getMonth()

  useEffect(() => { load(year, month) }, [year, month])

  async function load(y, m) {
    setLoading(true)
    const start = new Date(y, m, 1).toISOString().slice(0,10)
    const end   = new Date(y, m + 1, 0).toISOString().slice(0,10)

    const [
      { data: shibutzim },
      { data: dirot },
      { data: bochurim },
    ] = await Promise.all([
      supabase.from('shibutzim')
        .select('id,taarich_siyum,bochurim!bochurim_id(shem,mishpacha),dirot!dirot_id(ktovet)')
        .gte('taarich_siyum', start).lte('taarich_siyum', end).eq('status','פעיל'),
      supabase.from('dirot')
        .select('id,ktovet,sofit_schirut,bituach_chadush'),
      supabase.from('bochurim')
        .select('id,shem,mishpacha,tokef_viza'),
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
        label:`${s.bochurim?.shem??''} ${s.bochurim?.mishpacha??''} — ${s.dirot?.ktovet??''}`,
        id: s.id, nav: '/shibutzim',
      })
    })
    ;(dirot??[]).forEach(d => {
      if (d.sofit_schirut) add(d.sofit_schirut, {
        type:'contract_end', label:`חוזה: ${d.ktovet}`, id:d.id, nav:'/dirot',
      })
      if (d.bituach_chadush) add(d.bituach_chadush, {
        type:'insurance', label:`ביטוח: ${d.ktovet}`, id:d.id, nav:'/dirot',
      })
    })
    ;(bochurim??[]).forEach(b => {
      if (b.tokef_viza) add(b.tokef_viza, {
        type:'visa_expiry', label:`ויזה: ${b.shem??''} ${b.mishpacha??''}`, id:b.id, nav:'/bochurim',
      })
    })

    setEvents(ev)
    setLoading(false)
  }

  function prev() { setNow(d => new Date(d.getFullYear(), d.getMonth()-1, 1)); setSel(null) }
  function next() { setNow(d => new Date(d.getFullYear(), d.getMonth()+1, 1)); setSel(null) }

  const days     = getMonthDays(year, month)
  const today    = new Date().toISOString().slice(0,10)
  const selKey   = sel ? sel.toISOString().slice(0,10) : null
  const selEvents = selKey ? (events[selKey] ?? []) : []

  // Count events this month
  const totalEvents = Object.values(events).flat().length

  return (
    <div className="space-y-4 fade-in">
      {/* Header controls */}
      <div className="flex items-center justify-between">
        <button onClick={prev} className="p-2 rounded-lg hover:bg-slate-100">
          <ChevronRight size={20} className="text-slate-600"/>
        </button>
        <div className="text-center">
          <h2 className="text-lg font-bold text-slate-800">{MONTHS_HE[month]} {year}</h2>
          {loading && <p className="text-xs text-slate-400">טוען...</p>}
          {!loading && <p className="text-xs text-slate-400">{totalEvents} אירועים החודש</p>}
        </div>
        <button onClick={next} className="p-2 rounded-lg hover:bg-slate-100">
          <ChevronLeft size={20} className="text-slate-600"/>
        </button>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-2">
        {Object.entries(EVENT_TYPES).map(([k,v]) => (
          <span key={k} className={`text-xs px-2 py-1 rounded-full ${v.color}`}>{v.label}</span>
        ))}
      </div>

      {/* Calendar grid */}
      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
        {/* Day headers */}
        <div className="grid grid-cols-7 bg-slate-50 border-b border-slate-100">
          {DAYS_HE.map(d => (
            <div key={d} className="py-2 text-center text-xs font-semibold text-slate-500">{d}</div>
          ))}
        </div>

        {/* Days */}
        <div className="grid grid-cols-7">
          {days.map((day, i) => {
            if (!day) return <div key={`empty-${i}`} className="h-24 border-b border-r border-slate-50"/>
            const key     = day.toISOString().slice(0,10)
            const isToday = key === today
            const isSel   = key === selKey
            const dayEvs  = events[key] ?? []

            return (
              <div key={key}
                onClick={() => setSel(isSel ? null : day)}
                className={`h-24 border-b border-r border-slate-100 p-1.5 cursor-pointer transition-colors
                  ${isSel ? 'bg-teal-50 border-teal-200' : 'hover:bg-slate-50'}`}>
                <span className={`text-xs font-semibold inline-flex items-center justify-center w-6 h-6 rounded-full
                  ${isToday ? 'bg-teal-600 text-white' : 'text-slate-700'}`}>
                  {day.getDate()}
                </span>
                <div className="mt-0.5 space-y-0.5 overflow-hidden">
                  {dayEvs.slice(0,2).map((ev, j) => {
                    const t = EVENT_TYPES[ev.type]
                    return (
                      <div key={j} className={`text-[10px] px-1 py-0.5 rounded truncate ${t.color}`}>
                        {ev.label}
                      </div>
                    )
                  })}
                  {dayEvs.length > 2 && (
                    <div className="text-[10px] text-slate-400 px-1">+{dayEvs.length-2} נוספים</div>
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
          <h3 className="font-semibold text-slate-800 mb-3">
            {sel.getDate()} {MONTHS_HE[sel.getMonth()]} {sel.getFullYear()}
          </h3>
          {selEvents.length === 0 && <p className="text-sm text-slate-400">אין אירועים ביום זה</p>}
          <div className="space-y-2">
            {selEvents.map((ev, i) => {
              const t = EVENT_TYPES[ev.type]
              const Icon = t.icon
              return (
                <div key={i}
                  onClick={() => navigate(ev.nav)}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-xl cursor-pointer hover:opacity-80 ${t.color}`}>
                  <Icon size={16}/>
                  <div>
                    <p className="text-sm font-medium">{ev.label}</p>
                    <p className="text-xs opacity-70">{t.label}</p>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Upcoming events list */}
      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
        <div className="px-4 py-3 border-b border-slate-100">
          <h3 className="font-semibold text-slate-800">אירועים קרובים</h3>
        </div>
        <div className="divide-y divide-slate-100">
          {Object.entries(events)
            .sort(([a],[b]) => a.localeCompare(b))
            .flatMap(([date, evs]) => evs.map(ev => ({ ...ev, date })))
            .slice(0,10)
            .map((ev, i) => {
              const t = EVENT_TYPES[ev.type]
              const Icon = t.icon
              const days = daysUntil(ev.date)
              return (
                <div key={i} onClick={() => navigate(ev.nav)}
                  className="flex items-center gap-3 px-4 py-3 hover:bg-slate-50 cursor-pointer">
                  <div className={`p-2 rounded-lg ${t.color}`}><Icon size={14}/></div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-700 truncate">{ev.label}</p>
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
    </div>
  )
}
