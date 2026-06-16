import React from 'react'
import { Loader2 } from 'lucide-react'

const variants = {
  primary:   'bg-teal-600 hover:bg-teal-700 text-white shadow-sm',
  secondary: 'bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 shadow-sm',
  danger:    'bg-red-600 hover:bg-red-700 text-white shadow-sm',
  ghost:     'text-slate-600 hover:bg-slate-100',
}

export default function Button({ children, variant = 'primary', loading, icon: Icon, className = '', ...props }) {
  return (
    <button
      {...props}
      disabled={loading || props.disabled}
      className={`
        inline-flex items-center gap-2 h-9 px-4 rounded-lg text-sm font-medium
        transition-colors focus:outline-none focus:ring-2 focus:ring-teal-400 focus:ring-offset-1
        disabled:opacity-50 disabled:cursor-not-allowed
        ${variants[variant]} ${className}
      `}
    >
      {loading
        ? <Loader2 size={15} className="animate-spin" />
        : Icon && <Icon size={15} />
      }
      {children}
    </button>
  )
}
