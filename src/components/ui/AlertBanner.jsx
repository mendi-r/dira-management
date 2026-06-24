import React from 'react'
import { AlertTriangle, Info, CheckCircle, XCircle, X } from 'lucide-react'

const variants = {
  warning: { icon: AlertTriangle, bg: 'bg-amber-50', border: 'border-amber-200', text: 'text-amber-800', icon_color: 'text-amber-500' },
  error:   { icon: XCircle,       bg: 'bg-red-50',   border: 'border-red-200',   text: 'text-red-800',   icon_color: 'text-red-500' },
  info:    { icon: Info,          bg: 'bg-blue-50',  border: 'border-blue-200',  text: 'text-blue-800',  icon_color: 'text-blue-500' },
  success: { icon: CheckCircle,   bg: 'bg-emerald-50', border: 'border-emerald-200', text: 'text-emerald-800', icon_color: 'text-emerald-500' },
}

export default function AlertBanner({ type = 'warning', title, children, onClose }) {
  const v = variants[type]
  const Icon = v.icon
  return (
    <div className={`flex items-center gap-3 px-4 py-2.5 rounded-xl border ${v.bg} ${v.border}`}>
      <Icon size={16} className={`${v.icon_color} flex-shrink-0`} />
      <div className="flex-1 min-w-0">
        {title && <p className={`text-base font-bold ${v.text} leading-tight`}>{title}</p>}
        {children && <div className={`${v.text} mt-1`}>{children}</div>}
      </div>
      {onClose && (
        <button onClick={onClose} className={`${v.text} opacity-60 hover:opacity-100`}>
          <X size={14} />
        </button>
      )}
    </div>
  )
}
