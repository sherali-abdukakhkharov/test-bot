import { useState, useRef } from 'react'
import { useParams, Link } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import type { QuestionDto, TopicDto } from '@arab-tili/shared-types'
import { Plus, Trash2, Upload, Download, ChevronLeft, ChevronRight } from 'lucide-react'

const PAGE_SIZE = 20

function QuestionCard({ q, onDelete }: { q: QuestionDto; onDelete: () => void }) {
  return (
    <div className="bg-white border border-gray-200 rounded-xl p-4 space-y-3">
      <div className="flex items-start justify-between gap-4">
        <p className="text-sm text-gray-800 font-medium flex-1">
          {q.bodyText ?? <span className="text-gray-400 italic">[Matn yo'q]</span>}
          {q.mediaType && (
            <span className="ml-2 text-xs bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded">
              {q.mediaType}
            </span>
          )}
        </p>
        <button onClick={onDelete} className="text-gray-400 hover:text-red-500 shrink-0">
          <Trash2 className="h-4 w-4" />
        </button>
      </div>
      <div className="grid grid-cols-2 gap-1.5">
        {q.options.map((o) => (
          <div
            key={o.id}
            className={`text-xs px-3 py-1.5 rounded-lg border ${
              o.isCorrect
                ? 'border-green-300 bg-green-50 text-green-800 font-medium'
                : 'border-gray-200 text-gray-600'
            }`}
          >
            {o.isCorrect && '✓ '}{o.bodyText}
          </div>
        ))}
      </div>
    </div>
  )
}

function AddQuestionModal({ topicId, onClose, onSave }: {
  topicId: number
  onClose: () => void
  onSave: (q: { topicId: number; bodyText: string; options: { bodyText: string; isCorrect: boolean }[] }) => void
}) {
  const [body, setBody] = useState('')
  const [options, setOptions] = useState([
    { bodyText: '', isCorrect: true },
    { bodyText: '', isCorrect: false },
    { bodyText: '', isCorrect: false },
    { bodyText: '', isCorrect: false },
  ])

  const setCorrect = (idx: number) => setOptions(options.map((o, i) => ({ ...o, isCorrect: i === idx })))
  const updateText = (idx: number, text: string) => setOptions(options.map((o, i) => i === idx ? { ...o, bodyText: text } : o))

  const valid = body.trim() && options.filter((o) => o.bodyText.trim()).length >= 2 && options.some((o) => o.isCorrect)

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg p-6 space-y-4 max-h-[90vh] overflow-y-auto">
        <h3 className="font-semibold text-gray-900">Savol qo'shish</h3>
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="Savol matni"
          rows={3}
          className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
          autoFocus
        />
        <div className="space-y-2">
          <p className="text-xs text-gray-500 font-medium">Javob variantlari (to'g'risini tanlang)</p>
          {options.map((o, i) => (
            <div key={i} className="flex items-center gap-2">
              <input
                type="radio"
                checked={o.isCorrect}
                onChange={() => setCorrect(i)}
                className="accent-green-600"
              />
              <input
                value={o.bodyText}
                onChange={(e) => updateText(i, e.target.value)}
                placeholder={`Variant ${i + 1}`}
                className="flex-1 border rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          ))}
        </div>
        <div className="flex gap-2 justify-end">
          <button onClick={onClose} className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg">Bekor</button>
          <button
            disabled={!valid}
            onClick={() => onSave({ topicId, bodyText: body.trim(), options: options.filter((o) => o.bodyText.trim()) })}
            className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
          >
            Saqlash
          </button>
        </div>
      </div>
    </div>
  )
}

export default function QuestionsPage() {
  const { topicId } = useParams<{ topicId: string }>()
  const topicIdNum = Number(topicId)
  const qc = useQueryClient()
  const [page, setPage] = useState(1)
  const [showAdd, setShowAdd] = useState(false)
  const [importing, setImporting] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  const { data: topic } = useQuery<TopicDto>({
    queryKey: ['topic', topicIdNum],
    queryFn: () => api.get(`/topics?sectionId=0`).then(() =>
      api.get(`/topics?sectionId=0`).then(() => ({} as TopicDto))
    ),
    enabled: false, // we use the list endpoint instead
  })

  const { data } = useQuery<{ data: QuestionDto[]; total: number; page: number; limit: number }>({
    queryKey: ['questions', topicIdNum, page],
    queryFn: () => api.get(`/questions?topicId=${topicIdNum}&page=${page}&limit=${PAGE_SIZE}`).then((r) => r.data),
  })

  const createQ = useMutation({
    mutationFn: (d: { topicId: number; bodyText: string; options: { bodyText: string; isCorrect: boolean }[] }) =>
      api.post('/questions', d),
    onSuccess: () => { void qc.invalidateQueries({ queryKey: ['questions', topicIdNum] }); setShowAdd(false) },
  })

  const deleteQ = useMutation({
    mutationFn: (id: number) => api.delete(`/questions/${id}`),
    onSuccess: () => { void qc.invalidateQueries({ queryKey: ['questions', topicIdNum] }) },
  })

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setImporting(true)
    const form = new FormData()
    form.append('file', file)
    try {
      const res = await api.post<{ imported: number; failed: number; errors: string[] }>(
        `/questions/bulk-import?topicId=${topicIdNum}`,
        form,
        { headers: { 'Content-Type': 'multipart/form-data' } },
      )
      void qc.invalidateQueries({ queryKey: ['questions', topicIdNum] })
      alert(`Yuklandi: ${res.data.imported}, Xato: ${res.data.failed}`)
    } catch {
      alert('Import muvaffaqiyatsiz')
    } finally {
      setImporting(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  const total = data?.total ?? 0
  const totalPages = Math.ceil(total / PAGE_SIZE)

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link to="/content" className="text-gray-400 hover:text-gray-600">
            <ChevronLeft className="h-5 w-5" />
          </Link>
          <div>
            <h1 className="text-xl font-bold text-gray-900">Savollar</h1>
            <p className="text-sm text-gray-500">Mavzu #{topicId} — {total} ta savol</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <input ref={fileRef} type="file" accept=".xlsx,.csv" onChange={handleImport} className="hidden" />
          <button
            onClick={() => fileRef.current?.click()}
            disabled={importing}
            className="flex items-center gap-2 px-3 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50"
          >
            <Upload className="h-4 w-4" />
            {importing ? 'Yuklanmoqda...' : 'Import'}
          </button>
          <button
            onClick={() => setShowAdd(true)}
            className="flex items-center gap-2 px-3 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            <Plus className="h-4 w-4" /> Savol qo'shish
          </button>
        </div>
      </div>

      {/* Questions grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {data?.data.map((q) => (
          <QuestionCard
            key={q.id}
            q={q}
            onDelete={() => { if (confirm("O'chirishni tasdiqlaysizmi?")) deleteQ.mutate(q.id) }}
          />
        ))}
        {data?.data.length === 0 && (
          <div className="col-span-2 text-center py-12 text-gray-400">
            Savollar yo'q. Birinchi savolni qo'shing.
          </div>
        )}
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

      {showAdd && (
        <AddQuestionModal
          topicId={topicIdNum}
          onClose={() => setShowAdd(false)}
          onSave={(d) => createQ.mutate(d)}
        />
      )}
      {void topic}
    </div>
  )
}
