import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { formatDate } from '@/lib/utils'
import type { AnnouncementDto } from '@arab-tili/shared-types'
import { Plus, X } from 'lucide-react'

function CreateModal({ onClose, onSave }: {
  onClose: () => void
  onSave: (d: { bodyText?: string; mediaType?: string; mediaFileId?: string }) => void
}) {
  const [text, setText] = useState('')

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-gray-900">E'lon yaratish</h3>
          <button onClick={onClose}><X className="h-5 w-5 text-gray-400" /></button>
        </div>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={5}
          placeholder="E'lon matni..."
          className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
          autoFocus
        />
        {text.trim() && (
          <div className="bg-gray-50 rounded-lg p-3">
            <p className="text-xs text-gray-500 mb-1">Ko'rinishi:</p>
            <p className="text-sm text-gray-800 whitespace-pre-wrap">{text}</p>
          </div>
        )}
        <div className="flex gap-2 justify-end">
          <button onClick={onClose} className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg">Bekor</button>
          <button
            disabled={!text.trim()}
            onClick={() => onSave({ bodyText: text.trim() })}
            className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
          >
            Yuborish
          </button>
        </div>
      </div>
    </div>
  )
}

export default function AnnouncementsPage() {
  const qc = useQueryClient()
  const [showCreate, setShowCreate] = useState(false)

  const { data: announcements = [] } = useQuery<AnnouncementDto[]>({
    queryKey: ['announcements'],
    queryFn: () => api.get('/announcements').then((r) => r.data),
  })

  const create = useMutation({
    mutationFn: (d: { bodyText?: string; mediaType?: string; mediaFileId?: string }) =>
      api.post('/announcements', d),
    onSuccess: () => { void qc.invalidateQueries({ queryKey: ['announcements'] }); setShowCreate(false) },
  })

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">E'lonlar</h1>
        <button
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-2 px-3 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          <Plus className="h-4 w-4" /> E'lon yaratish
        </button>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-xs text-gray-500 uppercase">
            <tr>
              <th className="px-6 py-3 text-left">Matn</th>
              <th className="px-4 py-3 text-left">Yaratilgan</th>
              <th className="px-4 py-3 text-center">Holat</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {announcements.map((a) => (
              <tr key={a.id} className="hover:bg-gray-50">
                <td className="px-6 py-3 text-gray-800 max-w-xs truncate">
                  {a.bodyText ?? <span className="text-gray-400 italic">[Media]</span>}
                </td>
                <td className="px-4 py-3 text-gray-500">{formatDate(a.createdAt)}</td>
                <td className="px-4 py-3 text-center">
                  {a.isExpired ? (
                    <span className="bg-gray-100 text-gray-500 text-xs px-2 py-0.5 rounded-full">Muddati o'tgan</span>
                  ) : (
                    <span className="bg-green-100 text-green-700 text-xs px-2 py-0.5 rounded-full">Faol</span>
                  )}
                </td>
              </tr>
            ))}
            {announcements.length === 0 && (
              <tr><td colSpan={3} className="px-6 py-8 text-center text-gray-400">E'lonlar yo'q</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {showCreate && (
        <CreateModal
          onClose={() => setShowCreate(false)}
          onSave={(d) => create.mutate(d)}
        />
      )}
    </div>
  )
}
