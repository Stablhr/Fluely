'use client'

import { X, Download, Printer } from 'lucide-react'
import type { Board } from '@/lib/kali/store/schema'
import { useStore } from '@/lib/kali/store/useStore'
import Modal from '../shared/Modal'

export default function ExportPrintModal({ board, onClose }: { board: Board; onClose: () => void }) {
  const { data } = useStore()

  const exportJSON = () => {
    const boardCards = Object.values(data.cards).filter((c) => c.boardId === board.id)
    const boardLists = board.listOrder.map((id) => data.lists[id]).filter(Boolean)
    const exportData = {
      board: { ...board, listOrder: undefined, labels: undefined, archivedLists: undefined, activity: undefined },
      lists: boardLists,
      cards: boardCards,
      labels: board.labels,
    }
    const json = JSON.stringify(exportData, null, 2)
    const blob = new Blob([json], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${board.name.toLowerCase().replace(/\s+/g, '-')}-board.json`
    a.click()
    URL.revokeObjectURL(url)
    onClose()
  }

  const printBoard = () => {
    onClose()
    setTimeout(() => window.print(), 100)
  }

  const menuItem =
    'flex w-full items-center gap-3 rounded-md px-3 py-2.5 text-left text-sm font-medium text-text-primary transition-colors duration-150 hover:bg-surface-alt'

  return (
    <Modal open onClose={onClose} className="max-w-sm">
      <div className="flex items-center justify-between px-5 pt-5">
        <h2 className="text-[17px] font-semibold text-text-primary">Print, export, and share</h2>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="rounded-md p-1.5 text-text-secondary transition-colors duration-150 hover:bg-surface-alt hover:text-text-primary"
        >
          <X size={16} />
        </button>
      </div>
      <div className="p-5 space-y-1">
        <button type="button" className={menuItem} onClick={exportJSON}>
          <Download size={16} className="text-text-secondary" />
          <div className="min-w-0 flex-1">
            <p className="font-medium">Export as JSON</p>
            <p className="text-xs text-text-muted">Download board data as a .json file</p>
          </div>
        </button>
        <button type="button" className={menuItem} onClick={printBoard}>
          <Printer size={16} className="text-text-secondary" />
          <div className="min-w-0 flex-1">
            <p className="font-medium">Print board</p>
            <p className="text-xs text-text-muted">Print a clean, readable layout</p>
          </div>
        </button>
      </div>
    </Modal>
  )
}
