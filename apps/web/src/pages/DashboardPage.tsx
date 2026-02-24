import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { api } from '@/lib/api'
import { formatDate } from '@/lib/utils'
import type { DashboardStatsDto, SupportThreadDto } from '@arab-tili/shared-types'
import { Users, BookOpen, Activity, MessageSquare } from 'lucide-react'

export default function DashboardPage() {
  const { data: stats } = useQuery<DashboardStatsDto>({
    queryKey: ['stats'],
    queryFn: () => api.get('/statistics/overview').then((r) => r.data),
    refetchInterval: 60_000,
  })

  const { data: threads } = useQuery<{ data: SupportThreadDto[] }>({
    queryKey: ['support-open'],
    queryFn: () => api.get('/support/threads?status=open&limit=5').then((r) => r.data),
    refetchInterval: 30_000,
  })

  const cards = [
    { label: 'Jami foydalanuvchilar', value: stats?.totalUsers ?? '—', icon: Users, color: 'blue' },
    { label: "Bugun qo'shilgan", value: stats?.todayUsers ?? '—', icon: Activity, color: 'green' },
    { label: 'Jami testlar', value: stats?.totalSessions ?? '—', icon: BookOpen, color: 'purple' },
    { label: 'Bugungi testlar', value: stats?.todaySessions ?? '—', icon: Activity, color: 'orange' },
  ]

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Bosh sahifa</h1>

      {/* Stat cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {cards.map(({ label, value, icon: Icon }) => (
          <div key={label} className="bg-white rounded-xl border border-gray-200 p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">{label}</p>
                <p className="text-3xl font-bold text-gray-900 mt-1">{value}</p>
              </div>
              <div className="bg-blue-50 rounded-lg p-3">
                <Icon className="h-6 w-6 text-blue-600" />
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Open support threads */}
      <div className="bg-white rounded-xl border border-gray-200">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="font-semibold text-gray-900 flex items-center gap-2">
            <MessageSquare className="h-4 w-4" />
            Ochiq murojaatlar
            {stats?.openSupportThreads ? (
              <span className="bg-red-100 text-red-700 text-xs font-medium px-2 py-0.5 rounded-full">
                {stats.openSupportThreads}
              </span>
            ) : null}
          </h2>
          <Link to="/support" className="text-sm text-blue-600 hover:underline">
            Barchasi →
          </Link>
        </div>
        <div className="divide-y divide-gray-50">
          {threads?.data.length === 0 && (
            <p className="px-6 py-4 text-sm text-gray-400">Ochiq murojaatlar yo'q</p>
          )}
          {threads?.data.map((t) => (
            <div key={t.id} className="px-6 py-3 flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-800">
                  {t.userFirstName} {t.userLastName ?? ''}
                </p>
                <p className="text-xs text-gray-400">{formatDate(t.createdAt)}</p>
              </div>
              <span className="text-xs bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded-full">
                ochiq
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Quick links */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { to: '/content', label: 'Kontent boshqaruvi' },
          { to: '/users', label: 'Foydalanuvchilar' },
          { to: '/support', label: 'Yordam xizmati' },
        ].map(({ to, label }) => (
          <Link
            key={to}
            to={to}
            className="bg-white border border-gray-200 rounded-xl p-4 text-center text-sm font-medium text-gray-700 hover:bg-blue-50 hover:border-blue-200 hover:text-blue-700 transition-colors"
          >
            {label}
          </Link>
        ))}
      </div>
    </div>
  )
}
