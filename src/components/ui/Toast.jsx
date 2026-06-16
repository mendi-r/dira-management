import React, { createContext, useContext, useState, useCallback } from 'react'
import { CheckCircle, XCircle, AlertCircle, X } from 'lucide-react'

const ToastContext = createContext(null)

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([])

  const add = useCallback((msg, type = 'success') => {
    const id = Date.now()
    setToasts(t => [...t, { id, msg, type }])
    setTimeout(() => setToasts(t => t.filter(x => x.id !== id)), 2500)
  }, [])

  const remove = useCallback((id) => setToasts(t => t.filter(x => x.id !== id)), [])

  const icons = {
    success: <CheckCircle size={16} className="text-emerald-500 flex-shrink-0" />,
    error:   <XCircle    size={16} className="text-red-500 flex-shrink-0" />,
    info:    <AlertCircle size={16} className="text-blue-500 flex-shrink-0" />,
  }

  return (
    <ToastContext.Provider value={add}>
      {children}
      <div className="fixed bottom-4 left-4 z-[100] flex flex-col gap-2 min-w-[260px] max-w-sm">
        {toasts.map(({ id, msg, type }) => (
          <div key={id} className="flex items-center gap-3 bg-white rounded-xl shadow-lg border border-slate-200 px-4 py-3 fade-in">
            {icons[type]}
            <span className="text-sm text-slate-700 flex-1">{msg}</span>
            <button onClick={() => remove(id)} className="text-slate-400 hover:text-slate-600">
              <X size={14} />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}

export const useToast = () => useContext(ToastContext)
