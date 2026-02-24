import { NavLink } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { cn } from '@/lib/utils'
import {
  LayoutDashboard,
  FolderTree,
  Users,
  BarChart3,
  BookOpen,
  Megaphone,
  MessageSquare,
  Settings,
  ShieldCheck,
} from 'lucide-react'

const navItems = [
  { to: '/', icon: LayoutDashboard, label: 'Bosh sahifa' },
  { to: '/content', icon: FolderTree, label: 'Kontent' },
  { to: '/users', icon: Users, label: 'Foydalanuvchilar' },
  { to: '/statistics', icon: BarChart3, label: 'Statistika' },
  { to: '/guide', icon: BookOpen, label: "Qo'llanma" },
  { to: '/announcements', icon: Megaphone, label: 'E\'lonlar' },
  { to: '/support', icon: MessageSquare, label: 'Yordam' },
]

const superItems = [
  { to: '/admins', icon: ShieldCheck, label: 'Adminlar' },
  { to: '/settings', icon: Settings, label: 'Sozlamalar' },
]

export default function Sidebar() {
  const { role } = useAuth()

  const items = role === 'super' ? [...navItems, ...superItems] : navItems

  return (
    <aside className="w-60 bg-white border-r border-gray-200 flex flex-col">
      <div className="h-16 flex items-center px-6 border-b border-gray-200">
        <span className="text-lg font-bold text-blue-600">Arab Tili Admin</span>
      </div>
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        {items.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            className={({ isActive }) =>
              cn(
                'flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors',
                isActive
                  ? 'bg-blue-50 text-blue-700'
                  : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900',
              )
            }
          >
            <Icon className="h-4 w-4 shrink-0" />
            {label}
          </NavLink>
        ))}
      </nav>
    </aside>
  )
}
