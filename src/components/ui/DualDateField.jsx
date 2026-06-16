/**
 * DualDateField — shows both Gregorian date picker and Hebrew date.
 * The Gregorian value is stored in DB (YYYY-MM-DD).
 * Hebrew date is auto-calculated and displayed.
 * Optional: user can also enter Hebrew date manually to get Gregorian back.
 */
import React, { useState, useMemo } from 'react'
import { HDate, gematriya } from '@hebcal/hdate'

// Hebrew month names
const HEB_MONTHS = {
  1: 'ניסן', 2: 'אייר', 3: 'סיון', 4: 'תמוז', 5: 'אב', 6: 'אלול',
  7: 'תשרי', 8: 'חשון', 9: 'כסלו', 10: 'טבת', 11: 'שבט', 12: 'אדר', 13: 'אדר ב׳',
}
const HEB_MONTHS_BY_NAME = Object.fromEntries(Object.entries(HEB_MONTHS).map(([k,v])=>[v,Number(k)]))

/** Convert YYYY-MM-DD → Hebrew string like "ל׳ סיון תשפ״ו" */
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
  // Expected format: "ל׳ סיון תשפ״ו" or "30 סיון תשפ״ו" or numeric "30 3 5786"
  str = str.trim()
  let day, monthName, yearStr

  // Try "NUM MONTH YEAR" with Hebrew gematria or digits
  const parts = str.split(/\s+/)
  if (parts.length < 3) return null

  // Day: gematriya or number
  const dayStr = parts[0].replace(/[׳״]/g,'')
  const monthPart = parts.slice(1, -1).join(' ')
  yearStr = parts[parts.length - 1]

  // Parse day
  day = parseInt(dayStr)
  if (isNaN(day)) {
    // Try gematriya letters → number (simplified)
    day = hebrewLettersToNum(dayStr)
  }

  // Parse month
  monthName = monthPart
  const month = HEB_MONTHS_BY_NAME[monthName]

  // Parse year (gematriya → number)
  let year = parseInt(yearStr.replace(/[׳״]/g,''))
  if (isNaN(year) || year < 100) {
    year = hebrewLettersToNum(yearStr)
  }

  if (!day || !month || !year) return null

  try {
    const h = new HDate(day, month, year)
    const g = h.greg()
    return g.toISOString().slice(0,10)
  } catch { return null }
}

/** Simplified Hebrew letter → number (gematria) */
function hebrewLettersToNum(str) {
  const vals = {
    'א':1,'ב':2,'ג':3,'ד':4,'ה':5,'ו':6,'ז':7,'ח':8,'ט':9,
    'י':10,'כ':20,'ל':30,'מ':40,'נ':50,'ס':60,'ע':70,'פ':80,'צ':90,
    'ק':100,'ר':200,'ש':300,'ת':400,
    'ך':20,'ם':40,'ן':50,'ף':80,'ץ':90,
  }
  let total = 0
  for (const ch of str.replace(/[״׳]/g,'')) {
    total += vals[ch] ?? 0
  }
  return total || NaN
}

/**
 * Props:
 * - value: YYYY-MM-DD string
 * - onChange: fn(YYYY-MM-DD string)
 * - label: string (outer label, optional — use FormField for that)
 * - required: bool
 * - disabled: bool
 */
export default function DualDateField({ value, onChange, required, disabled }) {
  const [hebrewInput, setHebrewInput] = useState('')
  const [hebrewMode, setHebrewMode] = useState(false) // false=Gregorian input, true=Hebrew input

  const hebrewDisplay = useMemo(() => toHebrewDate(value), [value])

  function handleGregorianChange(e) {
    onChange(e.target.value)
    setHebrewInput('')
  }

  function handleHebrewChange(e) {
    setHebrewInput(e.target.value)
    const iso = parseHebrewDate(e.target.value)
    if (iso) onChange(iso)
  }

  function handleHebrewBlur() {
    // If we parsed successfully, clear the manual Hebrew input and show computed
    const iso = parseHebrewDate(hebrewInput)
    if (iso) setHebrewInput('')
  }

  return (
    <div className="space-y-1">
      {/* Mode toggle */}
      <div className="flex gap-1 mb-1">
        <button type="button"
          onClick={() => setHebrewMode(false)}
          className={`text-xs px-2 py-0.5 rounded transition-colors ${!hebrewMode ? 'bg-teal-600 text-white' : 'text-slate-400 hover:text-slate-600'}`}>
          לועזי
        </button>
        <button type="button"
          onClick={() => setHebrewMode(true)}
          className={`text-xs px-2 py-0.5 rounded transition-colors ${hebrewMode ? 'bg-teal-600 text-white' : 'text-slate-400 hover:text-slate-600'}`}>
          עברי
        </button>
      </div>

      {!hebrewMode ? (
        /* ── Gregorian date input ── */
        <input
          type="date"
          value={value ?? ''}
          onChange={handleGregorianChange}
          required={required}
          disabled={disabled}
          className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 bg-white
            focus:outline-none focus:ring-2 focus:ring-teal-400 disabled:bg-slate-50"
        />
      ) : (
        /* ── Hebrew text input ── */
        <input
          type="text"
          value={hebrewInput || hebrewDisplay}
          onChange={handleHebrewChange}
          onFocus={() => { if (!hebrewInput) setHebrewInput(hebrewDisplay) }}
          onBlur={handleHebrewBlur}
          placeholder='כ"ה סיון תשפ"ו'
          dir="rtl"
          disabled={disabled}
          className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 bg-white
            focus:outline-none focus:ring-2 focus:ring-teal-400 disabled:bg-slate-50"
        />
      )}

      {/* Always show both dates */}
      {value && (
        <div className="flex items-center gap-3 px-1">
          {!hebrewMode && hebrewDisplay && (
            <span className="text-xs text-teal-600 font-medium">{hebrewDisplay}</span>
          )}
          {hebrewMode && value && (
            <span className="text-xs text-slate-500 dir-ltr">{
              value.split('-').reverse().join('/')
            }</span>
          )}
        </div>
      )}
    </div>
  )
}
