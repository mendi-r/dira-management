import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Users, Home, Shuffle, CreditCard, Wrench,
  TrendingUp, TrendingDown, DollarSign, Bed
} from 'lucide-react'
import { supabase } from '../lib/supabase'
import { formatDate, daysUntil, currency } from '../lib/utils'
import { StatCard, Card, CardHeader, CardBody } from '../components/ui/Card'
import Badge from '../components/ui/Badge'
import AlertBanner from '../components/ui/AlertBanner'
import { useAlerts } from '../contexts/AlertsContext'

/** Clickable wrapper that navigates with optional URL search params */
function Clickable({ to, params = {}, children, className = '' }) {
  const navigate = useNavigate()
  function go() {
    const qs = new URLSearchParams(params).toString()
    navigate(qs ? `${to}?${qs}` : to)
  }
  return (
    <div onClick={go} className={`cursor-pointer ${className}`}>
      {children}
    </div>
  )
}

export default function Dashboard() {
  const navigate  = useNavigate()
  const { alerts } = useAlerts()
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const [
        { count: bochurimCount },
        { count: dirotCount },
        { data: shibutzim },
        { data: dirot },
        { data: bochurim },
        { data: gviyaOpen },
        { data: tachzukaOpen },
        { data: expenses },
        { data: gviyaMonth },
      ] = await Promise.all([
        supabase.from('bochurim').select('*', { count:'exact', head:true }),
        supabase.from('dirot').select('*', { count:'exact', head:true }),
        supabase.from('shibutzim')
          .select('dirot_id, ola_lebach, bochurim(shem,mishpacha), dirot(ktovet,mispar_mitot)')
          .eq('status', 'פעיל'),
        supabase.from('dirot').select('id,ktovet,ir,mispar_mitot,ola_schirut_chodshi,sofit_schirut,bituach_chadush,status'),
        supabase.from('bochurim').select('id,shem,mishpacha,tokef_viza'),
        supabase.from('gviya').select('bochurim(shem,mishpacha,telefon),skhum,skhum_shulam,taarich,status')
          .neq('status','שולם').order('taarich'),
        supabase.from('tachzuka').select('id,teur,status,adifut,dirot(ktovet)')
          .neq('status','סגור').order('created_at', { ascending:false }).limit(5),
        supabase.from('expenses').select('skhum,taarich').gte('taarich',
          new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().slice(0,10)),
        supabase.from('gviya').select('skhum,skhum_shulam,is_amla').gte('taarich',
          new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().slice(0,10)),
      ])

      const totalBeds    = (dirot??[]).reduce((s,d) => s + Number(d.mispar_mitot??0), 0)
      const occupiedBeds = (shibutzim??[]).length
      const freeBeds     = totalBeds - occupiedBeds

      const shibutzimByDira = {}
      ;(shibutzim??[]).forEach(s => {
        if (!shibutzimByDira[s.dirot_id]) shibutzimByDira[s.dirot_id] = 0
        shibutzimByDira[s.dirot_id]++
      })
      const dirotStats = (dirot??[]).map(d => {
        const n = shibutzimByDira[d.id] ?? 0
        const total = d.mispar_mitot ?? 0
        return { ...d, occupants: n, status_calc: n === 0 ? 'פנוי' : n >= total ? 'מלא' : 'חלקי' }
      })

      const income       = (gviyaMonth??[]).reduce((s,g) => s + Number(g.skhum_shulam??0), 0)
      const commissions  = (gviyaMonth??[]).filter(g=>g.is_amla).reduce((s,g) => s + Number(g.skhum_shulam??0), 0)
      const totalExpenses= (expenses??[]).reduce((s,e) => s + Number(e.skhum??0), 0)
      const netProfit    = income - totalExpenses

      const debtByBochur = {}
      ;(gviyaOpen??[]).forEach(g => {
        const key = g.bochurim ? `${g.bochurim.shem} ${g.bochurim.mishpacha}` : '—'
        const debt = Number(g.skhum??0) - Number(g.skhum_shulam??0)
        if (!debtByBochur[key]) debtByBochur[key] = { name:key, total: 0 }
        debtByBochur[key].total += debt
      })
      const openDebts = Object.values(debtByBochur).filter(d => d.total > 0).sort((a,b) => b.total - a.total)

      const overdueCount     = (gviyaOpen??[]).filter(g => g.taarich && new Date(g.taarich) < new Date()).length
      const contractEndCount = (dirot??[]).filter(d => { const r = daysUntil(d.sofit_schirut); return r!==null&&r<=30&&r>=0 }).length

      setData({
        bochurimCount, dirotCount, shibutzimCount: (shibutzim??[]).length,
        totalBeds, occupiedBeds, freeBeds,
        income, commissions, totalExpenses, netProfit,
        dirotStats, openDebts,
        tachzukaOpen: tachzukaOpen??[],
        overdueCount, contractEndCount,
      })
      setLoading(false)
    }
    load()
  }, [])

  if (loading) return (
    <div className="flex items-center justify-center py-24">
      <div className="animate-spin rounded-full h-10 w-10 border-4 border-teal-500 border-t-transparent"/>
    </div>
  )

  const { bochurimCount, dirotCount, shibutzimCount, totalBeds, occupiedBeds, freeBeds,
          income, commissions, totalExpenses, netProfit, dirotStats, openDebts,
          tachzukaOpen, overdueCount, contractEndCount } = data

  return (
    <div className="space-y-6 fade-in">
      <div>
        <h2 className="text-2xl font-bold text-slate-800">שלום, ברוך הבא 👋</h2>
        <p className="text-slate-500 text-sm mt-0.5">
          {new Date().toLocaleDateString('he-IL', { weekday:'long', year:'numeric', month:'long', day:'numeric' })}
        </p>
      </div>

      {alerts.length > 0 && (
        <AlertBanner type="warning" title={`${alerts.length} התראות דורשות טיפול`}>
          <div className="grid grid-cols-2 gap-x-6 gap-y-1 mt-2 text-xs">
            {overdueCount > 0 && (
              <div className="cursor-pointer hover:underline" onClick={()=>navigate('/gviya?status=לא שולם')}>
                • {overdueCount} חיובים באיחור
              </div>
            )}
            {contractEndCount > 0 && (
              <div className="cursor-pointer hover:underline" onClick={()=>navigate('/dirot?alert=contract')}>
                • {contractEndCount} חוזים מסתיימים תוך 30 יום
              </div>
            )}
            {alerts.filter(a=>a.type==='visa').length > 0 && (
              <div className="cursor-pointer hover:underline" onClick={()=>navigate('/bochurim?alert=visa')}>
                • {alerts.filter(a=>a.type==='visa').length} ויזות פוגות
              </div>
            )}
            {alerts.filter(a=>a.type==='insurance').length > 0 && (
              <div className="cursor-pointer hover:underline" onClick={()=>navigate('/dirot?alert=insurance')}>
                • {alerts.filter(a=>a.type==='insurance').length} ביטוחים לחידוש
              </div>
            )}
          </div>
        </AlertBanner>
      )}

      {/* Stats cards — all clickable */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Clickable to="/bochurim">
          <StatCard label="בחורים" value={bochurimCount??0} icon={Users} color="teal"/>
        </Clickable>
        <Clickable to="/dirot">
          <StatCard label="דירות" value={dirotCount??0} icon={Home} color="blue"/>
        </Clickable>
        <Clickable to="/shibutzim" params={{ status:'פעיל' }}>
          <StatCard label="שיבוצים פעילים" value={shibutzimCount} icon={Shuffle} color="green"/>
        </Clickable>
        <Clickable to="/tachzuka" params={{ status:'פתוח' }}>
          <StatCard label="קריאות תחזוקה" value={tachzukaOpen.length} icon={Wrench} color="amber"/>
        </Clickable>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Beds — clickable sections */}
        <Card>
          <CardHeader title="סיכום מיטות" action={<Bed size={18} className="text-slate-400"/>}/>
          <CardBody>
            <div className="flex items-center gap-4">
              <div className="flex-1 text-center">
                <p className="text-3xl font-bold text-slate-800">{totalBeds}</p>
                <p className="text-xs text-slate-400 mt-0.5">סה״כ מיטות</p>
              </div>
              <Clickable to="/shibutzim" params={{ status:'פעיל' }} className="flex-1 text-center group">
                <p className="text-3xl font-bold text-teal-600 group-hover:text-teal-800">{occupiedBeds}</p>
                <p className="text-xs text-slate-400 mt-0.5 group-hover:underline">תפוסות</p>
              </Clickable>
              <Clickable to="/dirot" params={{ status_calc:'פנוי' }} className="flex-1 text-center group">
                <p className="text-3xl font-bold text-emerald-500 group-hover:text-emerald-700">{freeBeds}</p>
                <p className="text-xs text-slate-400 mt-0.5 group-hover:underline">פנויות</p>
              </Clickable>
            </div>
            {totalBeds > 0 && (
              <div className="mt-3">
                <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                  <div className="h-full bg-teal-500 rounded-full transition-all"
                    style={{ width:`${Math.min(100,Math.round(occupiedBeds/totalBeds*100))}%` }}/>
                </div>
                <p className="text-xs text-slate-400 mt-1 text-left">{Math.round(occupiedBeds/totalBeds*100)}% תפוסה</p>
              </div>
            )}
          </CardBody>
        </Card>

        {/* Finance */}
        <Card>
          <CardHeader title="כספים — החודש" action={<DollarSign size={18} className="text-slate-400"/>}/>
          <CardBody>
            <div className="space-y-2">
              <Clickable to="/gviya" className="flex justify-between items-center p-1 rounded-lg hover:bg-slate-50">
                <span className="text-sm text-slate-600">הכנסות (שולם)</span>
                <span className="font-bold text-emerald-600">{currency(income)}</span>
              </Clickable>
              <Clickable to="/gviya" params={{ is_amla:'true' }} className="flex justify-between items-center p-1 rounded-lg hover:bg-slate-50">
                <span className="text-sm text-slate-600">עמלות</span>
                <span className="font-semibold text-teal-600">{currency(commissions)}</span>
              </Clickable>
              <div className="flex justify-between items-center p-1">
                <span className="text-sm text-slate-600">הוצאות</span>
                <span className="font-semibold text-red-500">{currency(totalExpenses)}</span>
              </div>
              <div className="pt-2 border-t border-slate-100 flex justify-between items-center p-1">
                <span className="text-sm font-bold text-slate-700">רווח נקי</span>
                <span className={`text-lg font-bold ${netProfit >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                  {currency(netProfit)}
                </span>
              </div>
            </div>
          </CardBody>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader title="סטטוס דירות" subtitle={`${dirotStats.length} דירות`}/>
          <CardBody className="p-0">
            <ul className="divide-y divide-slate-100">
              {dirotStats.slice(0,8).map(d=>(
                <li key={d.id}
                  className="flex items-center justify-between px-6 py-2.5 hover:bg-slate-50 cursor-pointer"
                  onClick={()=>navigate('/dirot')}>
                  <div>
                    <p className="text-sm font-medium text-slate-700">{d.ktovet}</p>
                    <p className="text-xs text-slate-400">{d.ir??''} · {d.occupants} / {d.mispar_mitot??0} מיטות</p>
                  </div>
                  <Badge color={d.status_calc==='מלא'?'red':d.status_calc==='חלקי'?'yellow':'green'}>
                    {d.status_calc}
                  </Badge>
                </li>
              ))}
              {dirotStats.length===0 && <li className="px-6 py-8 text-center text-slate-400 text-sm">אין דירות</li>}
            </ul>
          </CardBody>
        </Card>

        <Card>
          <CardHeader
            title="חובות פתוחים"
            subtitle={`${openDebts.length} חייבים`}
            action={
              openDebts.length > 0
                ? <button onClick={()=>navigate('/gviya?status=לא שולם')} className="text-xs text-teal-600 hover:underline">הצג הכל</button>
                : null
            }/>
          <CardBody className="p-0">
            <ul className="divide-y divide-slate-100">
              {openDebts.slice(0,8).map((d,i)=>(
                <li key={i}
                  className="flex items-center justify-between px-6 py-2.5 hover:bg-slate-50 cursor-pointer"
                  onClick={()=>navigate('/gviya?status=לא שולם')}>
                  <p className="text-sm font-medium text-slate-700">{d.name}</p>
                  <span className="text-sm font-bold text-red-600">{currency(d.total)}</span>
                </li>
              ))}
              {openDebts.length===0 && <li className="px-6 py-8 text-center text-emerald-600 text-sm">✓ אין חובות פתוחים</li>}
            </ul>
          </CardBody>
        </Card>
      </div>

      {tachzukaOpen.length > 0 && (
        <Card>
          <CardHeader title="תחזוקה פתוחה" subtitle={`${tachzukaOpen.length} קריאות`} action={<Wrench size={18} className="text-slate-400"/>}/>
          <CardBody className="p-0">
            <ul className="divide-y divide-slate-100">
              {tachzukaOpen.map(t=>(
                <li key={t.id}
                  className="flex items-center justify-between px-6 py-2.5 hover:bg-slate-50 cursor-pointer"
                  onClick={()=>navigate('/tachzuka?status=פתוח')}>
                  <div>
                    <p className="text-sm font-medium text-slate-700">{t.teur??'—'}</p>
                    <p className="text-xs text-slate-400">{t.dirot?.ktovet??''}</p>
                  </div>
                  <Badge color={t.status==='פתוח'?'red':'yellow'}>{t.status}</Badge>
                </li>
              ))}
            </ul>
          </CardBody>
        </Card>
      )}
    </div>
  )
}
