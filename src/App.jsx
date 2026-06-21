import React, { lazy, Suspense } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './contexts/AuthContext'
import { AlertsProvider } from './contexts/AlertsContext'
import { ToastProvider } from './components/ui/Toast'
import Layout from './components/Layout'
import ErrorBoundary from './components/ErrorBoundary'
import ConnectionGuard from './components/ConnectionGuard'

// ── Lazy-load כל עמוד — כל עמוד נטען רק כשנכנסים אליו ──
const Login        = lazy(() => import('./pages/Login'))
const Dashboard    = lazy(() => import('./pages/Dashboard'))
const Bochurim     = lazy(() => import('./pages/Bochurim'))
const Dirot        = lazy(() => import('./pages/Dirot'))
const Shibutzim    = lazy(() => import('./pages/Shibutzim'))
const Gviya        = lazy(() => import('./pages/Gviya'))
const Tashlumim    = lazy(() => import('./pages/Tashlumim'))
const Tachzuka     = lazy(() => import('./pages/Tachzuka'))
const Monim        = lazy(() => import('./pages/Monim'))
const Hagdarot     = lazy(() => import('./pages/Hagdarot'))
const Reports      = lazy(() => import('./pages/Reports'))
const CalendarPage = lazy(() => import('./pages/CalendarPage'))
const History      = lazy(() => import('./pages/History'))
const UserManagement = lazy(() => import('./pages/UserManagement'))

function PageLoader() {
  return (
    <div className="flex items-center justify-center py-24">
      <div className="animate-spin rounded-full h-8 w-8 border-4 border-teal-500 border-t-transparent"/>
    </div>
  )
}

function Wrap({ children }) {
  return (
    <ErrorBoundary>
      <Suspense fallback={<PageLoader />}>
        {children}
      </Suspense>
    </ErrorBoundary>
  )
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
        <Route index          element={<Wrap><Dashboard /></Wrap>} />
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
