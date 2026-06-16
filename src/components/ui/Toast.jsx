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
      <div className="fixed bottom-6 left-4 z-[100] flex flex-col gap-2 w-[min(90vw,340px)]">
        {toasts.map(({ id, msg, type }) => (
          <div key={id} className="flex items-start gap-3 bg-white rounded-xl shadow-lg border border-slate-200 px-4 py-3 fade-in">
            <div className="mt-0.5 flex-shrink-0">{icons[type]}</div>
            <span className="text-sm text-slate-700 flex-1 leading-snug">{msg}</span>
            <button onClick={() => remove(id)} className="text-slate-400 hover:text-slate-600 p-1 -m-1 flex-shrink-0 mt-0.5" aria-label="סגור">
              <X size={16} />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}

export const useToast = () => useContext(ToastContext)
