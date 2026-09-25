'use client'

import { useState } from 'react'
import { X, Plus, Trash2 } from 'lucide-react'
import type { Board } from '@/lib/kali/store/schema'
import { LABEL_SWATCHES } from '@/lib/kali/store/schema'
import { useStore } from '@/lib/kali/store/useStore'
import Modal from '../shared/Modal'

export default function LabelsModal({ board, onClose }: { board: Board; onClose: () => void }) {
  const { addLabel, updateLabel, deleteLabel } = useStore()
  const [newName, setNewName] = useState('')
  const [newColor, setNewColor] = useState<string>(LABEL_SWATCHES[0].color)

  const labels = Object.values(board.labels ?? {})

  const add = () => {
    const name = newName.trim()
    if (!name) return
    addLabel(board.id, name, newColor)
    setNewName('')
  }

  const inputClass =
    'w-full rounded-md border border-border-strong bg-surface px-2 py-1.5 text-sm text-text-primary outline-none transition-colors duration-150 placeholder:text-text-muted focus:border-primary focus:ring-2 focus:ring-primary/20'

  return (
    <Modal open onClose={onClose} className="max-w-md">
      <div className="p-6">
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-[17px] font-semibold text-text-primary">Labels</h2>
            <p className="mt-0.5 text-sm text-text-secondary">{board.name}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close labels"
            className="rounded-md p-1.5 text-text-secondary transition-colors duration-150 hover:bg-surface-alt hover:text-text-primary"
          >
            <X size={16} />
          </button>
        </div>

        <div className="mt-5 space-y-2">
          {labels.length === 0 && (
            <p className="rounded-md bg-surface-alt px-3 py-2.5 text-xs text-text-secondary">
              No labels yet — add your first one below.
            </p>
          )}
          {labels.map((label) => (
            <div key={label.id} className="flex items-center gap-2">
              <select
                value={label.color}
                onChange={(e) => updateLabel(board.id, label.id, { color: e.target.value })}
                title="Label color"
                className="h-8 w-10 shrink-0 cursor-pointer rounded-lg px-0 text-transparent"
                style={{ background: label.color }}
              >
                {LABEL_SWATCHES.map((s) => (
                  <option key={s.color} value={s.color}>
                    {s.name}
                  </option>
                ))}
              </select>
              <input
                value={label.name}
                onChange={(e) => updateLabel(board.id, label.id, { name: e.target.value })}
                className={inputClass}
              />
              <button
                type="button"
                onClick={() => {
                  if (window.confirm(`Delete the "${label.name}" label?`)) deleteLabel(board.id, label.id)
                }}
                title="Delete label"
                className="shrink-0 rounded-md p-1.5 text-text-secondary transition-colors duration-150 hover:bg-danger-subtle hover:text-danger-text"
              >
                <Trash2 size={14} />
              </button>
            </div>
          ))}
        </div>

        <div className="mt-5 border-t border-border pt-4">
          <p className="text-[11px] font-semibold uppercase tracking-[0.05em] text-text-secondary">
            Add a label
          </p>
          <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:items-end">
            <div className="flex-1">
              <input
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && add()}
                placeholder="Label name"
                className={`w-full ${inputClass}`}
              />
            </div>
            <div className="flex flex-wrap gap-1 sm:flex-nowrap sm:gap-1">
              {LABEL_SWATCHES.map((s) => (
                <button
                  key={s.color}
                  type="button"
                  title={s.name}
                  onClick={() => setNewColor(s.color)}
                  className={`h-6 w-6 rounded-md transition-shadow duration-150 ${
                    newColor === s.color ? 'ring-2 ring-ink ring-offset-1 ring-offset-surface' : 'ring-1 ring-border-strong'
                  }`}
                  style={{ background: s.color }}
                />
              ))}
            </div>
            <button
              type="button"
              onClick={add}
              disabled={!newName.trim()}
              className="flex h-9 items-center gap-1 rounded-md bg-primary px-3 text-sm font-semibold text-primary-foreground transition-colors duration-150 hover:bg-primary-hover active:scale-[0.98] disabled:pointer-events-none disabled:opacity-40"
            >
              <Plus size={14} />
              Add
            </button>
          </div>
        </div>
      </div>
    </Modal>
  )
}
