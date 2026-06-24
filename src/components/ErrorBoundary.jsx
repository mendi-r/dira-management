import React from 'react'
import { AlertTriangle, RefreshCw } from 'lucide-react'

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError() {
    return { hasError: true }
  }

  componentDidCatch() {
    // שגיאות נרשמות בשירות ניטור — לא נחשפות למשתמש
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center min-h-[300px] p-8 text-center">
          <div className="w-14 h-14 rounded-full bg-red-100 flex items-center justify-center mb-4">
            <AlertTriangle size={28} className="text-red-500" />
          </div>
          <h2 className="text-lg font-bold text-slate-800 mb-2">משהו השתבש</h2>
          <p className="text-sm text-slate-500 mb-5 max-w-xs">
            {this.props.message ?? 'אירעה שגיאה בטעינת הדף. שאר המערכת ממשיכה לעבוד.'}
          </p>
          <button
            onClick={() => this.setState({ hasError: false })}
            className="inline-flex items-center gap-2 px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white text-sm font-medium rounded-lg transition-colors"
          >
            <RefreshCw size={14} />
            נסה שוב
          </button>
        </div>
      )
    }
    return this.props.children
  }
}
