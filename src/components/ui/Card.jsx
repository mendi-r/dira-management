import React from 'react'

export function Card({ children, className = '' }) {
  return (
    <div className={`bg-white rounded-2xl shadow-sm border border-slate-200 ${className}`}>
      {children}
    </div>
  )
}

export function CardHeader({ title, subtitle, action }) {
  return (
    <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
      <div>
        <h3 className="font-bold text-slate-800">{title}</h3>
        {subtitle && <p className="text-xs text-slate-400 mt-0.5">{subtitle}</p>}
      </div>
      {action}
    </div>
  )
}

export function CardBody({ children, className = '' }) {
  return <div className={`px-6 py-4 ${className}`}>{children}</div>
}

export function StatCard({ label, value, icon: Icon, color = 'teal', sub }) {
  const colors = {
    teal:    'bg-teal-50 text-teal-600',
    green:   'bg-emerald-50 text-emerald-600',
    blue:    'bg-blue-50 text-blue-600',
    amber:   'bg-amber-50 text-amber-600',
    red:     'bg-red-50 text-red-600',
    purple:  'bg-purple-50 text-purple-600',
    emerald: 'bg-emerald-50 text-emerald-600',
  }
  return (
    <div className="bg-white rounded-2xl px-4 py-3 shadow-sm border border-slate-200 flex items-center gap-3 h-[84px] overflow-hidden">
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${colors[color] ?? colors.teal}`}>
        <Icon size={20} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xl font-bold text-slate-800 leading-tight truncate">{value}</p>
        <p className="text-sm text-slate-500 leading-tight truncate">{label}</p>
        {sub && <p className="text-[11px] text-slate-400 leading-tight truncate mt-0.5">{sub}</p>}
      </div>
    </div>
  )
}
