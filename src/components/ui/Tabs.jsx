import React from 'react'

export function Tabs({ tabs, active, onChange }) {
  return (
    <div className="flex gap-0 border-b border-slate-200 mb-5 overflow-x-auto">
      {tabs.map(tab => (
        <button
          key={tab.key}
          onClick={() => onChange(tab.key)}
          className={`px-4 py-2.5 text-sm font-medium whitespace-nowrap border-b-2 transition-colors -mb-px
            ${active === tab.key
              ? 'border-teal-500 text-teal-700'
              : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
            }`}
        >
          {tab.icon && <tab.icon size={14} className="inline ml-1" />}
          {tab.label}
        </button>
      ))}
    </div>
  )
}
