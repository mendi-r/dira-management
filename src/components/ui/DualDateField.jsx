/**
 * DualDateField — Gregorian input + Hebrew display + visual Hebrew calendar picker
 */
import React, { useState, useMemo, useRef, useEffect } from 'react'
import { HDate, gematriya } from '@hebcal/hdate'
import { ChevronRight, ChevronLeft, Calendar } from 'lucide-react'

// Hebrew month names (HDate month numbers)
const HEB_MONTHS = {
  1: 'ניסן', 2: 'אייר', 3: 'סיון', 4: 'תמוז', 5: 'אב', 6: 'אלול',
  7: 'תשרי', 8: 'חשון', 9: 'כסלו', 10: 'טבת', 11: 'שבט', 12: 'אדר', 13: 'אדר ב׳',
}
const HEB_MONTHS_BY_NAME = Object.fromEntries(
  Object.entries(HEB_MONTHS).map(([k, v]) => [v, Number(k)])
)
const DAYS_OF_WEEK = ['א׳', 'ב׳', 'ג׳', 'ד׳', 'ה׳', 'ו׳', 'ש׳'] // Sun→Sat

function getMonthName(month, year) {
  if (month === 12 && HDate.isLeapYear(year)) return 'אדר א׳'
  return HEB_MONTHS[month] ?? ''
}

function nextMonthNav(month, year) {
  if (month === 6) return { month: 7, year: year + 1 }
  const maxM = HDate.isLeapYear(year) ? 13 : 12
  if (month === maxM) return { month: 1, year }
  return { month: month + 1, year }
}

function prevMonthNav(month, year) {
  if (month === 7) return { month: 6, year: year - 1 }
  if (month === 1) return { month: HDate.isLeapYear(year) ? 13 : 12, year }
  return { month: month - 1, year }
}

function buildMonthGrid(hMonth, hYear) {
  const firstHDate = new HDate(1, hMonth, hYear)
  const firstGreg  = firstHDate.greg()
  const dow        = firstGreg.getDay() // 0=Sun
  const daysInMonth = HDate.daysInMonth(hMonth, hYear)
  const cells = []
  for (let i = 0; i < dow; i++) cells.push(null)
  for (let d = 1; d <= daysInMonth; d++) {
    const hd   = new HDate(d, hMonth, hYear)
    const greg = hd.greg()
    const iso  = `${greg.getFullYear()}-${String(greg.getMonth()+1).padStart(2,'0')}-${String(greg.getDate()).padStart(2,'0')}`
    cells.push({ hDay: d, gregISO: iso })
  }
  while (cells.length % 7 !== 0) cells.push(null)
  return cells
}

/** Convert YYYY-MM-DD → Hebrew string "ל׳ סיון תשפ״ו" */
export function toHebrewDate(iso) {
  if (!iso) return ''
  try {
    const h = new HDate(new Date(iso + 'T12:00:00'))
    return `${gematriya(h.getDate())} ${HEB_MONTHS[h.getMonth()]} ${gematriya(h.getFullYear())}`
  } catch { return '' }
}

/** Try to parse a Hebrew date string into YYYY-MM-DD */
function parseHebrewDate(str) {
  if (!str) return null
  str = str.trim()
  const parts = str.split(/\s+/)
  if (parts.length < 3) return null
  const dayStr    = parts[0].replace(/[׳״]/g, '')
  const monthPart = parts.slice(1, -1).join(' ')
  const yearStr   = parts[parts.length - 1]
  let day = parseInt(dayStr)
  if (isNaN(day)) day = hebrewLettersToNum(dayStr)
  const month = HEB_MONTHS_BY_NAME[monthPart]
  let year = parseInt(yearStr.replace(/[׳״]/g, ''))
  if (isNaN(year) || year < 100) year = hebrewLettersToNum(yearStr)
  if (!day || !month || !year) return null
  try {
    const h = new HDate(day, month, year)
    const g = h.greg()
    return g.toISOString().slice(0, 10)
  } catch { return null }
}

