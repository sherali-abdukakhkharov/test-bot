import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
  arrayMove,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { api } from '@/lib/api'
import type { GuideItemDto } from '@arab-tili/shared-types'
import { GripVertical, Plus, Trash2, Edit2 } from 'lucide-react'

function SortableItem({ item, onEdit, onDelete }: {
  item: GuideItemDto
  onEdit: () => void
  onDelete: () => void
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: item.id })
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : 1 }

  return (
    <div ref={setNodeRef} style={style} className="flex items-center gap-3 bg-white border border-gray-200 rounded-xl px-4 py-3">
      <button {...attributes} {...listeners} className="text-gray-300 hover:text-gray-500 cursor-grab">
        <GripVertical className="h-4 w-4" />
      </button>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <span className={`text-xs px-2 py-0.5 rounded-full ${item.contentType === 'video' ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'}`}>
            {item.contentType === 'video' ? '🎥 Video' : '📝 Matn'}
          </span>
          {!item.isActive && <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">Yashirin</span>}
        </div>
        <p className="text-sm text-gray-700 truncate">{item.bodyText ?? item.mediaFileId ?? '—'}</p>
      </div>
      <div className="flex items-center gap-1">
        <button onClick={onEdit} className="p-1.5 text-gray-400 hover:text-blue-600"><Edit2 className="h-3.5 w-3.5" /></button>
        <button onClick={onDelete} className="p-1.5 text-gray-400 hover:text-red-500"><Trash2 className="h-3.5 w-3.5" /></button>
      </div>
    </div>
  )
}

function ItemModal({ item, onClose, onSave }: {
  item?: GuideItemDto | null
  onClose: () => void
  onSave: (d: { contentType: 'text' | 'video'; bodyText?: string; mediaFileId?: string; isActive: boolean }) => void
}) {
  const [type, setType] = useState<'text' | 'video'>(item?.contentType ?? 'text')
  const [body, setBody] = useState(item?.bodyText ?? '')
  const [fileId, setFileId] = useState(item?.mediaFileId ?? '')
  const [active, setActive] = useState(item?.isActive ?? true)

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-sm p-6 space-y-4">
        <h3 className="font-semibold">{item ? 'Tahrirlash' : "Qo'shish"}</h3>
        <div className="flex gap-2">
          {(['text', 'video'] as const).map((t) => (
            <button key={t} onClick={() => setType(t)}
              className={`flex-1 py-2 text-sm rounded-lg border ${type === t ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-gray-200 text-gray-600'}`}>
              {t === 'text' ? '📝 Matn' : '🎥 Video'}
            </button>
          ))}
        </div>
        {type === 'text' ? (
          <textarea value={body} onChange={(e) => setBody(e.target.value)} rows={4} placeholder="Matn kiriting..."
            className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none" />
        ) : (
          <input value={fileId} onChange={(e) => setFileId(e.target.value)} placeholder="Video file_id"
            className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
        )}
        <label className="flex items-center gap-2 text-sm text-gray-600">
          <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} className="accent-blue-600" />
          Faol
        </label>
        <div className="flex gap-2 justify-end">
          <button onClick={onClose} className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg">Bekor</button>
          <button onClick={() => onSave({ contentType: type, bodyText: body || undefined, mediaFileId: fileId || undefined, isActive: active })}
            className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700">Saqlash</button>
        </div>
      </div>
    </div>
  )
}

export default function GuidePage() {
  const qc = useQueryClient()
  const [localOrder, setLocalOrder] = useState<number[] | null>(null)
  const [modal, setModal] = useState<{ mode: 'add' | 'edit'; item?: GuideItemDto } | null>(null)

  const { data: serverItems = [] } = useQuery<GuideItemDto[]>({
    queryKey: ['guide'],
    queryFn: () => api.get<GuideItemDto[]>('/guide').then((r) => r.data),
  })

  // Apply local sort order on top of server data
  const displayItems: GuideItemDto[] = localOrder
    ? localOrder.map((id) => serverItems.find((i) => i.id === id)!).filter(Boolean)
    : serverItems

  const createItem = useMutation({
    mutationFn: (d: Partial<GuideItemDto>) => api.post('/guide', d),
    onSuccess: () => { void qc.invalidateQueries({ queryKey: ['guide'] }); setModal(null) },
  })
  const updateItem = useMutation({
    mutationFn: ({ id, ...d }: Partial<GuideItemDto> & { id: number }) => api.patch(`/guide/${id}`, d),
    onSuccess: () => { void qc.invalidateQueries({ queryKey: ['guide'] }); setModal(null) },
  })
  const deleteItem = useMutation({
    mutationFn: (id: number) => api.delete(`/guide/${id}`),
    onSuccess: () => { void qc.invalidateQueries({ queryKey: ['guide'] }); setLocalOrder(null) },
  })
  const reorderItems = useMutation({
    mutationFn: (list: { id: number; sortOrder: number }[]) => api.patch('/guide/reorder', list),
  })

  const sensors = useSensors(useSensor(PointerSensor))

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event
    if (!over || active.id === over.id) return
    const oldIdx = displayItems.findIndex((i) => i.id === active.id)
    const newIdx = displayItems.findIndex((i) => i.id === over.id)
    const reordered = arrayMove(displayItems, oldIdx, newIdx)
    setLocalOrder(reordered.map((i) => i.id))
    reorderItems.mutate(reordered.map((item, idx) => ({ id: item.id, sortOrder: idx })))
  }

  return (
    <div className="space-y-4 max-w-2xl">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Qo'llanma ({displayItems.length}/20)</h1>
        <button
          onClick={() => setModal({ mode: 'add' })}
          className="flex items-center gap-2 px-3 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          <Plus className="h-4 w-4" /> Qo'shish
        </button>
      </div>

      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={displayItems.map((i) => i.id)} strategy={verticalListSortingStrategy}>
          <div className="space-y-2">
            {displayItems.map((item) => (
              <SortableItem
                key={item.id}
                item={item}
                onEdit={() => setModal({ mode: 'edit', item })}
                onDelete={() => { if (confirm("O'chirishni tasdiqlaysizmi?")) deleteItem.mutate(item.id) }}
              />
            ))}
            {displayItems.length === 0 && (
              <p className="text-center py-8 text-gray-400 text-sm">Elementlar yo'q</p>
            )}
          </div>
        </SortableContext>
      </DndContext>

      {modal && (
        <ItemModal
          item={modal.item}
          onClose={() => setModal(null)}
          onSave={(d) => {
            if (modal.mode === 'edit' && modal.item) updateItem.mutate({ id: modal.item.id, ...d })
            else createItem.mutate(d)
          }}
        />
      )}
    </div>
  )
}
