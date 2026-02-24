import { useState, useEffect, useRef } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { displayName, formatDate } from '@/lib/utils'
import { useAuth } from '@/contexts/AuthContext'
import type { SupportThreadDto, SupportMessageDto } from '@arab-tili/shared-types'
import { Send } from 'lucide-react'

const TABS = ['open', 'claimed', 'closed', 'all'] as const
type Tab = typeof TABS[number]
const TAB_LABELS: Record<Tab, string> = { open: 'Ochiq', claimed: 'Qabul qilingan', closed: 'Yopilgan', all: 'Barchasi' }

export default function SupportPage() {
  const { admin } = useAuth()
  const qc = useQueryClient()
  const [tab, setTab] = useState<Tab>('open')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [reply, setReply] = useState('')
  const messagesEndRef = useRef<HTMLDivElement>(null)

  const { data: threads } = useQuery<{ data: SupportThreadDto[] }>({
    queryKey: ['threads', tab],
    queryFn: () => api.get(`/support/threads?status=${tab === 'all' ? '' : tab}&limit=50`).then((r) => r.data),
    refetchInterval: 5_000,
  })

  const { data: messages = [] } = useQuery<SupportMessageDto[]>({
    queryKey: ['messages', selectedId],
    queryFn: () => api.get(`/support/threads/${selectedId}/messages`).then((r) => r.data),
    enabled: !!selectedId,
    refetchInterval: 5_000,
  })

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const sendReply = useMutation({
    mutationFn: (text: string) => api.post(`/support/threads/${selectedId}/messages`, { text }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['messages', selectedId] })
      setReply('')
    },
  })

  const claim = useMutation({
    mutationFn: () => api.patch(`/support/threads/${selectedId}/claim`),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['threads', tab] }),
  })

  const close = useMutation({
    mutationFn: () => api.patch(`/support/threads/${selectedId}/close`),
    onSuccess: () => { void qc.invalidateQueries({ queryKey: ['threads', tab] }); setSelectedId(null) },
  })

  const selectedThread = threads?.data.find((t) => t.id === selectedId)

  return (
    <div className="flex gap-4 h-full" style={{ minHeight: 'calc(100vh - 8rem)' }}>
      {/* Thread list */}
      <div className="w-72 bg-white border border-gray-200 rounded-xl flex flex-col">
        <div className="flex overflow-x-auto border-b border-gray-100 p-1 gap-1">
          {TABS.map((t) => (
            <button
              key={t}
              onClick={() => { setTab(t); setSelectedId(null) }}
              className={`whitespace-nowrap px-2 py-1 text-xs rounded-md transition-colors ${tab === t ? 'bg-blue-600 text-white' : 'text-gray-500 hover:bg-gray-100'}`}
            >
              {TAB_LABELS[t]}
            </button>
          ))}
        </div>
        <div className="flex-1 overflow-y-auto divide-y divide-gray-50">
          {threads?.data.map((t) => (
            <button
              key={t.id}
              onClick={() => setSelectedId(t.id)}
              className={`w-full text-left px-4 py-3 hover:bg-gray-50 transition-colors ${selectedId === t.id ? 'bg-blue-50' : ''}`}
            >
              <p className="text-sm font-medium text-gray-900 truncate">
                {displayName(t.userFirstName, t.userLastName, null)}
              </p>
              <p className="text-xs text-gray-400 mt-0.5">{formatDate(t.updatedAt)}</p>
              <span className={`text-xs mt-1 inline-block px-1.5 py-0.5 rounded ${
                t.status === 'open' ? 'bg-yellow-100 text-yellow-700' :
                t.status === 'claimed' ? 'bg-blue-100 text-blue-700' :
                'bg-gray-100 text-gray-500'
              }`}>{TAB_LABELS[t.status as Tab] ?? t.status}</span>
            </button>
          ))}
          {threads?.data.length === 0 && (
            <p className="px-4 py-6 text-sm text-gray-400 text-center">Murojaatlar yo'q</p>
          )}
        </div>
      </div>

      {/* Message panel */}
      <div className="flex-1 bg-white border border-gray-200 rounded-xl flex flex-col">
        {!selectedId ? (
          <div className="flex-1 flex items-center justify-center text-gray-400 text-sm">
            Murojaat tanlang
          </div>
        ) : (
          <>
            {/* Thread header */}
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
              <div>
                <p className="font-semibold text-gray-900">
                  {displayName(selectedThread?.userFirstName ?? null, selectedThread?.userLastName ?? null, null)}
                </p>
                <p className="text-xs text-gray-400">ID: {selectedId}</p>
              </div>
              <div className="flex gap-2">
                {selectedThread?.status === 'open' && (
                  <button onClick={() => claim.mutate()}
                    className="text-xs bg-blue-600 text-white px-3 py-1.5 rounded-lg hover:bg-blue-700">
                    Qabul qilish
                  </button>
                )}
                {selectedThread?.status !== 'closed' && (
                  <button onClick={() => { if (confirm('Yopishni tasdiqlaysizmi?')) close.mutate() }}
                    className="text-xs border border-gray-300 text-gray-600 px-3 py-1.5 rounded-lg hover:bg-gray-50">
                    Yopish
                  </button>
                )}
              </div>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {messages.map((m) => {
                const isAdmin = m.senderType === 'admin'
                return (
                  <div key={m.id} className={`flex ${isAdmin ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-xs lg:max-w-md px-4 py-2.5 rounded-2xl text-sm ${
                      isAdmin
                        ? 'bg-blue-600 text-white rounded-br-sm'
                        : 'bg-gray-100 text-gray-800 rounded-bl-sm'
                    }`}>
                      <p className="whitespace-pre-wrap">{m.bodyText}</p>
                      <p className={`text-xs mt-1 ${isAdmin ? 'text-blue-200' : 'text-gray-400'}`}>
                        {formatDate(m.sentAt)}
                      </p>
                    </div>
                  </div>
                )
              })}
              <div ref={messagesEndRef} />
            </div>

            {/* Reply input */}
            {selectedThread?.status !== 'closed' && (
              <div className="px-4 py-3 border-t border-gray-100 flex gap-2">
                <input
                  value={reply}
                  onChange={(e) => setReply(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey && reply.trim()) { e.preventDefault(); sendReply.mutate(reply.trim()) } }}
                  placeholder="Javob yozing..."
                  className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <button
                  onClick={() => { if (reply.trim()) sendReply.mutate(reply.trim()) }}
                  disabled={!reply.trim() || sendReply.isPending}
                  className="p-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                >
                  <Send className="h-4 w-4" />
                </button>
              </div>
            )}
          </>
        )}
      </div>
      {void admin}
    </div>
  )
}
