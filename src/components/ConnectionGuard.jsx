import React, { useEffect, useState } from 'react'
import { WifiOff, RefreshCw } from 'lucide-react'
import { supabase } from '../lib/supabase'

/**
 * בדיקת חיבור ב-background — לא חוסמת את ה-App.
 * מציגה overlay שגיאה רק אם הבדיקה נכשלת.
 */
export default function ConnectionGuard({ children }) {
  const [error, setError] = useState(false)

  async function check() {
    setError(false)
    try {
      const { error } = await supabase.from('bochurim').select('id', { head: true, count: 'exact' })
      if (error) setError(true)
    } catch {
      setError(true)
    }
  }

  useEffect(() => { check() }, [])

  // תמיד מרנדרים את הילדים — שגיאה מוצגת כ-overlay
  return (
    <>
      {children}
      {error && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-lg p-8 max-w-sm w-full text-center mx-4">
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
      )}
    </>
  )
}
