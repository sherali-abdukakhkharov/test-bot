import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { api } from '@/lib/api'
import { clearToken, isTokenValid, getRole } from '@/lib/auth'
import type { AdminDto } from '@arab-tili/shared-types'

interface AuthContextValue {
  admin: AdminDto | null
  role: string | null
  isLoading: boolean
  logout: () => void
  refetch: () => void
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [admin, setAdmin] = useState<AdminDto | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  const fetchAdmin = () => {
    if (!isTokenValid()) {
      setIsLoading(false)
      return
    }
    setIsLoading(true)
    api
      .get<AdminDto>('/auth/me')
      .then((res) => setAdmin(res.data))
      .catch(() => {
        clearToken()
        setAdmin(null)
      })
      .finally(() => setIsLoading(false))
  }

  useEffect(() => {
    fetchAdmin()
  }, [])

  const logout = () => {
    clearToken()
    setAdmin(null)
    window.location.href = '/login'
  }

  return (
    <AuthContext.Provider value={{ admin, role: getRole(), isLoading, logout, refetch: fetchAdmin }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider')
  return ctx
}
