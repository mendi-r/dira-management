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
    <div className={`flex items-start gap-3 p-4 rounded-xl border ${v.bg} ${v.border}`}>
      <Icon size={18} className={`${v.icon_color} flex-shrink-0 mt-0.5`} />
      <div className="flex-1 min-w-0">
        {title && <p className={`text-sm font-semibold ${v.text}`}>{title}</p>}
        {children && <div className={`text-sm ${v.text} mt-0.5`}>{children}</div>}
      </div>
      {onClose && (
        <button onClick={onClose} className={`${v.text} opacity-60 hover:opacity-100`}>
          <X size={14} />
        </button>
      )}
    </div>
  )
}
