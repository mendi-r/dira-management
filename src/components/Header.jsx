import React, { useState, useRef, useEffect } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { Menu, LogOut, Bell, AlertTriangle, AlertCircle } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { useAlerts } from '../contexts/AlertsContext'

const titles = {
  '/':           'לוח בקרה',
  '/bochurim':   'בחורים',
  '/dirot':      'דירות',
  '/shibutzim':  'שיבוצים',
  '/gviya':      'גבייה',
  '/tachzuka':   'תחזוקה',
  '/monim':      'קריאות מונים',
  '/tashlumim':  'תשלומים לבעלים',
  '/hagdarot':   'הגדרות',
  '/reports':    'דוחות כספיים',
  '/calendar':   'לוח שנה',
  '/history':    'היסטוריה',
  '/users':      'ניהול משתמשים',
}

export default function Header({ onMenuClick }) {
  const { pathname } = useLocation()
  const navigate     = useNavigate()
  const { user, signOut } = useAuth()
  const { alerts, total } = useAlerts()
  const [bellOpen, setBellOpen] = useState(false)
  const bellRef = useRef(null)

  const title = titles[pathname] ?? 'מערכת ניהול'

  // Close bell dropdown on outside click
  useEffect(() => {
    function handler(e) {
      if (bellRef.current && !bellRef.current.contains(e.target)) setBellOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  function handleAlertClick(nav) {
    setBellOpen(false)
    navigate(nav)
  }

  const errors   = alerts.filter(a => a.severity === 'error')
  const warnings = alerts.filter(a => a.severity === 'warning')

  return (
    <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-6 shadow-sm">
      <div className="flex items-center gap-4">
        <button
          onClick={onMenuClick}
          className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100 transition-colors"
        >
          <Menu size={20} />
        </button>
        <h1 className="text-xl font-bold text-slate-800">{title}</h1>
      </div>

      <div className="flex items-center gap-3">
        {/* Bell with alerts dropdown */}
        <div className="relative" ref={bellRef}>
          <button
            onClick={() => setBellOpen(o => !o)}
            className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100 transition-colors relative"
          >
            <Bell size={18} />
            {total > 0 && (
              <span className={`absolute -top-1 -right-1 text-white text-[10px] font-bold w-4 h-4 flex items-center justify-center rounded-full
                ${errors.length > 0 ? 'bg-red-500' : 'bg-amber-500'}`}>
                {total > 9 ? '9+' : total}
              </span>
            )}
          </button>

          {bellOpen && (
            <div className="absolute left-0 top-full mt-2 w-80 bg-white rounded-2xl shadow-xl border border-slate-200 z-50 fade-in overflow-hidden">
              <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
                <span className="font-bold text-slate-800 text-sm">התראות</span>
                {total === 0 && <span className="text-xs text-slate-400">הכל תקין ✓</span>}
                {total > 0 && <span className="text-xs text-slate-400">{total} התראות</span>}
              </div>
              <div className="max-h-72 overflow-y-auto divide-y divide-slate-50">
                {total === 0 && (
                  <div className="px-4 py-6 text-center text-slate-400 text-sm">אין התראות פעילות</div>
                )}
                {alerts.map((a, i) => {
                  const Icon = a.severity === 'error' ? AlertCircle : AlertTriangle
                  const color = a.severity === 'error' ? 'text-red-500' : 'text-amber-500'
                  return (
                    <button key={i} onClick={() => handleAlertClick(a.nav)}
                      className="w-full flex items-start gap-3 px-4 py-3 hover:bg-slate-50 text-right transition-colors">
                      <Icon size={15} className={`${color} flex-shrink-0 mt-0.5`}/>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-slate-700 truncate">{a.label}</p>
                        <p className={`text-xs ${color}`}>
                          {a.days < 0 ? `פגה לפני ${Math.abs(a.days)} ימים` :
                           a.days === 0 ? 'היום!' :
                           `עוד ${a.days} ימים`}
                        </p>
                      </div>
                    </button>
                  )
                })}
              </div>
              {total > 0 && (
                <div className="px-4 py-2 border-t border-slate-100">
                  <button onClick={()=>{setBellOpen(false);navigate('/')}}
                    className="text-xs text-teal-600 hover:underline">
                    ראה הכל בלוח הבקרה ←
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* User info + logout */}
        <div className="flex items-center gap-2 border-r border-slate-200 pr-3">
          <div className="w-8 h-8 rounded-full bg-teal-100 flex items-center justify-center">
            <span className="text-teal-700 font-bold text-xs">
              {user?.email?.[0]?.toUpperCase() ?? 'U'}
            </span>
          </div>
          <span className="text-sm text-slate-600 hidden sm:block">{user?.email}</span>
        </div>
        <button
          onClick={signOut}
          className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-red-600 transition-colors"
          title="יציאה"
        >
          <LogOut size={16} />
          <span className="hidden sm:block">יציאה</span>
        </button>
      </div>
    </header>
  )
}
