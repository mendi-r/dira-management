import React, { useEffect, useState, useCallback } from 'react'
import { Clock, Trash2, User, Home, CreditCard, Wrench, Shuffle, FileText } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { formatDate } from '../lib/utils'
import SearchInput from '../components/ui/SearchInput'
import { Card, CardHeader } from '../components/ui/Card'
import Badge from '../components/ui/Badge'

const PEULA_ICONS = {
  bochurim:  User,
  dirot:     Home,
  gviya:     CreditCard,
  tachzuka:  Wrench,
  shibutzim: Shuffle,
  default:   FileText,
}

const PEULA_COLORS = {
  נוצר: 'green', עודכן: 'blue', נמחק: 'red', סגור: 'gray', הסתיים: 'amber',
}

export default function History() {
  const [rows,    setRows]    = useState([])
  const [loading, setLoading] = useState(true)
  const [search,  setSearch]  = useState('')
  const [tableFilter, setTableFilter] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo,   setDateTo]   = useState('')
  const [page,    setPage]    = useState(0)
  const PAGE_SIZE = 50

  const load = useCallback(async () => {
    setLoading(true)
    let q = supabase.from('activity_log')
      .select('*')
      .order('created_at', { ascending: false })
      .range(page*PAGE_SIZE, (page+1)*PAGE_SIZE-1)
    if (tableFilter) q = q.eq('shm_jadal', tableFilter)
    if (dateFrom)    q = q.gte('created_at', dateFrom)
    if (dateTo)      q = q.lte('created_at', dateTo + 'T23:59:59')
    const { data } = await q
    setRows(data ?? [])
    setLoading(false)
  }, [tableFilter, dateFrom, dateTo, page])

  useEffect(() => { load() }, [load])

  const filtered = rows.filter(r =>
    `${r.peula??''} ${r.shm_jadal??''} ${r.teur??''} ${r.record_id??''}`
      .toLowerCase().includes(search.toLowerCase())
  )

  const tables = ['bochurim','dirot','shibutzim','gviya','tachzuka','riut','vendors','documents']

  function timeAgo(dateStr) {
    if (!dateStr) return ''
    const diff = Date.now() - new Date(dateStr).getTime()
    const m = Math.floor(diff/60000)
    if (m < 1)  return 'עכשיו'
    if (m < 60) return `לפני ${m} דק׳`
    const h = Math.floor(m/60)
    if (h < 24) return `לפני ${h} ש׳`
    const d = Math.floor(h/24)
    return `לפני ${d} ימים`
  }

  function friendlyDate(dateStr) {
    if (!dateStr) return ''
    return new Date(dateStr).toLocaleString('he-IL', {
      day:'2-digit', month:'2-digit', year:'numeric',
      hour:'2-digit', minute:'2-digit',
    })
  }

  const tableLabels = {
    bochurim:'בחורים', dirot:'דירות', shibutzim:'שיבוצים',
    gviya:'גבייה', tachzuka:'תחזוקה', riut:'מונים',
    vendors:'ספקים', documents:'מסמכים',
  }

  return (
    <div className="space-y-4 fade-in">
      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex-1 min-w-48">
          <SearchInput value={search} onChange={setSearch} placeholder="פעולה, טבלה, תיאור..."/>
        </div>
        <select value={tableFilter} onChange={e=>{setTableFilter(e.target.value);setPage(0)}}
          className="px-3 py-2 text-sm rounded-lg border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-teal-400">
          <option value="">כל הטבלאות</option>
          {tables.map(t=><option key={t} value={t}>{tableLabels[t]??t}</option>)}
        </select>
        <input type="date" value={dateFrom} onChange={e=>{setDateFrom(e.target.value);setPage(0)}}
          className="px-3 py-2 text-sm rounded-lg border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-teal-400"/>
        <input type="date" value={dateTo} onChange={e=>{setDateTo(e.target.value);setPage(0)}}
          className="px-3 py-2 text-sm rounded-lg border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-teal-400"/>
        {(tableFilter||dateFrom||dateTo) && (
          <button onClick={()=>{setTableFilter('');setDateFrom('');setDateTo('');setPage(0)}}
            className="text-xs text-slate-400 hover:text-red-500 underline">נקה</button>
        )}
      </div>

      <p className="text-sm text-slate-400">{filtered.length} פעולות</p>

      {loading && (
        <div className="flex justify-center py-10">
          <div className="animate-spin rounded-full h-8 w-8 border-4 border-teal-500 border-t-transparent"/>
        </div>
      )}

      {!loading && (
        <div className="space-y-1">
          {filtered.length === 0 && (
            <div className="text-center py-12 text-slate-400">
              <Clock size={32} className="mx-auto mb-2 opacity-30"/>
              <p>אין רשומות בהיסטוריה</p>
            </div>
          )}
          {filtered.map(row => {
            const Icon = PEULA_ICONS[row.shm_jadal] ?? PEULA_ICONS.default
            const peulaBadge = PEULA_COLORS[row.peula] ?? 'gray'
            return (
              <div key={row.id} className="flex items-start gap-3 p-4 bg-white rounded-xl border border-slate-100 hover:border-slate-200 transition-colors">
                <div className="p-2 bg-slate-100 rounded-lg mt-0.5 shrink-0">
                  <Icon size={15} className="text-slate-500"/>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2 mb-0.5">
                    <Badge color={peulaBadge}>{row.peula??'—'}</Badge>
                    <span className="text-xs font-medium text-slate-600">
                      {tableLabels[row.shm_jadal] ?? row.shm_jadal ?? '—'}
                    </span>
                    {row.teur && (
                      <span className="text-xs text-slate-500">· {row.teur}</span>
                    )}
                  </div>
                  <p className="text-xs text-slate-400">
                    {friendlyDate(row.created_at)}
                    <span className="mx-1.5">·</span>
                    {timeAgo(row.created_at)}
                  </p>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Pagination */}
      <div className="flex justify-center gap-3 pt-2">
        <button onClick={()=>setPage(p=>Math.max(0,p-1))} disabled={page===0}
          className="px-4 py-2 text-sm rounded-lg border border-slate-200 disabled:opacity-40 hover:bg-slate-50">
          הקודם
        </button>
        <span className="px-4 py-2 text-sm text-slate-500">עמ׳ {page+1}</span>
        <button onClick={()=>setPage(p=>p+1)} disabled={rows.length < PAGE_SIZE}
          className="px-4 py-2 text-sm rounded-lg border border-slate-200 disabled:opacity-40 hover:bg-slate-50">
          הבא
        </button>
      </div>
    </div>
  )
}
