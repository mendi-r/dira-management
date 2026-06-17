import React, { useEffect, useState } from 'react'
import { WifiOff, RefreshCw } from 'lucide-react'
import { supabase } from '../lib/supabase'

export default function ConnectionGuard({ children }) {
  const [status, setStatus] = useState('checking') // 'checking' | 'ok' | 'error'

  async function check() {
    setStatus('checking')
    try {
      const { error } = await supabase.from('bochurim').select('id', { head: true, count: 'exact' })
      setStatus(error ? 'error' : 'ok')
    } catch {
      setStatus('error')
    }
  }

  useEffect(() => { check() }, [])

  if (status === 'checking') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-teal-50">
        <div className="flex flex-col items-center gap-3">
          <div className="animate-spin rounded-full h-12 w-12 border-4 border-teal-500 border-t-transparent" />
          <p className="text-sm text-slate-500">מתחבר למסד הנתונים...</p>
        </div>
      </div>
    )
  }

  if (status === 'error') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 p-6">
        <div className="bg-white rounded-2xl shadow-lg p-8 max-w-sm w-full text-center">
          <div className="w-16 h-16 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-4">
            <WifiOff size={30} className="text-red-500" />
          </div>
          <h2 className="text-xl font-bold text-slate-800 mb-2">אין חיבור</h2>
          <p className="text-sm text-slate-500 mb-6">
            לא ניתן להתחבר למסד הנתונים.<br/>
            בדוק את חיבור האינטרנט ונסה שוב.
          </p>
          <button
            onClick={check}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-teal-600 hover:bg-teal-700 text-white text-sm font-medium rounded-lg transition-colors w-full justify-center"
          >
            <RefreshCw size={15} />
            נסה שוב
          </button>
        </div>
      </div>
    )
  }

  return children
}
