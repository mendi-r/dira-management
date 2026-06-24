import React, { useEffect, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Users, Home, Shuffle, CreditCard, Wrench,
  TrendingUp, TrendingDown, DollarSign, Bed, Banknote, RefreshCw
} from 'lucide-react'
import { supabase } from '../lib/supabase'
import { formatDate, daysUntil, currency } from '../lib/utils'
import { getCache, setCache, clearCache } from '../lib/cache'
import { useRealtime } from '../hooks/useRealtime'
import { StatCard, Card, CardHeader, CardBody } from '../components/ui/Card'
import Badge from '../components/ui/Badge'
import AlertBanner from '../components/ui/AlertBanner'
import { useAlerts } from '../contexts/AlertsContext'
import { useAuth } from '../contexts/AuthContext'

const DASHBOARD_CACHE_KEY = 'dashboard_v1'
const DASHBOARD_TTL = 60_000  // 60 שניות

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
  const { isSuperAdmin, viewAsOwnerId } = useAuth()
  // אתחול ישיר מהמטמון — אם קיים, הרנדר הראשון כבר מציג תוכן ללא ספינר
  const [data, setData]       = useState(() => getCache(DASHBOARD_CACHE_KEY))
  const [loading, setLoading] = useState(() => getCache(DASHBOARD_CACHE_KEY) === null)
  const [error, setError]     = useState(null)

  const load = useCallback(async (force = false) => {
    // ── מטמון: אם לא force ויש נתונים טריים — הצג מיד ──
    if (!force) {
      const cached = getCache(DASHBOARD_CACHE_KEY)
      if (cached) { setData(cached); setLoading(false); return }
    }

    setLoading(true)

    // ── קריאת RPC אחת במקום 10 שאילתות נפרדות ──
    const rpcParams = (isSuperAdmin && viewAsOwnerId) ? { p_owner_id: viewAsOwnerId } : {}
    const { data: stats, error: rpcError } = await supabase.rpc('get_dashboard_stats', rpcParams)
    if (rpcError || !stats) {
      console.error('Dashboard RPC error:', rpcError)
      setError(rpcError?.message ?? 'שגיאת RPC לא ידועה')
      setLoading(false)
      return
    }
    setError(null)

    // שיוך תוצאות ה-RPC למשתנים זהים לקוד הקיים
    const bochurimCount  = stats.bochurim_count  ?? 0
    const dirotCount     = stats.dirot_count     ?? 0
    const currentMonth   = stats.current_month
    const shibutzim      = stats.shibutzim       ?? []
    const dirot          = stats.dirot           ?? []
    const allBochurim    = stats.active_bochurim ?? []
    const gviyaOpen      = stats.gviya_open      ?? []
    const tachzukaOpen   = stats.tachzuka_open   ?? []
    const gviyaTotal     = Number(stats.gviya_total     ?? 0)
    const gviyaCollected = Number(stats.gviya_collected ?? 0)
    const tashlumimTotal = Number(stats.tashlumim_total ?? 0)
    const monimMonth     = stats.monim           ?? []

    const totalBeds    = dirot.reduce((s,d) => s + Number(d.mispar_mitot??0), 0)
    const occupiedBeds = shibutzim.length
    const freeBeds     = Math.max(0, totalBeds - occupiedBeds)

    // בחורים ללא שיבוץ פעיל
    const activeIds  = new Set(shibutzim.map(s => s.bochurim_id))
    const unassigned = allBochurim.filter(b => !activeIds.has(b.id))

    const shibutzimByDira = {}
    shibutzim.forEach(s => {
      if (!shibutzimByDira[s.dirot_id]) shibutzimByDira[s.dirot_id] = 0
      shibutzimByDira[s.dirot_id]++
    })
    const dirotStats = dirot.map(d => {
      const n = shibutzimByDira[d.id] ?? 0
      const total = d.mispar_mitot ?? 0
      return { ...d, occupants: n, status_calc: n === 0 ? 'פנוי' : n >= total ? 'מלא' : 'חלקי' }
    })
    // דירות עם לפחות מיטה פנויה אחת
    const freeApartments = dirotStats.filter(d => d.occupants < Number(d.mispar_mitot ?? 0)).length

    // כספים
    const gviyaOutstanding = Math.max(0, gviyaTotal - gviyaCollected)
    const netProfit        = gviyaTotal - tashlumimTotal

    // חישוב שירותים החודש
    const utilTypes = { חשמל: 0, מים: 0, גז: 0 }
    monimMonth.forEach(m => {
      const v = Number(m.skhum_leshalem ?? 0)
      if (v > 0 && utilTypes[m.sug_mone] !== undefined) utilTypes[m.sug_mone] += v
    })
    const utilityTotal      = utilTypes.חשמל + utilTypes.מים + utilTypes.גז
    const dirotWithReadings = new Set(monimMonth.map(m => m.dirot_id)).size

    const debtByBochur = {}
    gviyaOpen.forEach(g => {
      const key = g.bochurim ? `${g.bochurim.shem} ${g.bochurim.mishpacha}` : '—'
      const debt = Number(g.skhum??0) - Number(g.skhum_shulam??0)
      if (!debtByBochur[key]) debtByBochur[key] = { name:key, total: 0 }
      debtByBochur[key].total += debt
    })
    const openDebts = Object.values(debtByBochur).filter(d => d.total > 0).sort((a,b) => b.total - a.total)

    const overdueCount     = gviyaOpen.filter(g => g.taarich && new Date(g.taarich) < new Date()).length
    const contractEndCount = dirot.filter(d => { const r = daysUntil(d.sofit_schirut); return r!==null&&r<=30&&r>=0 }).length

    const result = {
      bochurimCount, dirotCount, shibutzimCount: shibutzim.length,
      totalBeds, occupiedBeds, freeBeds, freeApartments,
      unassigned,
      gviyaTotal, gviyaCollected, gviyaOutstanding,
      tashlumimTotal, netProfit,
      dirotStats, openDebts,
      tachzukaOpen: tachzukaOpen??[],
      overdueCount, contractEndCount,
      currentMonth,
      utilTypes, utilityTotal, dirotWithReadings,
    }
    setCache(DASHBOARD_CACHE_KEY, result, DASHBOARD_TTL)
    setData(result)
    setLoading(false)
  }, [isSuperAdmin, viewAsOwnerId])

  useEffect(() => { clearCache(DASHBOARD_CACHE_KEY); load(true) }, [viewAsOwnerId])

  useEffect(() => {
    load()
    // רענון כשחוזרים לחלון — משתמש במטמון אם טרי
    const onVisible = () => { if (document.visibilityState === 'visible') load() }
    document.addEventListener('visibilitychange', onVisible)
    return () => document.removeEventListener('visibilitychange', onVisible)
  }, [load])

  // סנכרון זמן-אמת — כל שינוי בנתונים מרענן את לוח הבקרה
  useRealtime(
    ['bochurim','dirot','shibutzim','gviya','tashlumim_baalim','tachzuka'],
    () => { clearCache(DASHBOARD_CACHE_KEY); load(true) }
  )

  if (loading) return (
    <div className="flex items-center justify-center py-24">
      <div className="animate-spin rounded-full h-10 w-10 border-4 border-teal-500 border-t-transparent"/>
    </div>
  )

  if (!data) return (
    <div className="flex flex-col items-center justify-center py-24 text-gray-500 gap-2">
      <p className="font-medium">שגיאה בטעינת הנתונים — נסה לרענן</p>
      {error && <p className="text-xs text-red-500 max-w-md text-center">{error}</p>}
      <button onClick={() => load(true)} className="mt-2 text-sm text-teal-600 underline">רענן</button>
    </div>
  )

  const { bochurimCount, dirotCount, shibutzimCount, totalBeds, occupiedBeds, freeBeds, freeApartments,
          unassigned, gviyaTotal, gviyaCollected, gviyaOutstanding,
          tashlumimTotal, netProfit, dirotStats, openDebts,
          tachzukaOpen, overdueCount, contractEndCount, currentMonth,
          utilTypes, utilityTotal, dirotWithReadings } = data

  return (
    <div className="space-y-6 fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">שלום, ברוך הבא 👋</h2>
          <p className="text-slate-500 text-sm mt-0.5">
            {new Date().toLocaleDateString('he-IL', { weekday:'long', year:'numeric', month:'long', day:'numeric' })}
          </p>
        </div>
        <button onClick={() => load(true)} className="p-2 rounded-lg border border-slate-200 bg-white text-slate-500 hover:text-teal-600 hover:border-teal-300" title="רענן נתונים">
          <RefreshCw size={16}/>
        </button>
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
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <Clickable to="/bochurim">
          <StatCard label="בחורים" value={bochurimCount??0} icon={Users} color="teal"/>
        </Clickable>
        <Clickable to="/dirot">
          <StatCard label="דירות" value={dirotCount??0} icon={Home} color="blue"/>
        </Clickable>
        <Clickable to="/shibutzim" params={{ status:'פעיל' }}>
          <StatCard label="שיבוצים פעילים" value={shibutzimCount} icon={Shuffle} color="green"/>
        </Clickable>
        <Clickable to="/bochurim" params={{ unassigned:'true' }}>
          <StatCard label="ללא שיבוץ" value={unassigned.length} icon={Users} color="amber"/>
        </Clickable>
        <Clickable to="/dirot" params={{ free_beds:'true' }}>
          <StatCard label="דירות פנויות" value={freeApartments} icon={Bed} color="teal"
            sub={`${freeBeds} מיטות פנויות`}/>
        </Clickable>
      </div>

      {/* שורת כרטיסים שניה */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
        <Clickable to="/gviya" params={{ chodesh: currentMonth }}>
          <StatCard label="גבייה החודש" value={currency(gviyaTotal)} icon={CreditCard} color="green"/>
        </Clickable>
        <Clickable to="/tashlumim">
          <StatCard label="לבעלים החודש" value={currency(tashlumimTotal)} icon={Banknote} color="red"/>
        </Clickable>
        <div>
          <StatCard label="רווח נקי" value={currency(netProfit)} icon={TrendingUp}
            color={netProfit >= 0 ? 'green' : 'red'}/>
        </div>
      </div>

      {/* כרטיס גבייה חודש נוכחי — פירוט גבוי/לא נגבה */}
      <Card>
        <CardHeader title={`גבייה מבחורים — ${new Date().toLocaleDateString('he-IL',{month:'long',year:'numeric'})}`}
          action={<Clickable to="/gviya" params={{ chodesh: currentMonth }}><span className="text-xs text-teal-600 hover:underline cursor-pointer">הצג הכל</span></Clickable>}/>
        <CardBody>
          <div className="grid grid-cols-3 gap-4 text-center">
            <Clickable to="/gviya" params={{ chodesh: currentMonth }} className="group">
              <p className="text-2xl font-bold text-slate-700 group-hover:text-teal-600">{currency(gviyaTotal)}</p>
              <p className="text-xs text-slate-400 mt-1">סה״כ לגביה</p>
            </Clickable>
            <Clickable to="/gviya" params={{ chodesh: currentMonth, status: 'שולם' }} className="group">
              <p className="text-2xl font-bold text-emerald-600 group-hover:text-emerald-800">{currency(gviyaCollected)}</p>
              <p className="text-xs text-slate-400 mt-1">נגבה בפועל</p>
            </Clickable>
            <Clickable to="/gviya" params={{ chodesh: currentMonth, status: 'לא שולם' }} className="group">
              <p className={`text-2xl font-bold group-hover:opacity-80 ${gviyaOutstanding > 0 ? 'text-red-600' : 'text-emerald-600'}`}>{currency(gviyaOutstanding)}</p>
              <p className="text-xs text-slate-400 mt-1">לא נגבה</p>
            </Clickable>
          </div>
          {gviyaTotal > 0 && (
            <div className="mt-4">
              <div className="h-2.5 bg-slate-100 rounded-full overflow-hidden">
                <div className="h-full bg-emerald-500 rounded-full transition-all"
                  style={{ width: `${Math.min(100, Math.round(gviyaCollected / gviyaTotal * 100))}%` }}/>
              </div>
              <p className="text-xs text-slate-400 mt-1 text-left">{Math.round(gviyaCollected / gviyaTotal * 100)}% נגבה</p>
            </div>
          )}
        </CardBody>
      </Card>

      {/* ── כרטיס שירותים ── */}
      <Card>
        <CardHeader
          title={`שירותים — ${new Date().toLocaleDateString('he-IL',{month:'long',year:'numeric'})}`}
          subtitle="חשמל · מים · גז"
          action={<Clickable to="/monim"><span className="text-xs text-teal-600 hover:underline cursor-pointer">כל הקריאות ←</span></Clickable>}
        />
        <CardBody>
          <div className="grid grid-cols-3 gap-3 text-center">
            <Clickable to="/monim" params={{ sug: 'חשמל' }} className="group">
              <div className="p-3 bg-yellow-50 rounded-xl group-hover:bg-yellow-100 transition-colors">
                <p className="text-xl font-bold text-yellow-700">{currency(utilTypes.חשמל)}</p>
                <p className="text-xs text-slate-500 mt-0.5">⚡ חשמל</p>
              </div>
            </Clickable>
            <Clickable to="/monim" params={{ sug: 'מים' }} className="group">
              <div className="p-3 bg-blue-50 rounded-xl group-hover:bg-blue-100 transition-colors">
                <p className="text-xl font-bold text-blue-700">{currency(utilTypes.מים)}</p>
                <p className="text-xs text-slate-500 mt-0.5">💧 מים</p>
              </div>
            </Clickable>
            <Clickable to="/monim" params={{ sug: 'גז' }} className="group">
              <div className="p-3 bg-orange-50 rounded-xl group-hover:bg-orange-100 transition-colors">
                <p className="text-xl font-bold text-orange-700">{currency(utilTypes.גז)}</p>
                <p className="text-xs text-slate-500 mt-0.5">🔥 גז</p>
              </div>
            </Clickable>
          </div>
          <div className="mt-3 pt-3 border-t border-slate-100 flex justify-between items-center">
            <span className="text-sm font-semibold text-slate-600">סה״כ שירותים החודש</span>
            <span className={`text-lg font-bold ${utilityTotal > 0 ? 'text-slate-800' : 'text-slate-400'}`}>{currency(utilityTotal)}</span>
          </div>
          {utilityTotal === 0
            ? <p className="text-xs text-amber-600 mt-2 text-center">⚠️ לא נרשמו קריאות מונה החודש</p>
            : <p className="text-xs text-slate-400 mt-1 text-center">{dirotWithReadings} דירות עם קריאות החודש</p>
          }
        </CardBody>
      </Card>

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

        {/* Finance — שני זרמים */}
        <Card>
          <CardHeader title="כספים — החודש" action={<DollarSign size={18} className="text-slate-400"/>}/>
          <CardBody>
            <div className="space-y-2">
              <Clickable to="/gviya" className="flex justify-between items-center p-2 rounded-lg hover:bg-emerald-50">
                <div className="flex items-center gap-2">
                  <CreditCard size={15} className="text-emerald-500"/>
                  <span className="text-sm text-slate-600">גבייה מבחורים</span>
                </div>
                <span className="font-bold text-emerald-600">{currency(gviyaTotal)}</span>
              </Clickable>
              <Clickable to="/tashlumim" className="flex justify-between items-center p-2 rounded-lg hover:bg-red-50">
                <div className="flex items-center gap-2">
                  <Banknote size={15} className="text-red-500"/>
                  <span className="text-sm text-slate-600">תשלומים לבעלים</span>
                </div>
                <span className="font-semibold text-red-500">{currency(tashlumimTotal)}</span>
              </Clickable>
              <div className="pt-2 border-t border-slate-100 flex justify-between items-center p-2">
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
