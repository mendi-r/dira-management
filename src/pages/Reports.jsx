import React, { useEffect, useState } from 'react'
import { Download, TrendingUp, TrendingDown, DollarSign, BarChart2 } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { currency, formatDate } from '../lib/utils'
import { Card, CardHeader, CardBody, StatCard } from '../components/ui/Card'
import { FormField } from '../components/ui/FormField'
import Button from '../components/ui/Button'
import Badge from '../components/ui/Badge'

function exportCSV(data, filename) {
  if (!data.length) return
  const headers = Object.keys(data[0]).join(',')
  const rows = data.map(r => Object.values(r).map(v => `"${v??''}"`).join(',')).join('\n')
  const blob = new Blob(['﻿' + headers + '\n' + rows], { type: 'text/csv;charset=utf-8;' })
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob)
  a.download = filename; a.click()
}

export default function Reports() {
  const [year,  setYear]  = useState(new Date().getFullYear())
  const [month, setMonth] = useState(new Date().getMonth() + 1)
  const [data,  setData]  = useState(null)
  const [loading, setLoading] = useState(false)
  const [view, setView] = useState(() => sessionStorage.getItem('reports_view') ?? 'monthly')

  // דוח בעלים
  const [dirotList,    setDirotList]    = useState([])
  const [baalimDira,   setBaalimDira]   = useState('')
  const [baalimYear,   setBaalimYear]   = useState(new Date().getFullYear())
  const [baalimData,   setBaalimData]   = useState(null)
  const [baalimLoading,setBaalimLoading]= useState(false)

  useEffect(() => { load() }, [year, month])
  useEffect(() => {
    supabase.from('dirot').select('id,ktovet,ir').order('ktovet')
      .then(({ data }) => setDirotList(data ?? []))
  }, [])

  async function load() {
    setLoading(true)
    const ym = `${year}-${String(month).padStart(2,'0')}`
    const yearStart = `${year}-01-01`
    const yearEnd   = `${year}-12-31`

    const [
      { data: gviyaM },
      { data: gviyaY },
      { data: expM },
      { data: expY },
      { data: dirot },
      { data: shibutzim },
    ] = await Promise.all([
      supabase.from('gviya').select('skhum,skhum_shulam,sug,bochurim!bochurim_id(shem,mishpacha)').eq('chodesh', ym),
      supabase.from('gviya').select('skhum,skhum_shulam,chodesh,sug').gte('taarich',yearStart).lte('taarich',yearEnd),
      supabase.from('expenses').select('skhum,sug,teur,taarich').gte('taarich',`${ym}-01`).lte('taarich',`${ym}-31`),
      supabase.from('expenses').select('skhum,sug,taarich').gte('taarich',yearStart).lte('taarich',yearEnd),
      supabase.from('dirot').select('id,ktovet,ir,ola_schirut_chodshi'),
      supabase.from('shibutzim').select('dirot_id,ola_lebach,taarich_tchila,taarich_siyum').eq('status','פעיל'),
    ])

    // Monthly P&L
    const incomeM  = (gviyaM??[]).reduce((s,g) => s+Number(g.skhum_shulam??0),0)
    const chargedM = (gviyaM??[]).reduce((s,g) => s+Number(g.skhum??0),0)
    const expenseM = (expM??[]).reduce((s,e) => s+Number(e.skhum??0),0)

    // Annual by month
    const months = {}
    ;(gviyaY??[]).forEach(g => {
      if (!months[g.chodesh]) months[g.chodesh] = { income:0, charged:0 }
      months[g.chodesh].income  += Number(g.skhum_shulam??0)
      months[g.chodesh].charged += Number(g.skhum??0)
    })
    ;(expY??[]).forEach(e => {
      const ym2 = e.taarich?.slice(0,7)
      if (!months[ym2]) months[ym2] = { income:0, charged:0, expenses:0 }
      months[ym2].expenses = (months[ym2].expenses??0) + Number(e.skhum??0)
    })
    const annualRows = Object.entries(months).sort().map(([m, v]) => ({
      chodesh: m, hkhnasa: v.income, chiuv: v.charged, hotsa: v.expenses??0, revach: v.income-(v.expenses??0)
    }))
    const incomeY   = annualRows.reduce((s,r)=>s+r.hkhnasa,0)
    const expenseY  = annualRows.reduce((s,r)=>s+r.hotsa,0)
    const profitY   = incomeY - expenseY

    // Forecast: active assignments * monthly cost
    const forecastMonthly = (shibutzim??[]).reduce((s,sh) => s + Number(sh.ola_lebach??0), 0)

    // Ranking: revenue per apartment
    const ranking = (dirot??[]).map(d => {
      const rev = (gviyaY??[])
        .filter(g => g.bochurim_id /* won't work without join; using shibutzim */)
        .reduce((s,g) => s+Number(g.skhum_shulam??0), 0)
      const shibs = (shibutzim??[]).filter(s=>s.dirot_id===d.id)
      const monthly = shibs.reduce((s,sh)=>s+Number(sh.ola_lebach??0),0)
      return { ...d, monthly_income: monthly, annual_est: monthly*12 }
    }).sort((a,b)=>b.monthly_income-a.monthly_income)

    setData({ incomeM, chargedM, expenseM, annualRows, incomeY, expenseY, profitY, forecastMonthly, ranking })
    setLoading(false)
  }

  async function loadBaalim() {
    if (!baalimDira) return
    setBaalimLoading(true)
    setBaalimData(null)
    const yearStart = `${baalimYear}-01-01`
    const yearEnd   = `${baalimYear}-12-31`

    const [
      { data: monim },
      { data: tashlumim },
      { data: dira },
    ] = await Promise.all([
      supabase.from('riut').select('sug_mone,skhum_leshalem,taarich_kriah')
        .eq('dirot_id', baalimDira).eq('is_kriah_ptika', false)
        .gte('taarich_kriah', yearStart).lte('taarich_kriah', yearEnd),
      supabase.from('tashlumim_baalim').select('skhum,skhum_shulam,chodesh')
        .eq('dirot_id', baalimDira)
        .gte('chodesh', `${baalimYear}-01`).lte('chodesh', `${baalimYear}-12`),
      supabase.from('dirot').select('ktovet,ir,ola_schirut_chodshi').eq('id', baalimDira).single(),
    ])

    const rent = Number(dira?.ola_schirut_chodshi ?? 0)

    // בניית שורה לכל חודש
    const rows = {}
    for (let m = 1; m <= 12; m++) {
      const ym = `${baalimYear}-${String(m).padStart(2,'0')}`
      rows[ym] = { chodesh: ym, skhirut: rent, hashmal: 0, mayim: 0, gaz: 0, total: 0, paid: 0, balance: 0 }
    }

    // קריאות מונה
    ;(monim ?? []).forEach(r => {
      const ym = r.taarich_kriah?.slice(0, 7)
      if (!ym || !rows[ym]) return
      const v = Number(r.skhum_leshalem ?? 0)
      if (r.sug_mone === 'חשמל') rows[ym].hashmal += v
      else if (r.sug_mone === 'מים') rows[ym].mayim += v
      else if (r.sug_mone === 'גז')  rows[ym].gaz   += v
    })

    // תשלומים לבעלים
    ;(tashlumim ?? []).forEach(t => {
      const ym = t.chodesh
      if (rows[ym]) rows[ym].paid += Number(t.skhum_shulam ?? 0)
    })

    // סיכומים
    Object.values(rows).forEach(r => {
      r.total   = r.skhirut + r.hashmal + r.mayim + r.gaz
      r.balance = r.total - r.paid
    })

    const rowList = Object.values(rows)
    const totals = rowList.reduce((acc, r) => ({
      skhirut: acc.skhirut + r.skhirut,
      hashmal: acc.hashmal + r.hashmal,
      mayim:   acc.mayim   + r.mayim,
      gaz:     acc.gaz     + r.gaz,
      total:   acc.total   + r.total,
      paid:    acc.paid    + r.paid,
      balance: acc.balance + r.balance,
    }), { skhirut:0, hashmal:0, mayim:0, gaz:0, total:0, paid:0, balance:0 })

    setBaalimData({ dira, rows: rowList, totals })
    setBaalimLoading(false)
  }

  const years = Array.from({ length:5 },(_,i)=>new Date().getFullYear()-i)
  const months_list = Array.from({length:12},(_,i)=>({v:i+1,l:new Date(2000,i,1).toLocaleDateString('he-IL',{month:'long'})}))

  return (
    <div className="space-y-6 fade-in">
      {/* Controls */}
      <div className="flex flex-wrap items-end gap-3">
        <FormField label="שנה">
          <select value={year} onChange={e=>setYear(Number(e.target.value))}
            className="px-3 py-2 text-sm rounded-lg border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-teal-400">
            {years.map(y=><option key={y}>{y}</option>)}
          </select>
        </FormField>
        <FormField label="חודש">
          <select value={month} onChange={e=>setMonth(Number(e.target.value))}
            className="px-3 py-2 text-sm rounded-lg border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-teal-400">
            {months_list.map(m=><option key={m.v} value={m.v}>{m.l}</option>)}
          </select>
        </FormField>
        <div className="flex gap-2">
          {['monthly','annual','forecast','ranking','baalim'].map(v=>(
            <button key={v} onClick={()=>{ setView(v); sessionStorage.setItem('reports_view', v) }}
              className={`px-3 py-2 text-sm rounded-lg font-medium transition-colors
                ${view===v?'bg-teal-600 text-white':'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'}`}>
              {v==='monthly'?'חודשי':v==='annual'?'שנתי':v==='forecast'?'תחזית':v==='ranking'?'דירוג':'דוח בעלים'}
            </button>
          ))}
        </div>
      </div>

      {loading && <div className="flex justify-center py-10"><div className="animate-spin rounded-full h-8 w-8 border-4 border-teal-500 border-t-transparent"/></div>}

      {data && !loading && (
        <>
          {/* ── Monthly ── */}
          {view==='monthly' && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <StatCard label="גבוי החודש"  value={currency(data.incomeM)}  icon={TrendingUp}   color="green"/>
                <StatCard label="הוצאות החודש" value={currency(data.expenseM)} icon={TrendingDown}  color="red"/>
                <StatCard label="רווח נקי"     value={currency(data.incomeM-data.expenseM)} icon={DollarSign} color={data.incomeM-data.expenseM>=0?'teal':'red'}/>
              </div>
              <div className="flex justify-between items-center">
                <p className="text-sm text-slate-500">חיוב כולל: {currency(data.chargedM)} | אחוז גבייה: {data.chargedM>0?Math.round(data.incomeM/data.chargedM*100):0}%</p>
                <Button variant="secondary" icon={Download} onClick={()=>exportCSV([{גבוי:data.incomeM,הוצאות:data.expenseM,רווח:data.incomeM-data.expenseM}],'monthly-report.csv')}>ייצוא CSV</Button>
              </div>
            </div>
          )}

          {/* ── Annual ── */}
          {view==='annual' && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <StatCard label="הכנסות שנתיות"  value={currency(data.incomeY)}  icon={TrendingUp}  color="green"/>
                <StatCard label="הוצאות שנתיות"  value={currency(data.expenseY)} icon={TrendingDown} color="red"/>
                <StatCard label="רווח נקי שנתי"   value={currency(data.profitY)}  icon={DollarSign}  color={data.profitY>=0?'teal':'red'}/>
              </div>
              <Card>
                <CardHeader title={`דוח שנתי ${year}`}
                  action={<Button variant="secondary" icon={Download} onClick={()=>exportCSV(data.annualRows,'annual-report.csv')}>CSV</Button>}/>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead><tr className="bg-slate-50 text-right text-slate-500">
                      <th className="px-4 py-3 font-medium">חודש</th>
                      <th className="px-4 py-3 font-medium">גבוי</th>
                      <th className="px-4 py-3 font-medium">הוצאות</th>
                      <th className="px-4 py-3 font-medium">רווח</th>
                    </tr></thead>
                    <tbody>
                      {data.annualRows.length===0 && <tr><td colSpan={4} className="py-8 text-center text-slate-400">אין נתונים</td></tr>}
                      {data.annualRows.map(r=>(
                        <tr key={r.chodesh} className="border-b border-slate-100">
                          <td className="px-4 py-2.5">{r.chodesh}</td>
                          <td className="px-4 py-2.5 text-emerald-600">{currency(r.hkhnasa)}</td>
                          <td className="px-4 py-2.5 text-red-500">{currency(r.hotsa)}</td>
                          <td className={`px-4 py-2.5 font-semibold ${r.revach>=0?'text-teal-700':'text-red-600'}`}>{currency(r.revach)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Card>
            </div>
          )}

          {/* ── Forecast ── */}
          {view==='forecast' && (
            <Card>
              <CardHeader title="תחזית הכנסות — שיבוצים פעילים"/>
              <CardBody>
                <div className="space-y-3">
                  <div className="flex justify-between items-center p-4 bg-teal-50 rounded-xl">
                    <p className="text-teal-700 font-semibold">הכנסה חודשית צפויה (שיבוצים פעילים)</p>
                    <p className="text-2xl font-bold text-teal-700">{currency(data.forecastMonthly)}</p>
                  </div>
                  <div className="flex justify-between items-center p-4 bg-emerald-50 rounded-xl">
                    <p className="text-emerald-700 font-semibold">הכנסה שנתית צפויה</p>
                    <p className="text-2xl font-bold text-emerald-700">{currency(data.forecastMonthly*12)}</p>
                  </div>
                  <p className="text-xs text-slate-400">מבוסס על {data.ranking.filter(d=>d.monthly_income>0).length} דירות מאוישות</p>
                </div>
              </CardBody>
            </Card>
          )}

          {/* ── Ranking ── */}
          {view==='ranking' && (
            <Card>
              <CardHeader title="דירוג דירות לפי רווחיות"/>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead><tr className="bg-slate-50 text-right text-slate-500">
                    <th className="px-4 py-3 font-medium">#</th>
                    <th className="px-4 py-3 font-medium">דירה</th>
                    <th className="px-4 py-3 font-medium">הכנסה חודשית</th>
                    <th className="px-4 py-3 font-medium">הכנסה שנתית (צפי)</th>
                  </tr></thead>
                  <tbody>
                    {data.ranking.map((d,i)=>(
                      <tr key={d.id} className="border-b border-slate-100">
                        <td className="px-4 py-2.5 text-slate-400">{i+1}</td>
                        <td className="px-4 py-2.5 font-medium">{d.ktovet}{d.ir?`, ${d.ir}`:''}</td>
                        <td className="px-4 py-2.5 text-emerald-600">{currency(d.monthly_income)}</td>
                        <td className="px-4 py-2.5 text-teal-600 font-semibold">{currency(d.annual_est)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          )}
        </>
      )}

      {/* ── דוח בעלים ── */}
      {view==='baalim' && (
        <div className="space-y-4">
          <Card>
            <CardHeader title="דוח תשלומים לבעלים — לפי דירה"/>
            <CardBody>
              <div className="flex flex-wrap items-end gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">דירה</label>
                  <select value={baalimDira} onChange={e=>setBaalimDira(e.target.value)}
                    className="px-3 py-2 text-sm rounded-lg border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-teal-400 min-w-48">
                    <option value="">-- בחר דירה --</option>
                    {dirotList.map(d=><option key={d.id} value={d.id}>{d.ktovet}{d.ir?`, ${d.ir}`:''}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">שנה</label>
                  <select value={baalimYear} onChange={e=>setBaalimYear(Number(e.target.value))}
                    className="px-3 py-2 text-sm rounded-lg border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-teal-400">
                    {Array.from({length:5},(_,i)=>new Date().getFullYear()-i).map(y=><option key={y}>{y}</option>)}
                  </select>
                </div>
                <Button onClick={loadBaalim} loading={baalimLoading} disabled={!baalimDira}>הפק דוח</Button>
                {baalimData && (
                  <Button variant="secondary" icon={Download} onClick={()=>exportCSV(
                    baalimData.rows.map(r=>({
                      חודש:r.chodesh, שכירות:r.skhirut, חשמל:r.hashmal, מים:r.mayim, גז:r.gaz,
                      'סה"כ':r.total, שולם:r.paid, יתרה:r.balance
                    })), `owner-report-${baalimYear}.csv`)}>
                    ייצוא CSV
                  </Button>
                )}
              </div>
            </CardBody>
          </Card>

          {baalimLoading && <div className="flex justify-center py-10"><div className="animate-spin rounded-full h-8 w-8 border-4 border-teal-500 border-t-transparent"/></div>}

          {baalimData && !baalimLoading && (
            <Card>
              <CardHeader
                title={`${baalimData.dira?.ktovet ?? ''}${baalimData.dira?.ir ? `, ${baalimData.dira.ir}` : ''} — ${baalimYear}`}
                subtitle={`שכירות חודשית: ${currency(baalimData.dira?.ola_schirut_chodshi ?? 0)}`}
              />
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-slate-50 text-right text-slate-500 text-xs">
                      <th className="px-4 py-3 font-medium">חודש</th>
                      <th className="px-4 py-3 font-medium">שכירות</th>
                      <th className="px-4 py-3 font-medium">⚡ חשמל</th>
                      <th className="px-4 py-3 font-medium">💧 מים</th>
                      <th className="px-4 py-3 font-medium">🔥 גז</th>
                      <th className="px-4 py-3 font-medium border-r border-slate-200">סה״כ לתשלום</th>
                      <th className="px-4 py-3 font-medium text-emerald-700">שולם</th>
                      <th className="px-4 py-3 font-medium">יתרה</th>
                    </tr>
                  </thead>
                  <tbody>
                    {baalimData.rows.map(r => (
                      <tr key={r.chodesh} className="border-b border-slate-100 hover:bg-slate-50">
                        <td className="px-4 py-2.5 font-medium text-slate-700">{r.chodesh}</td>
                        <td className="px-4 py-2.5 text-slate-600">{r.skhirut > 0 ? currency(r.skhirut) : '—'}</td>
                        <td className="px-4 py-2.5 text-yellow-700">{r.hashmal > 0 ? currency(r.hashmal) : '—'}</td>
                        <td className="px-4 py-2.5 text-blue-700">{r.mayim > 0 ? currency(r.mayim) : '—'}</td>
                        <td className="px-4 py-2.5 text-orange-700">{r.gaz > 0 ? currency(r.gaz) : '—'}</td>
                        <td className="px-4 py-2.5 font-bold text-slate-800 border-r border-slate-200">{r.total > 0 ? currency(r.total) : '—'}</td>
                        <td className="px-4 py-2.5 text-emerald-600">{r.paid > 0 ? currency(r.paid) : '—'}</td>
                        <td className={`px-4 py-2.5 font-semibold ${r.balance > 0 ? 'text-red-600' : r.balance < 0 ? 'text-emerald-600' : 'text-slate-400'}`}>
                          {r.total === 0 ? '—' : r.balance === 0 ? '✓' : currency(r.balance)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="bg-slate-100 font-bold text-sm">
                      <td className="px-4 py-3 text-slate-700">סה״כ שנתי</td>
                      <td className="px-4 py-3 text-slate-700">{currency(baalimData.totals.skhirut)}</td>
                      <td className="px-4 py-3 text-yellow-700">{currency(baalimData.totals.hashmal)}</td>
                      <td className="px-4 py-3 text-blue-700">{currency(baalimData.totals.mayim)}</td>
                      <td className="px-4 py-3 text-orange-700">{currency(baalimData.totals.gaz)}</td>
                      <td className="px-4 py-3 text-slate-800 border-r border-slate-200">{currency(baalimData.totals.total)}</td>
                      <td className="px-4 py-3 text-emerald-600">{currency(baalimData.totals.paid)}</td>
                      <td className={`px-4 py-3 ${baalimData.totals.balance > 0 ? 'text-red-600' : 'text-emerald-600'}`}>{currency(baalimData.totals.balance)}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </Card>
          )}
        </div>
      )}
    </div>
  )
}
