import React from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './contexts/AuthContext'
import { AlertsProvider } from './contexts/AlertsContext'
import { ToastProvider } from './components/ui/Toast'
import Layout from './components/Layout'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import Bochurim from './pages/Bochurim'
import Dirot from './pages/Dirot'
import Shibutzim from './pages/Shibutzim'
import Gviya from './pages/Gviya'
import Tashlumim from './pages/Tashlumim'
import Tachzuka from './pages/Tachzuka'
import Monim from './pages/Monim'
import Hagdarot from './pages/Hagdarot'
import Reports from './pages/Reports'
import CalendarPage from './pages/CalendarPage'
import History from './pages/History'
import UserManagement from './pages/UserManagement'
import ErrorBoundary from './components/ErrorBoundary'
import ConnectionGuard from './components/ConnectionGuard'

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
      <Route path="/login" element={user ? <Navigate to="/" replace /> : <Login />} />
      <Route path="/" element={<PrivateRoute><Layout /></PrivateRoute>}>
        <Route index element={<ErrorBoundary><Dashboard /></ErrorBoundary>} />
        <Route path="bochurim"  element={<ErrorBoundary><Bochurim /></ErrorBoundary>} />
        <Route path="dirot"     element={<ErrorBoundary><Dirot /></ErrorBoundary>} />
        <Route path="shibutzim" element={<ErrorBoundary><Shibutzim /></ErrorBoundary>} />
        <Route path="gviya"     element={<ErrorBoundary><Gviya /></ErrorBoundary>} />
        <Route path="tashlumim" element={<ErrorBoundary><Tashlumim /></ErrorBoundary>} />
        <Route path="tachzuka"  element={<ErrorBoundary><Tachzuka /></ErrorBoundary>} />
        <Route path="monim"     element={<ErrorBoundary><Monim /></ErrorBoundary>} />
        <Route path="hagdarot"  element={<ErrorBoundary><Hagdarot /></ErrorBoundary>} />
        <Route path="reports"   element={<ErrorBoundary><Reports /></ErrorBoundary>} />
        <Route path="calendar"  element={<ErrorBoundary><CalendarPage /></ErrorBoundary>} />
        <Route path="history"   element={<ErrorBoundary><History /></ErrorBoundary>} />
        <Route path="users"     element={<ErrorBoundary><UserManagement /></ErrorBoundary>} />
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