function hebrewLettersToNum(str) {
  const vals = {
    'א':1,'ב':2,'ג':3,'ד':4,'ה':5,'ו':6,'ז':7,'ח':8,'ט':9,
    'י':10,'כ':20,'ל':30,'מ':40,'נ':50,'ס':60,'ע':70,'פ':80,'צ':90,
    'ק':100,'ר':200,'ש':300,'ת':400,
    'ך':20,'ם':40,'ן':50,'ף':80,'ץ':90,
  }
  let total = 0
  for (const ch of str.replace(/[״׳]/g, '')) total += vals[ch] ?? 0
  return total || NaN
}

function getInitialView(value) {
  try {
    if (value) {
      const h = new HDate(new Date(value + 'T12:00:00'))
      return { month: h.getMonth(), year: h.getFullYear() }
    }
  } catch {}
  const h = new HDate()
  return { month: h.getMonth(), year: h.getFullYear() }
}

export default function DualDateField({ value, onChange, required, disabled }) {
  const [hebrewInput,   setHebrewInput]   = useState('')
  const [hebrewMode,    setHebrewMode]    = useState(false)
  const [showCalendar,  setShowCalendar]  = useState(false)
  const [viewMonth,     setViewMonth]     = useState(() => getInitialView(value).month)
  const [viewYear,      setViewYear]      = useState(() => getInitialView(value).year)
  const popupRef = useRef(null)

  const hebrewDisplay = useMemo(() => toHebrewDate(value), [value])
  const cells         = useMemo(() => buildMonthGrid(viewMonth, viewYear), [viewMonth, viewYear])
  const todayISO      = useMemo(() => new Date().toISOString().slice(0, 10), [])

  // קבלת היום העברי הנבחר (לסימון בלוח)
  let selectedHDay = null
  if (value) {
    try {
      const h = new HDate(new Date(value + 'T12:00:00'))
      if (h.getMonth() === viewMonth && h.getFullYear() === viewYear)
        selectedHDay = h.getDate()
    } catch {}
  }

  // סגירת הלוח בלחיצה מחוץ
  useEffect(() => {
    if (!showCalendar) return
    const handler = (e) => {
      if (popupRef.current && !popupRef.current.contains(e.target))
        setShowCalendar(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [showCalendar])

  function openCalendar() {
    const v = getInitialView(value)
    setViewMonth(v.month); setViewYear(v.year)
    setShowCalendar(true)
  }

  function selectDay(gregISO) {
    onChange(gregISO)
    setShowCalendar(false)
  }

  function goToday() {
    const today = new Date()
    const h     = new HDate(today)
    setViewMonth(h.getMonth()); setViewYear(h.getFullYear())
    selectDay(today.toISOString().slice(0, 10))
  }

  function handleHebrewChange(e) {
    setHebrewInput(e.target.value)
    const iso = parseHebrewDate(e.target.value)
    if (iso) onChange(iso)
  }

  function handleHebrewBlur() {
    const iso = parseHebrewDate(hebrewInput)
    if (iso) setHebrewInput('')
  }

  const navNext = () => { const n = nextMonthNav(viewMonth, viewYear); setViewMonth(n.month); setViewYear(n.year) }
  const navPrev = () => { const p = prevMonthNav(viewMonth, viewYear); setViewMonth(p.month); setViewYear(p.year) }

  return (
    <div className="relative space-y-1" ref={popupRef}>
      {/* כפתורי מצב */}
      <div className="flex gap-1 mb-1">
        <button type="button" onClick={() => setHebrewMode(false)}
          className={`text-xs px-2 py-0.5 rounded transition-colors ${!hebrewMode ? 'bg-teal-600 text-white' : 'text-slate-400 hover:text-slate-600'}`}>
          לועזי
        </button>
        <button type="button" onClick={() => setHebrewMode(true)}
          className={`text-xs px-2 py-0.5 rounded transition-colors ${hebrewMode ? 'bg-teal-600 text-white' : 'text-slate-400 hover:text-slate-600'}`}>
          עברי
        </button>
        <button type="button" onClick={openCalendar} disabled={disabled}
          className="text-xs px-2 py-0.5 rounded text-teal-600 hover:bg-teal-50 flex items-center gap-1 transition-colors"
          title="פתח לוח שנה עברי">
          <Calendar size={11}/> לוח
        </button>
      </div>

      {/* שדה קלט */}
      {!hebrewMode ? (
        <input type="date" value={value ?? ''} onChange={e => onChange(e.target.value)}
          required={required} disabled={disabled}
          className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 bg-white
            focus:outline-none focus:ring-2 focus:ring-teal-400 disabled:bg-slate-50"/>
      ) : (
        <input type="text"
          value={hebrewInput || hebrewDisplay}
          onChange={handleHebrewChange}
          onFocus={() => { if (!hebrewInput) setHebrewInput(hebrewDisplay) }}
          onBlur={handleHebrewBlur}
          placeholder='כ"ה סיון תשפ"ו'
          dir="rtl" disabled={disabled}
          className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 bg-white
            focus:outline-none focus:ring-2 focus:ring-teal-400 disabled:bg-slate-50"/>
      )}

      {/* הצגה כפולה */}
      {value && (
        <div className="px-1">
          {!hebrewMode && hebrewDisplay && (
            <span className="text-xs text-teal-600 font-medium">{hebrewDisplay}</span>
          )}
          {hebrewMode && value && (
            <span className="text-xs text-slate-500">{value.split('-').reverse().join('/')}</span>
          )}
        </div>
      )}

      {/* ── לוח שנה עברי ויזואלי ── */}
      {showCalendar && (
        <div className="absolute z-50 top-full mt-1 right-0 bg-white rounded-2xl shadow-xl border border-slate-200 p-3 w-72" dir="rtl">
          {/* כותרת + ניווט */}
          <div className="flex items-center justify-between mb-3">
            <button type="button" onClick={navPrev}
              className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-600">
              <ChevronRight size={15}/>
            </button>
            <div className="text-center">
              <p className="text-sm font-bold text-slate-800">{getMonthName(viewMonth, viewYear)}</p>
              <p className="text-xs text-teal-600 font-medium">{gematriya(viewYear)}</p>
            </div>
            <button type="button" onClick={navNext}
              className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-600">
              <ChevronLeft size={15}/>
            </button>
          </div>

          {/* כותרות ימי שבוע */}
          <div className="grid grid-cols-7 mb-1">
            {DAYS_OF_WEEK.map(d => (
              <div key={d} className="text-center text-xs text-slate-400 font-medium py-1">{d}</div>
            ))}
          </div>

          {/* תאי הימים */}
          <div className="grid grid-cols-7 gap-0.5">
            {cells.map((cell, i) =>
              cell === null ? (
                <div key={i}/>
              ) : (
                <button key={i} type="button" onClick={() => selectDay(cell.gregISO)}
                  className={[
                    'text-xs rounded-lg py-1.5 text-center font-medium transition-colors leading-none',
                    cell.hDay === selectedHDay
                      ? 'bg-teal-600 text-white'
                      : cell.gregISO === todayISO
                      ? 'bg-teal-50 text-teal-700 ring-1 ring-teal-400'
                      : 'hover:bg-slate-100 text-slate-700',
                  ].join(' ')}>
                  {gematriya(cell.hDay)}
                </button>
              )
            )}
          </div>

          {/* כפתור היום */}
          <div className="mt-2 pt-2 border-t border-slate-100 text-center">
            <button type="button" onClick={goToday}
              className="text-xs text-teal-600 hover:underline font-medium">
              היום
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
