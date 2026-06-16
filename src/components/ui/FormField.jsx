import React from 'react'

export function FormField({ label, required, children, error }) {
  return (
    <div className="space-y-1">
      {label && (
        <label className="block text-sm font-medium text-slate-700">
          {label}{required && <span className="text-red-500 mr-0.5">*</span>}
        </label>
      )}
      {children}
      {error && <p className="text-xs text-red-500">{error}</p>}
    </div>
  )
}

export function Input({ className = '', type, onWheel, ...props }) {
  // מונע שינוי ערך בגלילת גלגל עכבר בשדות מספריים
  const handleWheel = type === 'number'
    ? (e => { e.target.blur(); onWheel?.(e) })
    : onWheel
  return (
    <input
      type={type}
      onWheel={handleWheel}
      {...props}
      className={`w-full px-3 py-2 text-sm rounded-lg border border-slate-200
                  focus:outline-none focus:ring-2 focus:ring-teal-400 focus:border-transparent
                  disabled:bg-slate-50 disabled:text-slate-400
                  ${className}`}
    />
  )
}

export function Select({ children, className = '', ...props }) {
  return (
    <select
      {...props}
      className={`w-full px-3 py-2 text-sm rounded-lg border border-slate-200
                  focus:outline-none focus:ring-2 focus:ring-teal-400 focus:border-transparent
                  bg-white disabled:bg-slate-50
                  ${className}`}
    >
      {children}
    </select>
  )
}

export function Textarea({ className = '', ...props }) {
  return (
    <textarea
      {...props}
      rows={props.rows ?? 3}
      className={`w-full px-3 py-2 text-sm rounded-lg border border-slate-200
                  focus:outline-none focus:ring-2 focus:ring-teal-400 focus:border-transparent
                  resize-none ${className}`}
    />
  )
}
