import React from 'react'
import { NavLink } from 'react-router-dom'
import {
  LayoutDashboard, Users, Home, Shuffle, CreditCard,
  Wrench, Gauge, Settings, ChevronRight, Building2,
  BarChart2, CalendarDays, History, ShieldCheck, Banknote
} from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'

const ALL_LINKS = [
  { to: '/',           label: '\u05dc\u05d5\u05d7 \u05d1\u05e7\u05e8\u05d4',      icon: LayoutDashboard, end: true },
  { to: '/bochurim',   label: '\u05d1\u05d7\u05d5\u05e8\u05d9\u05dd',         icon: Users },
  { to: '/dirot',      label: '\u05d3\u05d9\u05e8\u05d5\u05ea',          icon: Home },
  { to: '/shibutzim',  label: '\u05e9\u05d9\u05d1\u05d5\u05e6\u05d9\u05dd',        icon: Shuffle },
  { to: '/gviya',      label: '\u05d2\u05d1\u05d9\u05d9\u05d4 \u05de\u05d1\u05d7\u05d5\u05e8\u05d9\u05dd',  icon: CreditCard },
  { to: '/tashlumim',  label: '\u05ea\u05e9\u05dc\u05d5\u05de\u05d9\u05dd \u05dc\u05d1\u05e2\u05dc\u05d9\u05dd', icon: Banknote },
  { to: '/tachzuka',   label: '\u05ea\u05d7\u05d6\u05d5\u05e7\u05d4',         icon: Wrench },
  { to: '/monim',      label: '\u05e7\u05e8\u05d9\u05d0\u05d5\u05ea \u05de\u05d5\u05e0\u05d9\u05dd',   icon: Gauge },
  { divider: true },
  { to: '/reports',    label: '\u05d3\u05d5\u05d7\u05d5\u05ea \u05db\u05e1\u05e4\u05d9\u05d9\u05dd',   icon: BarChart2 },
  { to: '/calendar',   label: '\u05dc\u05d5\u05d7 \u05e9\u05e0\u05d4',        icon: CalendarDays },
  { to: '/history',    label: '\u05d4\u05d9\u05e1\u05d8\u05d5\u05e8\u05d9\u05d4',       icon: History },
  { to: '/users',      label: '\u05de\u05e9\u05ea\u05de\u05e9\u05d9\u05dd',        icon: ShieldCheck, adminOnly: true },
  { divider: true },
  { to: '/hagdarot',   label: '\u05d4\u05d2\u05d3\u05e8\u05d5\u05ea',         icon: Settings },
]

export default function Sidebar({ open, setOpen }) {
  const { isAdmin } = useAuth()
  const links = ALL_LINKS.filter(l => !l.adminOnly || isAdmin)

  return (
    <>
      {open && (
        <div
          className="fixed inset-0 z-20 bg-black/40 lg:hidden"
          onClick={() => setOpen(false)}
        />
      )}

      <aside
        className={[
          'fixed lg:static inset-y-0 right-0 z-30',
          'flex flex-col bg-teal-800 text-white',
          'transition-all duration-300 ease-in-out',
          open ? 'w-60' : 'w-0 lg:w-16 overflow-hidden'
        ].join(' ')}
      >
        <div className="flex items-center gap-3 px-4 py-5 border-b border-teal-700 min-h-[64px]">
          <div className="flex-shrink-0 w-9 h-9 rounded-xl bg-teal-500 flex items-center justify-center">
            <Building2 size={20} className="text-white" />
          </div>
          {open && (
            <div>
              <p className="font-bold text-sm leading-tight">\u05e0\u05d9\u05d4\u05d5\u05dc \u05d3\u05d9\u05e8\u05d5\u05ea</p>
              <p className="text-teal-300 text-xs">\u05d5\u05d1\u05d7\u05d5\u05e8\u05d9\u05dd</p>
            </div>
          )}
        </div>

        <nav className="flex-1 py-4 space-y-0.5 px-2 overflow-y-auto">
          {links.map((item, i) => {
            if (item.divider) {
              return open
                ? <div key={'div-' + i} className="my-2 border-t border-teal-700/50"/>
                : <div key={'div-' + i} className="my-2"/>
            }
            const { to, label, icon: Icon, end } = item
            return (
              <NavLink
                key={to}
                to={to}
                end={end}
                className={({ isActive }) =>
                  'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ' +
                  (isActive ? 'bg-teal-600 text-white' : 'text-teal-100 hover:bg-teal-700 hover:text-white')
                }
              >
                <Icon size={18} className="flex-shrink-0" />
                {open && <span>{label}</span>}
              </NavLink>
            )
          })}
        </nav>

        <button
          onClick={() => setOpen(o => !o)}
          className="hidden lg:flex items-center justify-center h-10 border-t border-teal-700 text-teal-300 hover:text-white transition-colors"
        >
          <ChevronRight
            size={18}
            className={'transition-transform duration-300 ' + (open ? 'rotate-0' : 'rotate-180')}
          />
        </button>
      </aside>
    </>
  )
}
