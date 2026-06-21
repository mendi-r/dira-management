import React from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './contexts/AuthContext'
import { AlertsProvider } from './contexts/AlertsContext'
import { ToastProvider } from './components/ui/Toast'
import Layout from './components/Layout'
import ErrorBoundary from './components/ErrorBoundary'
import ConnectionGuard from './components/ConnectionGuard'

// ── ייבוא ישיר — ניווט מיידי, ללא המתנה לטעינת chunk ──
import Login          from './pages/Login'
import Dashboard      from './pages/Dashboard'
import Bochurim       from './pages/Bochurim'
import Dirot          from './pages/Dirot'
import Shibutzim      from './pages/Shibutzim'
import Gviya          from './pages/Gviya'
import Tashlumim      from './pages/Tashlumim'
import Tachzuka       from './pages/Tachzuka'
import Monim          from './pages/Monim'
import Hagdarot       from './pages/Hagdarot'
import Reports        from './pages/Reports'
import CalendarPage   from './pages/CalendarPage'
import History        from './pages/History'
import UserManagement from './pages/UserManagement'

function Wrap({ children }) {
  return <ErrorBoundary>{children}</ErrorBoundary>
}

function PrivateRoute({ children }) {
  const { user, loading } = useAuth()
  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-teal-50">
      <div className="animate-spin rounded-full h-12 w-12 border-4 border-teal-500 border-t-transparent" />
    </div>
  )
  return user ? children : <Navigate to="/login" replace />
}

function AppRoutes() {
  const { user } = useAuth()
  return (
    <Routes>
      <Route path="/login" element={user ? <Navigate to="/" replace /> : <Wrap><Login /></Wrap>} />
      <Route path="/" element={<PrivateRoute><Layout /></PrivateRoute>}>
        <Route index            element={<Wrap><Dashboard /></Wrap>} />
        <Route path="bochurim"  element={<Wrap><Bochurim /></Wrap>} />
        <Route path="dirot"     element={<Wrap><Dirot /></Wrap>} />
        <Route path="shibutzim" element={<Wrap><Shibutzim /></Wrap>} />
        <Route path="gviya"     element={<Wrap><Gviya /></Wrap>} />
        <Route path="tashlumim" element={<Wrap><Tashlumim /></Wrap>} />
        <Route path="tachzuka"  element={<Wrap><Tachzuka /></Wrap>} />
        <Route path="monim"     element={<Wrap><Monim /></Wrap>} />
        <Route path="hagdarot"  element={<Wrap><Hagdarot /></Wrap>} />
        <Route path="reports"   element={<Wrap><Reports /></Wrap>} />
        <Route path="calendar"  element={<Wrap><CalendarPage /></Wrap>} />
        <Route path="history"   element={<Wrap><History /></Wrap>} />
        <Route path="users"     element={<Wrap><UserManagement /></Wrap>} />
      </Route>
    </Routes>
  )
}

export default function App() {
  return (
    <ToastProvider>
      <AuthProvider>
        <AlertsProvider>
          <BrowserRouter>
            <ConnectionGuard>
              <AppRoutes />
            </ConnectionGuard>
          </BrowserRouter>
        </AlertsProvider>
      </AuthProvider>
    </ToastProvider>
  )
}
