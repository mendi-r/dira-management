import React, { useEffect, useState } from 'react'
import { AlertTriangle } from 'lucide-react'
import { _setHandler } from '../../lib/confirm'

export default function ConfirmDialog() {
  const [state, setState] = useState(null)

  useEffect(() => {
    _setHandler((message, opts = {}) =>
      new Promise(resolve => setState({ message, resolve, ...opts }))
    )
    return () => _setHandler(null)
  }, [])

  if (!state) return null

  const {
    message,
    resolve,
    confirmText = 'אישור',
    cancelText  = 'ביטול',
    danger      = false,
  } = state

  function done(val) {
    setState(null)
    resolve(val)
  }

  return (
    <div className="fixed inset-0 z-[300] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => done(false)} />
      <div className="relative bg-white rounded-2xl shadow-2xl p-6 max-w-xs w-full text-right animate-fade-in">
        {danger && (
          <div className="flex justify-center mb-3">
            <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center">
              <AlertTriangle size={20} className="text-red-600" />
            </div>
          </div>
        )}
        <p className="text-slate-700 text-sm leading-relaxed mb-5 whitespace-pre-line">{message}</p>
        <div className="flex justify-end gap-3">
          <button
            onClick={() => done(false)}
            className="h-9 px-4 text-sm rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 transition-colors">
            {cancelText}
          </button>
          <button
            onClick={() => done(true)}
            className={`h-9 px-4 text-sm rounded-lg text-white transition-colors ${
              danger ? 'bg-red-600 hover:bg-red-700' : 'bg-teal-600 hover:bg-teal-700'
            }`}>
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  )
}
