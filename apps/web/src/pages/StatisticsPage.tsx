import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { displayName } from '@/lib/utils'
import type { DashboardStatsDto, LeaderboardEntryDto } from '@arab-tili/shared-types'
import { Download } from 'lucide-react'
import { getToken } from '@/lib/auth'

export default function StatisticsPage() {
  const { data: stats } = useQuery<DashboardStatsDto>({
    queryKey: ['stats'],
    queryFn: () => api.get('/statistics/overview').then((r) => r.data),
  })

  const { data: leaderboard = [] } = useQuery<LeaderboardEntryDto[]>({
    queryKey: ['leaderboard'],
    queryFn: () => api.get('/statistics/leaderboard').then((r) => r.data),
  })

  const downloadExcel = async () => {
    const token = getToken()
    const res = await fetch('/api/v1/statistics/export', {
      headers: { Authorization: `Bearer ${token ?? ''}` },
    })
    const blob = await res.blob()
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `statistika_${Date.now()}.xlsx`
    a.click()
    URL.revokeObjectURL(url)
  }

  const medals = ['🥇', '🥈', '🥉']

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Statistika</h1>
        <button
          onClick={() => void downloadExcel()}
          className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm"
        >
          <Download className="h-4 w-4" /> Excel yuklash
        </button>
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Jami foydalanuvchilar', value: stats?.totalUsers },
          { label: "Bugun qo'shilgan", value: stats?.todayUsers },
          { label: 'Jami testlar', value: stats?.totalSessions },
          { label: 'Bugungi testlar', value: stats?.todaySessions },
        ].map(({ label, value }) => (
          <div key={label} className="bg-white rounded-xl border border-gray-200 p-5">
            <p className="text-xs text-gray-500">{label}</p>
            <p className="text-3xl font-bold text-gray-900 mt-1">{value ?? '—'}</p>
          </div>
        ))}
      </div>

      {/* Leaderboard */}
      <div className="bg-white rounded-xl border border-gray-200">
        <div className="px-6 py-4 border-b">
          <h2 className="font-semibold text-gray-900">🏆 Reyting (Top 40)</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-xs text-gray-500 uppercase">
              <tr>
                <th className="px-6 py-3 text-left">O'rin</th>
                <th className="px-4 py-3 text-left">Ism</th>
                <th className="px-4 py-3 text-center">Eng yaxshi natija</th>
                <th className="px-4 py-3 text-center">Testlar soni</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {leaderboard.map((entry) => (
                <tr key={entry.userId} className="hover:bg-gray-50">
                  <td className="px-6 py-3 font-bold text-gray-700">
                    {medals[entry.rank - 1] ?? entry.rank}
                  </td>
                  <td className="px-4 py-3 text-gray-900">
                    {displayName(entry.firstName, entry.lastName, entry.username)}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className={`font-bold ${entry.bestScore >= 80 ? 'text-green-600' : entry.bestScore >= 60 ? 'text-yellow-600' : 'text-red-500'}`}>
                      {entry.bestScore.toFixed(0)}%
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center text-gray-500">{entry.sessionsCount}</td>
                </tr>
              ))}
              {leaderboard.length === 0 && (
                <tr><td colSpan={4} className="px-6 py-8 text-center text-gray-400">Natijalar yo'q</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
