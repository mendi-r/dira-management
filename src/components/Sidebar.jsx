import React from 'react'
import { NavLink } from 'react-router-dom'
import {
  LayoutDashboard, Users, Home, Shuffle, CreditCard,
  Wrench, Gauge, Settings, ChevronRight, Building2,
  BarChart2, CalendarDays, History, ShieldCheck
} from 'lucide-react'

const links = [
  { to: '/',           label: 'לוח בקרה',    icon: LayoutDashboard, end: true },
  { to: '/bochurim',   label: 'בחורים',       icon: Users },
  { to: '/dirot',      label: 'דירות',        icon: Home },
  { to: '/shibutzim',  label: 'שיבוצים',      icon: Shuffle },
  { to: '/gviya',      label: 'גבייה',        icon: CreditCard },
  { to: '/tachzuka',   label: 'תחזוקה',       icon: Wrench },
  { to: '/monim',      label: 'קריאות מונים', icon: Gauge },
  { divider: true },
  { to: '/reports',    label: 'דוחות כספיים', icon: BarChart2 },
  { to: '/calendar',   label: 'לוח שנה',      icon: CalendarDays },
  { to: '/history',    label: 'היסטוריה',     icon: History },
  { to: '/users',      label: 'משתמשים',      icon: ShieldCheck },
  { divider: true },
  { to: '/hagdarot',   label: 'הגדרות',       icon: Settings },
]

export default function Sidebar({ open, setOpen }) {
  return (
    <>
      {/* Overlay on mobile */}
      {open && (
        <div
          className="fixed inset-0 z-20 bg-black/40 lg:hidden"
          onClick={() => setOpen(false)}
        />
      )}

      <aside
        className={`
          fixed lg:static inset-y-0 right-0 z-30
          flex flex-col bg-teal-800 text-white
          transition-all duration-300 ease-in-out
          ${open ? 'w-60' : 'w-0 lg:w-16 overflow-hidden'}
        `}
      >
        {/* Logo */}
        <div className="flex items-center gap-3 px-4 py-5 border-b border-teal-700 min-h-[64px]">
          <div className="flex-shrink-0 w-9 h-9 rounded-xl bg-teal-500 flex items-center justify-center">
            <Building2 size={20} className="text-white" />
          </div>
          {open && (
            <div>
              <p className="font-bold text-sm leading-tight">ניהול דירות</p>
              <p className="text-teal-300 text-xs">ובחורים</p>
            </div>
          )}
        </div>

        {/* Nav */}
        <nav className="flex-1 py-4 space-y-0.5 px-2 overflow-y-auto">
          {links.map((item, i) => {
            if (item.divider) {
              return open ? (
                <div key={`div-${i}`} className="my-2 border-t border-teal-700/50"/>
              ) : (
                <div key={`div-${i}`} className="my-2"/>
              )
            }
            const { to, label, icon: Icon, end } = item
            return (
              <NavLink
                key={to}
                to={to}
                end={end}
                className={({ isActive }) =>
                  `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors
                   ${isActive
                     ? 'bg-teal-600 text-white'
                     : 'text-teal-100 hover:bg-teal-700 hover:text-white'
                   }`
                }
              >
                <Icon size={18} className="flex-shrink-0" />
                {open && <span>{label}</span>}
              </NavLink>
            )
          })}
        </nav>

        {/* Collapse toggle (desktop) */}
        <button
          onClick={() => setOpen(o => !o)}
          className="hidden lg:flex items-center justify-center h-10 border-t border-teal-700 text-teal-300 hover:text-white transition-colors"
        >
          <ChevronRight
            size={18}
            className={`transition-transform duration-300 ${open ? 'rotate-0' : 'rotate-180'}`}
          />
        </button>
      </aside>
    </>
  )
}
