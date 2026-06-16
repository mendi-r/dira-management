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
        <Route index element={<Dashboard />} />
        <Route path="bochurim"  element={<Bochurim />} />
        <Route path="dirot"     element={<Dirot />} />
        <Route path="shibutzim" element={<Shibutzim />} />
        <Route path="gviya"      element={<Gviya />} />
        <Route path="tashlumim"  element={<Tashlumim />} />
        <Route path="tachzuka"  element={<Tachzuka />} />
        <Route path="monim"     element={<Monim />} />
        <Route path="hagdarot"  element={<Hagdarot />} />
        <Route path="reports"   element={<Reports />} />
        <Route path="calendar"  element={<CalendarPage />} />
        <Route path="history"   element={<History />} />
        <Route path="users"     element={<UserManagement />} />
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
            <AppRoutes />
          </BrowserRouter>
        </AlertsProvider>
      </AuthProvider>
    </ToastProvider>
  )
}
