import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { formatDate, displayName } from '@/lib/utils'
import type { UserDto, TestSessionDto } from '@arab-tili/shared-types'
import { Search, ChevronLeft, ChevronRight, X } from 'lucide-react'

const PAGE_SIZE = 20

function ResultsSheet({ user, onClose }: { user: UserDto; onClose: () => void }) {
  const { data } = useQuery<TestSessionDto[]>({
    queryKey: ['user-results', user.telegramId],
    queryFn: () => api.get(`/users/${user.telegramId}/results`).then((r) => r.data),
  })

  return (
    <div className="fixed inset-0 bg-black/40 flex items-end sm:items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg max-h-[80vh] flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <h3 className="font-semibold">{displayName(user.firstName, user.lastName, user.username)} — Natijalar</h3>
          <button onClick={onClose}><X className="h-5 w-5 text-gray-400" /></button>
        </div>
        <div className="overflow-y-auto flex-1">
          {data?.length === 0 && <p className="px-6 py-4 text-sm text-gray-400">Natijalar yo'q</p>}
          {data?.map((s) => (
            <div key={s.id} className="px-6 py-3 border-b border-gray-50 flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-800">Mavzu #{s.topicId}</p>
                <p className="text-xs text-gray-400">{formatDate(s.startedAt)}</p>
              </div>
              <div className="text-right">
                <p className={`text-sm font-bold ${Number(s.scorePercent) >= 60 ? 'text-green-600' : 'text-red-500'}`}>
                  {Number(s.scorePercent).toFixed(0)}%
                </p>
                <p className="text-xs text-gray-400">{s.correctCount}/{s.totalQuestions}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

export default function UsersPage() {
  const qc = useQueryClient()
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [searchInput, setSearchInput] = useState('')
  const [filter, setFilter] = useState<'all' | 'blocked' | 'active'>('all')
  const [viewUser, setViewUser] = useState<UserDto | null>(null)

  const isBlocked = filter === 'blocked' ? true : filter === 'active' ? false : undefined

  const { data } = useQuery<{ data: UserDto[]; total: number }>({
    queryKey: ['users', page, search, isBlocked],
    queryFn: () => {
      const params = new URLSearchParams({ page: String(page), limit: String(PAGE_SIZE) })
      if (search) params.set('search', search)
      if (isBlocked !== undefined) params.set('isBlocked', String(isBlocked))
      return api.get(`/users?${params}`).then((r) => r.data)
    },
  })

  const toggleBlock = useMutation({
    mutationFn: ({ telegramId, isBlocked }: { telegramId: string; isBlocked: boolean }) =>
      api.patch(`/users/${telegramId}/block`, { isBlocked }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['users'] }),
  })

  const total = data?.total ?? 0
  const totalPages = Math.ceil(total / PAGE_SIZE)

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Foydalanuvchilar</h1>
        <span className="text-sm text-gray-500">{total} ta</span>
      </div>

      {/* Filters */}
      <div className="flex gap-3 flex-wrap">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') { setSearch(searchInput); setPage(1) } }}
            placeholder="Ism bo'yicha qidirish..."
            className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div className="flex gap-1 bg-gray-100 rounded-lg p-1">
          {(['all', 'active', 'blocked'] as const).map((f) => (
            <button
              key={f}
              onClick={() => { setFilter(f); setPage(1) }}
              className={`px-3 py-1 text-sm rounded-md transition-colors ${filter === f ? 'bg-white shadow text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}
            >
              {f === 'all' ? 'Barchasi' : f === 'active' ? 'Faol' : 'Bloklangan'}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-xs text-gray-500 uppercase">
            <tr>
              <th className="px-6 py-3 text-left">Ism</th>
              <th className="px-4 py-3 text-left">Telegram ID</th>
              <th className="px-4 py-3 text-left">Qo'shilgan</th>
              <th className="px-4 py-3 text-center">Holat</th>
              <th className="px-4 py-3 text-right">Amallar</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {data?.data.map((u) => (
              <tr key={u.id} className="hover:bg-gray-50">
                <td className="px-6 py-3 font-medium text-gray-900">
                  {displayName(u.firstName, u.lastName, u.username)}
                </td>
                <td className="px-4 py-3 text-gray-500 font-mono text-xs">{u.telegramId}</td>
                <td className="px-4 py-3 text-gray-500">{formatDate(u.createdAt)}</td>
                <td className="px-4 py-3 text-center">
                  {u.isBlocked ? (
                    <span className="bg-red-100 text-red-700 text-xs px-2 py-0.5 rounded-full">Bloklangan</span>
                  ) : (
                    <span className="bg-green-100 text-green-700 text-xs px-2 py-0.5 rounded-full">Faol</span>
                  )}
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center justify-end gap-2">
                    <button
                      onClick={() => setViewUser(u)}
                      className="text-xs text-blue-600 hover:underline"
                    >
                      Natijalar
                    </button>
                    <button
                      onClick={() => toggleBlock.mutate({ telegramId: u.telegramId, isBlocked: !u.isBlocked })}
                      className={`text-xs ${u.isBlocked ? 'text-green-600 hover:underline' : 'text-red-500 hover:underline'}`}
                    >
                      {u.isBlocked ? 'Blokdan chiqarish' : 'Bloklash'}
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {data?.data.length === 0 && (
              <tr><td colSpan={5} className="px-6 py-8 text-center text-gray-400">Foydalanuvchilar topilmadi</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1}
            className="p-2 rounded-lg border hover:bg-gray-50 disabled:opacity-40">
            <ChevronLeft className="h-4 w-4" />
          </button>
          <span className="text-sm text-gray-600">{page} / {totalPages}</span>
          <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page === totalPages}
            className="p-2 rounded-lg border hover:bg-gray-50 disabled:opacity-40">
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      )}

      {viewUser && <ResultsSheet user={viewUser} onClose={() => setViewUser(null)} />}
    </div>
  )
}
