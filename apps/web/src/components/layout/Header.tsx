import { useAuth } from '@/contexts/AuthContext'
import { displayName } from '@/lib/utils'
import { LogOut } from 'lucide-react'

export default function Header() {
  const { admin, logout } = useAuth()

  return (
    <header className="h-16 bg-white border-b border-gray-200 flex items-center justify-between px-6">
      <div />
      <div className="flex items-center gap-4">
        {admin && (
          <span className="text-sm text-gray-600">
            {displayName(admin.firstName, admin.lastName, admin.username)}
            <span className="ml-2 text-xs text-gray-400 capitalize">({admin.role})</span>
          </span>
        )}
        <button
          onClick={logout}
          className="flex items-center gap-2 text-sm text-gray-500 hover:text-red-600 transition-colors"
        >
          <LogOut className="h-4 w-4" />
          Chiqish
        </button>
      </div>
    </header>
  )
}
