import React from 'react'
import { AlertTriangle, RefreshCw } from 'lucide-react'

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error }
  }

  componentDidCatch(error, info) {
    console.error('ErrorBoundary caught:', error, info)
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
            onClick={() => this.setState({ hasError: false, error: null })}
            className="inline-flex items-center gap-2 px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white text-sm font-medium rounded-lg transition-colors"
          >
            <RefreshCw size={14} />
            נסה שוב
          </button>
          {this.state.error && (
            <details className="mt-4 text-left max-w-sm">
              <summary className="text-xs text-slate-400 cursor-pointer">פרטי שגיאה</summary>
              <pre className="text-xs text-red-600 mt-1 bg-red-50 p-2 rounded overflow-auto max-h-40">
                {this.state.error.message}
              </pre>
            </details>
          )}
        </div>
      )
    }
    return this.props.children
  }
}
