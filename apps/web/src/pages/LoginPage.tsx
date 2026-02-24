import { useState, type ChangeEvent } from 'react'
import { useNavigate, Navigate } from 'react-router-dom'
import { api } from '@/lib/api'
import { setToken } from '@/lib/auth'
import { useAuth } from '@/contexts/AuthContext'

export default function LoginPage() {
  const navigate = useNavigate()
  const { admin, isLoading, refetch } = useAuth()
  const [code, setCode] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  // Wait for AuthContext to finish the /auth/me check before deciding
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
      </div>
    )
  }
  // Server confirmed the token is valid — send to dashboard
  if (admin) return <Navigate to="/" replace />

  const submit = async (value: string) => {
    if (value.length !== 6 || loading) return
    setLoading(true)
    setError('')
    try {
      const res = await api.post<{ accessToken: string; role: string }>('/auth/otp', { code: value })
      setToken(res.data.accessToken, res.data.role)
      // Trigger AuthContext to re-fetch /auth/me with the new token.
      // This sets isLoading=true so ProtectedRoute shows a spinner while
      // the server confirms the session, then admin is set and dashboard loads.
      refetch()
      navigate('/', { replace: true })
    } catch {
      setError("Kod noto'g'ri yoki muddati o'tgan")
      setCode('')
    } finally {
      setLoading(false)
    }
  }

  const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value.replace(/\D/g, '').slice(0, 6)
    setCode(val)
    if (val.length === 6) void submit(val)
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="w-full max-w-sm bg-white rounded-2xl shadow-md p-8 space-y-6">
        <div className="text-center">
          <div className="text-4xl mb-3">🇸🇦</div>
          <h1 className="text-2xl font-bold text-gray-900">Arab Tili Admin</h1>
          <p className="mt-2 text-sm text-gray-500">
            Telegram botda{' '}
            <code className="bg-gray-100 px-1 rounded font-mono">/weblogin</code>{' '}
            buyrug'ini yuboring va 6 xonali kodni kiriting
          </p>
        </div>

        <input
          type="text"
          inputMode="numeric"
          pattern="[0-9]*"
          value={code}
          onChange={handleChange}
          placeholder="• • • • • •"
          maxLength={6}
          disabled={loading}
          autoFocus
          className="w-full text-center text-4xl tracking-[0.5em] font-mono border-2 border-gray-300 rounded-xl py-4 focus:outline-none focus:border-blue-500 transition-colors disabled:opacity-50"
        />

        {loading && (
          <div className="flex justify-center">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600" />
          </div>
        )}

        {error && (
          <p className="text-center text-sm text-red-500 font-medium">{error}</p>
        )}

        <p className="text-center text-xs text-gray-400">
          ⏰ Kod 15 soniya amal qiladi
        </p>
      </div>
    </div>
  )
}
