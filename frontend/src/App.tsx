import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './context/AuthContext'
import Login from './pages/Login'
import OTPLogin from './pages/OTPLogin'
import Signup from './pages/Signup'
import ForgotPassword from './pages/ForgotPassword'
import UserDashboard from './pages/UserDashboard'
import CoachDashboardEnhanced from './pages/CoachDashboardEnhanced'
import AdminDashboard from './pages/AdminDashboard'
import LeadManagement from './pages/LeadManagement'
import Analytics from './pages/Analytics'
import Unauthorized from './pages/Unauthorized'
import ProtectedRoute from './components/ProtectedRoute'

function AppRoutes() {
  const { user } = useAuth()

  return (
    <Routes>
      {/* Public routes */}
      <Route path="/login" element={user ? <Navigate to="/" replace /> : <Login />} />
      <Route path="/otp-login" element={user ? <Navigate to="/" replace /> : <OTPLogin />} />
      <Route path="/signup" element={user ? <Navigate to="/" replace /> : <Signup />} />
      <Route
        path="/forgot-password"
        element={user ? <Navigate to="/" replace /> : <ForgotPassword />}
      />

      {/* Protected routes - redirect to appropriate dashboard */}
      <Route
        path="/"
        element={
          user ? (
            user.role === 'ADMIN' ? (
              <Navigate to="/admin" replace />
            ) : user.role === 'COACH' ? (
              <Navigate to="/coach-dashboard" replace />
            ) : (
              <Navigate to="/user-dashboard" replace />
            )
          ) : (
            <Navigate to="/otp-login" replace />
          )
        }
      />

      {/* User routes */}
      <Route
        path="/user-dashboard"
        element={
          <ProtectedRoute allowedRoles={['USER']}>
            <UserDashboard />
          </ProtectedRoute>
        }
      />

      {/* Coach routes */}
      <Route
        path="/coach-dashboard"
        element={
          <ProtectedRoute allowedRoles={['COACH']}>
            <CoachDashboardEnhanced />
          </ProtectedRoute>
        }
      />

      {/* Admin routes */}
      <Route
        path="/admin"
        element={
          <ProtectedRoute allowedRoles={['ADMIN']}>
            <AdminDashboard />
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin/leads"
        element={
          <ProtectedRoute allowedRoles={['ADMIN']}>
            <LeadManagement />
          </ProtectedRoute>
        }
      />
      <Route
        path="/analytics"
        element={
          <ProtectedRoute allowedRoles={['ADMIN', 'COACH', 'USER']}>
            <Analytics />
          </ProtectedRoute>
        }
      />

      {/* Unauthorized */}
      <Route path="/unauthorized" element={<Unauthorized />} />

      {/* Fallback */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

function App() {
  return (
    <AuthProvider>
      <Router>
        <div className="min-h-screen bg-gray-50">
          <AppRoutes />
        </div>
      </Router>
    </AuthProvider>
  )
}

export default App
