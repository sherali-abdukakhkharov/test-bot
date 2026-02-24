import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { api } from '@/lib/api'
import type { SectionTreeNode, TopicDto } from '@arab-tili/shared-types'
import { ChevronRight, ChevronDown, Plus, Edit2, Trash2, BookOpen } from 'lucide-react'

// ─── Section Tree ─────────────────────────────────────────────────────────────

function SectionNode({
  node,
  selectedId,
  onSelect,
  onEdit,
  onDelete,
}: {
  node: SectionTreeNode
  selectedId: number | null
  onSelect: (id: number) => void
  onEdit: (node: SectionTreeNode) => void
  onDelete: (id: number) => void
}) {
  const [open, setOpen] = useState(true)
  const hasChildren = node.children.length > 0

  return (
    <div>
      <div
        className={`flex items-center gap-1 px-2 py-1.5 rounded-lg cursor-pointer group ${
          selectedId === node.id ? 'bg-blue-50 text-blue-700' : 'hover:bg-gray-50'
        }`}
        onClick={() => onSelect(node.id)}
      >
        <button
          onClick={(e) => { e.stopPropagation(); setOpen(!open) }}
          className="w-4 h-4 flex items-center justify-center text-gray-400"
        >
          {hasChildren ? (open ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />) : null}
        </button>
        <span className="flex-1 text-sm truncate">{node.title}</span>
        <div className="hidden group-hover:flex items-center gap-1">
          <button onClick={(e) => { e.stopPropagation(); onEdit(node) }} className="p-1 hover:text-blue-600">
            <Edit2 className="h-3 w-3" />
          </button>
          <button onClick={(e) => { e.stopPropagation(); onDelete(node.id) }} className="p-1 hover:text-red-600">
            <Trash2 className="h-3 w-3" />
          </button>
        </div>
      </div>
      {open && hasChildren && (
        <div className="ml-4">
          {node.children.map((child) => (
            <SectionNode
              key={child.id}
              node={child}
              selectedId={selectedId}
              onSelect={onSelect}
              onEdit={onEdit}
              onDelete={onDelete}
            />
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Section Form Modal ───────────────────────────────────────────────────────

function SectionModal({
  initial,
  parentId,
  onClose,
  onSave,
}: {
  initial?: SectionTreeNode | null
  parentId?: number | null
  onClose: () => void
  onSave: (data: { title: string; parentId?: number | null }) => void
}) {
  const [title, setTitle] = useState(initial?.title ?? '')

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-sm p-6 space-y-4">
        <h3 className="font-semibold text-gray-900">
          {initial ? 'Bo\'lim tahrirlash' : "Bo'lim qo'shish"}
        </h3>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Bo'lim nomi"
          className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          autoFocus
        />
        <div className="flex gap-2 justify-end">
          <button onClick={onClose} className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg">
            Bekor
          </button>
          <button
            onClick={() => { if (title.trim()) onSave({ title: title.trim(), parentId }) }}
            className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            Saqlash
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Topic Form Modal ─────────────────────────────────────────────────────────

function TopicModal({
  initial,
  sectionId,
  onClose,
  onSave,
}: {
  initial?: TopicDto | null
  sectionId: number
  onClose: () => void
  onSave: (data: Partial<TopicDto> & { sectionId: number }) => void
}) {
  const [title, setTitle] = useState(initial?.title ?? '')
  const [timePerQ, setTimePerQ] = useState(initial?.timePerQuestionSec ?? 30)
  const [opts, setOpts] = useState(initial?.optionsCount ?? 4)
  const [limit, setLimit] = useState(initial?.dailyAttemptLimit ?? 3)

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-sm p-6 space-y-4">
        <h3 className="font-semibold text-gray-900">
          {initial ? 'Mavzu tahrirlash' : "Mavzu qo'shish"}
        </h3>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Mavzu nomi"
          className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          autoFocus
        />
        <div className="grid grid-cols-3 gap-2">
          <div>
            <label className="text-xs text-gray-500">Vaqt (s)</label>
            <select value={timePerQ} onChange={(e) => setTimePerQ(Number(e.target.value))}
              className="w-full border rounded-lg px-2 py-1.5 text-sm mt-1">
              {[5,10,15,20,25,30,45,60].map((v) => <option key={v}>{v}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs text-gray-500">Variantlar</label>
            <select value={opts} onChange={(e) => setOpts(Number(e.target.value))}
              className="w-full border rounded-lg px-2 py-1.5 text-sm mt-1">
              <option>3</option><option>4</option>
            </select>
          </div>
          <div>
            <label className="text-xs text-gray-500">Kun limiti</label>
            <input type="number" min={1} value={limit} onChange={(e) => setLimit(Number(e.target.value))}
              className="w-full border rounded-lg px-2 py-1.5 text-sm mt-1" />
          </div>
        </div>
        <div className="flex gap-2 justify-end">
          <button onClick={onClose} className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg">
            Bekor
          </button>
          <button
            onClick={() => { if (title.trim()) onSave({ title: title.trim(), sectionId, timePerQuestionSec: timePerQ, optionsCount: opts, dailyAttemptLimit: limit }) }}
            className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            Saqlash
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function ContentPage() {
  const qc = useQueryClient()
  const [selectedSection, setSelectedSection] = useState<number | null>(null)
  const [sectionModal, setSectionModal] = useState<{ mode: 'add' | 'edit'; node?: SectionTreeNode; parentId?: number } | null>(null)
  const [topicModal, setTopicModal] = useState<{ mode: 'add' | 'edit'; topic?: TopicDto } | null>(null)

  const { data: tree = [] } = useQuery<SectionTreeNode[]>({
    queryKey: ['sections-tree'],
    queryFn: () => api.get('/sections/tree').then((r) => r.data),
  })

  const { data: topics = [] } = useQuery<TopicDto[]>({
    queryKey: ['topics', selectedSection],
    queryFn: () => api.get(`/topics?sectionId=${selectedSection}`).then((r) => r.data),
    enabled: !!selectedSection,
  })

  const createSection = useMutation({
    mutationFn: (d: { title: string; parentId?: number | null }) => api.post('/sections', d),
    onSuccess: () => { void qc.invalidateQueries({ queryKey: ['sections-tree'] }); setSectionModal(null) },
  })
  const updateSection = useMutation({
    mutationFn: ({ id, ...d }: { id: number; title: string }) => api.patch(`/sections/${id}`, d),
    onSuccess: () => { void qc.invalidateQueries({ queryKey: ['sections-tree'] }); setSectionModal(null) },
  })
  const deleteSection = useMutation({
    mutationFn: (id: number) => api.delete(`/sections/${id}`),
    onSuccess: () => { void qc.invalidateQueries({ queryKey: ['sections-tree'] }); if (selectedSection) setSelectedSection(null) },
  })
  const createTopic = useMutation({
    mutationFn: (d: Partial<TopicDto> & { sectionId: number }) => api.post('/topics', d),
    onSuccess: () => { void qc.invalidateQueries({ queryKey: ['topics', selectedSection] }); setTopicModal(null) },
  })
  const updateTopic = useMutation({
    mutationFn: ({ id, ...d }: Partial<TopicDto> & { id: number }) => api.patch(`/topics/${id}`, d),
    onSuccess: () => { void qc.invalidateQueries({ queryKey: ['topics', selectedSection] }); setTopicModal(null) },
  })
  const deleteTopic = useMutation({
    mutationFn: (id: number) => api.delete(`/topics/${id}`),
    onSuccess: () => { void qc.invalidateQueries({ queryKey: ['topics', selectedSection] }) },
  })

  return (
    <div className="flex gap-6 h-full">
      {/* Section tree */}
      <div className="w-72 bg-white rounded-xl border border-gray-200 flex flex-col">
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
          <h2 className="font-semibold text-gray-900 text-sm">Bo'limlar</h2>
          <button
            onClick={() => setSectionModal({ mode: 'add' })}
            className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700"
          >
            <Plus className="h-3 w-3" /> Qo'shish
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-2">
          {tree.map((node) => (
            <SectionNode
              key={node.id}
              node={node}
              selectedId={selectedSection}
              onSelect={setSelectedSection}
              onEdit={(n) => setSectionModal({ mode: 'edit', node: n })}
              onDelete={(id) => { if (confirm("O'chirishni tasdiqlaysizmi?")) deleteSection.mutate(id) }}
            />
          ))}
        </div>
      </div>

      {/* Topics table */}
      <div className="flex-1 bg-white rounded-xl border border-gray-200 flex flex-col">
        <div className="flex items-center justify-between px-6 py-3 border-b border-gray-100">
          <h2 className="font-semibold text-gray-900 text-sm">
            {selectedSection ? 'Mavzular' : "Bo'lim tanlang"}
          </h2>
          {selectedSection && (
            <button
              onClick={() => setTopicModal({ mode: 'add' })}
              className="flex items-center gap-1 text-xs bg-blue-600 text-white px-3 py-1.5 rounded-lg hover:bg-blue-700"
            >
              <Plus className="h-3 w-3" /> Mavzu qo'shish
            </button>
          )}
        </div>
        {!selectedSection && (
          <div className="flex-1 flex items-center justify-center text-gray-400 text-sm">
            Chap tomondagi ro'yxatdan bo'lim tanlang
          </div>
        )}
        {selectedSection && (
          <div className="flex-1 overflow-y-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-xs text-gray-500 uppercase">
                <tr>
                  <th className="px-6 py-3 text-left">Nomi</th>
                  <th className="px-4 py-3 text-center">Savollar</th>
                  <th className="px-4 py-3 text-center">Vaqt</th>
                  <th className="px-4 py-3 text-center">Limit</th>
                  <th className="px-4 py-3 text-right">Amallar</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {topics.map((t) => (
                  <tr key={t.id} className="hover:bg-gray-50">
                    <td className="px-6 py-3 font-medium text-gray-900">{t.title}</td>
                    <td className="px-4 py-3 text-center text-gray-600">{t.questionCount ?? 0}</td>
                    <td className="px-4 py-3 text-center text-gray-600">{t.timePerQuestionSec}s</td>
                    <td className="px-4 py-3 text-center text-gray-600">{t.dailyAttemptLimit}/kun</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-2">
                        <Link to={`/questions/${t.id}`} className="text-xs text-blue-600 hover:underline flex items-center gap-1">
                          <BookOpen className="h-3 w-3" /> Savollar
                        </Link>
                        <button onClick={() => setTopicModal({ mode: 'edit', topic: t })} className="text-gray-400 hover:text-blue-600">
                          <Edit2 className="h-3.5 w-3.5" />
                        </button>
                        <button onClick={() => { if (confirm("O'chirishni tasdiqlaysizmi?")) deleteTopic.mutate(t.id) }} className="text-gray-400 hover:text-red-600">
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {topics.length === 0 && (
                  <tr><td colSpan={5} className="px-6 py-8 text-center text-gray-400">Mavzular yo'q</td></tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Section modal */}
      {sectionModal && (
        <SectionModal
          initial={sectionModal.node}
          parentId={sectionModal.parentId}
          onClose={() => setSectionModal(null)}
          onSave={(d) => {
            if (sectionModal.mode === 'edit' && sectionModal.node) {
              updateSection.mutate({ id: sectionModal.node.id, title: d.title })
            } else {
              createSection.mutate(d)
            }
          }}
        />
      )}

      {/* Topic modal */}
      {topicModal && selectedSection && (
        <TopicModal
          initial={topicModal.topic}
          sectionId={selectedSection}
          onClose={() => setTopicModal(null)}
          onSave={(d) => {
            if (topicModal.mode === 'edit' && topicModal.topic) {
              updateTopic.mutate({ id: topicModal.topic.id, ...d })
            } else {
              createTopic.mutate(d)
            }
          }}
        />
      )}
    </div>
  )
}
