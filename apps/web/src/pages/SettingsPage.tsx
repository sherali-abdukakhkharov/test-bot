import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { KeyRound, CheckCircle } from 'lucide-react'

function PasswordCard({ title, endpoint }: { title: string; endpoint: string }) {
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [success, setSuccess] = useState(false)

  const update = useMutation({
    mutationFn: () => api.patch(endpoint, { password }),
    onSuccess: () => {
      setSuccess(true)
      setPassword('')
      setConfirm('')
      setTimeout(() => setSuccess(false), 3000)
    },
  })

  const valid = password.length >= 6 && password === confirm

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-4 max-w-sm">
      <div className="flex items-center gap-2">
        <KeyRound className="h-5 w-5 text-gray-500" />
        <h3 className="font-semibold text-gray-900">{title}</h3>
      </div>
      <input
        type="password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        placeholder="Yangi parol (min 6 ta belgi)"
        className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
      />
      <input
        type="password"
        value={confirm}
        onChange={(e) => setConfirm(e.target.value)}
        placeholder="Parolni tasdiqlang"
        className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
      />
      {password && confirm && password !== confirm && (
        <p className="text-xs text-red-500">Parollar mos kelmayapti</p>
      )}
      {success && (
        <div className="flex items-center gap-2 text-green-600 text-sm">
          <CheckCircle className="h-4 w-4" /> Parol muvaffaqiyatli o'zgartirildi
        </div>
      )}
      <button
        disabled={!valid || update.isPending}
        onClick={() => update.mutate()}
        className="w-full py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
      >
        {update.isPending ? 'Saqlanmoqda...' : 'Saqlash'}
      </button>
    </div>
  )
}

export default function SettingsPage() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Sozlamalar</h1>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <PasswordCard
          title="Admin umumiy paroli"
          endpoint="/settings/admin-password"
        />
        <PasswordCard
          title="Super admin paroli"
          endpoint="/settings/super-password"
        />
      </div>
    </div>
  )
}
