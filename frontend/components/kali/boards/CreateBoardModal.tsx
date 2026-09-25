'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Check, X } from 'lucide-react'
import { BOARD_TEMPLATES } from '@/lib/kali/store/schema'
import { useStore } from '@/lib/kali/store/useStore'
import Modal from '../shared/Modal'

interface CreateBoardModalProps {
  open: boolean
  onClose: () => void
}

export default function CreateBoardModal({ open, onClose }: CreateBoardModalProps) {
  const { createBoard } = useStore()
  const router = useRouter()
  const [selected, setSelected] = useState(BOARD_TEMPLATES[0].id)
  const [name, setName] = useState('')

  const template = BOARD_TEMPLATES.find((t) => t.id === selected) ?? BOARD_TEMPLATES[0]

  const submit = () => {
    const boardName = name.trim() || template.name
    const boardId = createBoard(template.id, boardName)
    setName('')
    onClose()
    router.push(`/boards/${boardId}`)
  }

  return (
    <Modal open={open} onClose={onClose} className="max-w-md">
      <div className="flex items-center justify-between px-6 pt-5">
        <h2 className="text-[17px] font-semibold text-text-primary">Create board</h2>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close create board"
          className="rounded-md p-1.5 text-text-secondary transition-colors duration-150 hover:bg-surface-alt hover:text-text-primary"
        >
          <X size={18} />
        </button>
      </div>

      <div className="scroll-slim max-h-[50vh] overflow-y-auto px-6 py-4">
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {BOARD_TEMPLATES.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => {
                setSelected(t.id)
                setName('')
              }}
              aria-pressed={selected === t.id}
              className={`relative rounded-lg p-2 text-left ring-1 transition-colors duration-150 ${
                selected === t.id
                  ? 'ring-2 ring-primary bg-primary-subtle/40 dark:bg-primary-subtle'
                  : 'ring-border-strong hover:bg-surface-alt'
              }`}
            >
              <span
                className="block h-9 rounded-md"
                style={{ background: t.swatch }}
              />
              <span className="mt-1.5 block truncate text-xs font-semibold text-text-primary">{t.name}</span>
              {selected === t.id && (
                <span className="absolute right-1.5 top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-primary text-primary-foreground">
                  <Check size={12} />
                </span>
              )}
            </button>
          ))}
        </div>

        <p className="mt-3 text-xs leading-relaxed text-text-secondary">{template.description}</p>

        <div className="mt-4">
          <label htmlFor="board-title" className="text-[11px] font-semibold uppercase tracking-[0.05em] text-text-secondary">
            Board title
          </label>
          <input
            id="board-title"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && submit()}
            placeholder={template.name}
            autoFocus
            className="mt-1.5 w-full rounded-md border border-border-strong bg-surface px-3 py-2 text-sm text-text-primary outline-none transition-colors duration-150 placeholder:text-text-muted focus:border-primary focus:ring-2 focus:ring-primary/20"
          />
        </div>
      </div>

      <div className="flex justify-end gap-2 px-6 pb-5">
        <button
          type="button"
          onClick={onClose}
          className="rounded-md px-3.5 py-2 text-sm font-medium text-text-secondary transition-colors duration-150 hover:bg-surface-alt hover:text-text-primary"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={submit}
          className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition-colors duration-150 hover:bg-primary-hover active:scale-[0.98]"
        >
          Create
        </button>
      </div>
    </Modal>
  )
}
