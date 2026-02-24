import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { formatDate, displayName } from '@/lib/utils'
import { getAdminId } from '@/lib/auth'
import type { AdminDto } from '@arab-tili/shared-types'
import { CheckCircle, XCircle, ShieldOff, Shield } from 'lucide-react'

export default function AdminsPage() {
  const qc = useQueryClient()

  const { data: admins = [] } = useQuery<AdminDto[]>({
    queryKey: ['admins'],
    queryFn: () => api.get('/admins').then((r) => r.data),
  })

  const approve = useMutation({
    mutationFn: (id: number) => api.patch(`/admins/${id}/approve`),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['admins'] }),
  })
  const reject = useMutation({
    mutationFn: (id: number) => api.delete(`/admins/${id}/reject`),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['admins'] }),
  })
  const toggleBlock = useMutation({
    mutationFn: ({ id, isBlocked }: { id: number; isBlocked: boolean }) =>
      api.patch(`/admins/${id}/block`, { isBlocked }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['admins'] }),
  })
  const promote = useMutation({
    mutationFn: (id: number) => api.patch(`/admins/${id}/promote`),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['admins'] }),
  })
  const demote = useMutation({
    mutationFn: (id: number) => api.patch(`/admins/${id}/demote`),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['admins'] }),
  })

  const currentAdminId = getAdminId()
  const pending = admins.filter((a) => !a.isApproved)
  const approved = admins.filter((a) => a.isApproved)

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Adminlar</h1>

      {/* Pending */}
      {pending.length > 0 && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4">
          <h2 className="text-sm font-semibold text-yellow-800 mb-3">
            ⏳ Tasdiqlash kutilayotganlar ({pending.length})
          </h2>
          <div className="space-y-2">
            {pending.map((a) => (
              <div key={a.id} className="flex items-center justify-between bg-white rounded-lg px-4 py-3 border border-yellow-100">
                <div>
                  <p className="text-sm font-medium text-gray-900">
                    {displayName(a.firstName, a.lastName, a.username)}
                  </p>
                  <p className="text-xs text-gray-400">TG: {a.telegramId} · {formatDate(a.createdAt)}</p>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => approve.mutate(a.id)}
                    className="flex items-center gap-1 text-xs bg-green-600 text-white px-3 py-1.5 rounded-lg hover:bg-green-700"
                  >
                    <CheckCircle className="h-3.5 w-3.5" /> Tasdiqlash
                  </button>
                  <button
                    onClick={() => { if (confirm('Rad etishni tasdiqlaysizmi?')) reject.mutate(a.id) }}
                    className="flex items-center gap-1 text-xs bg-red-100 text-red-700 px-3 py-1.5 rounded-lg hover:bg-red-200"
                  >
                    <XCircle className="h-3.5 w-3.5" /> Rad etish
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* All admins table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="px-6 py-4 border-b">
          <h2 className="font-semibold text-gray-900">Barcha adminlar ({approved.length})</h2>
        </div>
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-xs text-gray-500 uppercase">
            <tr>
              <th className="px-6 py-3 text-left">Ism</th>
              <th className="px-4 py-3 text-left">Telegram ID</th>
              <th className="px-4 py-3 text-center">Rol</th>
              <th className="px-4 py-3 text-center">Holat</th>
              <th className="px-4 py-3 text-left">Qo'shilgan</th>
              <th className="px-4 py-3 text-right">Amal</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {approved.map((a) => (
              <tr key={a.id} className="hover:bg-gray-50">
                <td className="px-6 py-3 font-medium text-gray-900">
                  {displayName(a.firstName, a.lastName, a.username)}
                </td>
                <td className="px-4 py-3 text-gray-500 font-mono text-xs">{a.telegramId}</td>
                <td className="px-4 py-3 text-center">
                  <span className={`text-xs px-2 py-0.5 rounded-full ${
                    a.role === 'super' ? 'bg-purple-100 text-purple-700' : 'bg-gray-100 text-gray-600'
                  }`}>
                    {a.role === 'super' ? 'Super' : 'Oddiy'}
                  </span>
                </td>
                <td className="px-4 py-3 text-center">
                  {a.isBlocked ? (
                    <span className="bg-red-100 text-red-700 text-xs px-2 py-0.5 rounded-full">Bloklangan</span>
                  ) : (
                    <span className="bg-green-100 text-green-700 text-xs px-2 py-0.5 rounded-full">Faol</span>
                  )}
                </td>
                <td className="px-4 py-3 text-gray-500">{formatDate(a.createdAt)}</td>
                <td className="px-4 py-3 text-right">
                  <div className="flex gap-2 justify-end flex-wrap">
                    {a.role !== 'super' && (
                      <button
                        onClick={() => toggleBlock.mutate({ id: a.id, isBlocked: !a.isBlocked })}
                        className="flex items-center gap-1 text-xs text-gray-500 hover:text-red-600"
                      >
                        {a.isBlocked ? <Shield className="h-3.5 w-3.5" /> : <ShieldOff className="h-3.5 w-3.5" />}
                        {a.isBlocked ? 'Blokdan chiqarish' : 'Bloklash'}
                      </button>
                    )}
                    {a.role !== 'super' && a.isApproved && (
                      <button
                        onClick={() => { if (confirm('Super Admin qilishni tasdiqlaysizmi?')) promote.mutate(a.id) }}
                        className="text-xs text-purple-600 hover:text-purple-800"
                      >
                        ▲ Super
                      </button>
                    )}
                    {a.role === 'super' && a.id !== currentAdminId && (
                      <button
                        onClick={() => { if (confirm('Oddiy adminga tushirishni tasdiqlaysizmi?')) demote.mutate(a.id) }}
                        className="text-xs text-orange-600 hover:text-orange-800"
                      >
                        ▼ Oddiy
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
            {approved.length === 0 && (
              <tr><td colSpan={6} className="px-6 py-8 text-center text-gray-400">Adminlar yo'q</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
