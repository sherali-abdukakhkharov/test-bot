import { createBrowserRouter, Navigate, Outlet } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import AppLayout from '@/components/layout/AppLayout'
import LoginPage from '@/pages/LoginPage'
import DashboardPage from '@/pages/DashboardPage'
import ContentPage from '@/pages/ContentPage'
import QuestionsPage from '@/pages/QuestionsPage'
import UsersPage from '@/pages/UsersPage'
import AdminsPage from '@/pages/AdminsPage'
import StatisticsPage from '@/pages/StatisticsPage'
import GuidePage from '@/pages/GuidePage'
import AnnouncementsPage from '@/pages/AnnouncementsPage'
import SupportPage from '@/pages/SupportPage'
import SettingsPage from '@/pages/SettingsPage'

function ProtectedRoute() {
  const { admin, isLoading } = useAuth()
  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
      </div>
    )
  }
  return admin ? <Outlet /> : <Navigate to="/login" replace />
}

function SuperAdminRoute() {
  const { admin, role, isLoading } = useAuth()
  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
      </div>
    )
  }
  if (!admin) return <Navigate to="/login" replace />
  if (role !== 'super') return <Navigate to="/" replace />
  return <Outlet />
}

export const router = createBrowserRouter([
  { path: '/login', element: <LoginPage /> },
  {
    element: <ProtectedRoute />,
    children: [
      {
        element: <AppLayout />,
        children: [
          { path: '/', element: <DashboardPage /> },
          { path: '/content', element: <ContentPage /> },
          { path: '/questions/:topicId', element: <QuestionsPage /> },
          { path: '/users', element: <UsersPage /> },
          { path: '/statistics', element: <StatisticsPage /> },
          { path: '/guide', element: <GuidePage /> },
          { path: '/announcements', element: <AnnouncementsPage /> },
          { path: '/support', element: <SupportPage /> },
        ],
      },
      {
        element: <SuperAdminRoute />,
        children: [
          {
            element: <AppLayout />,
            children: [
              { path: '/admins', element: <AdminsPage /> },
              { path: '/settings', element: <SettingsPage /> },
            ],
          },
        ],
      },
    ],
  },
  { path: '*', element: <Navigate to="/" replace /> },
])
