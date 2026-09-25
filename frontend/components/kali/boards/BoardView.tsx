'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd'
import type { DropResult } from '@hello-pangea/dnd'
import { useStore } from '@/lib/kali/store/useStore'
import BoardTopBar from './BoardTopBar'
import ListColumn from './ListColumn'
import TableView from './TableView'
import CalendarView from './CalendarView'
import TimelineView from './TimelineView'
import MapView from './MapView'
import AddListForm from './AddListForm'
import CardModal from '../card-modal/CardModal'
import BoardMenuDrawer from './BoardMenuDrawer'
import type { BoardFilter } from './FilterPanel'

export type BoardViewType = 'board' | 'table' | 'calendar' | 'timeline' | 'map'

const EMPTY_FILTER: BoardFilter = { labelIds: [], memberIds: [] }

export default function BoardView() {
  const params = useParams<{ boardId?: string | string[] }>()
  const rawBoardId = params.boardId
  const boardId = Array.isArray(rawBoardId) ? (rawBoardId[0] ?? '') : (rawBoardId ?? '')
  const store = useStore()
  const board = store.data.boards[boardId]
  const [search, setSearch] = useState('')
  const [openCardId, setOpenCardId] = useState<string | null>(null)
  const [menuOpen, setMenuOpen] = useState(false)
  const [viewsOpen, setViewsOpen] = useState(false)
  const [filterOpen, setFilterOpen] = useState(false)
  const [filter, setFilter] = useState<BoardFilter>(EMPTY_FILTER)
  const [activeView, setActiveView] = useState<BoardViewType>('board')

  if (!board) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-2 p-8">
        <p className="text-sm text-text-secondary">This board doesn&apos;t exist.</p>
        <Link href="/boards" className="text-sm font-semibold text-primary-hover hover:underline">
          Back to boards
        </Link>
      </div>
    )
  }

  const lists = store.getLists(boardId)

  const onDragEnd = (result: DropResult) => {
    const { source, destination, type } = result
    if (!destination) return
    if (source.droppableId === destination.droppableId && source.index === destination.index) return
    if (type === 'LIST') {
      store.moveList(boardId, source.index, destination.index)
    } else {
      store.moveCard(result.draggableId, destination.droppableId, destination.index)
    }
  }

  return (
    <div className="flex h-full flex-col">
      <BoardTopBar
        board={board}
        search={search}
        onSearch={setSearch}
        viewsOpen={viewsOpen}
        filterOpen={filterOpen}
        filter={filter}
        activeView={activeView}
        onOpenViews={() => setViewsOpen((o) => !o)}
        onViewChange={setActiveView}
        onOpenFilter={() => setFilterOpen((o) => !o)}
        onFilterChange={setFilter}
        onOpenMenu={() => setMenuOpen(true)}
      />

      {activeView === 'board' && (
        <DragDropContext onDragEnd={onDragEnd}>
          <Droppable droppableId="board-lists" type="LIST" direction="horizontal">
            {(provided) => (
              <div
                ref={provided.innerRef}
                {...provided.droppableProps}
                className="scroll-slim flex h-full items-start gap-3 overflow-x-auto bg-board-canvas p-4"
              >
                {lists.map((list, index) => (
                  <Draggable key={list.id} draggableId={list.id} index={index}>
                    {(listProvided) => (
                      <div ref={listProvided.innerRef} {...listProvided.draggableProps}>
                        <ListColumn
                          list={list}
                          dragHandleProps={listProvided.dragHandleProps}
                          search={search}
                          filter={filter}
                          onOpenCard={setOpenCardId}
                        />
                      </div>
                    )}
                  </Draggable>
                ))}
                {provided.placeholder}
                <AddListForm boardId={boardId} />
              </div>
            )}
          </Droppable>
        </DragDropContext>
      )}

      {activeView === 'table' && (
        <div className="h-full overflow-hidden">
          <TableView boardId={boardId} search={search} filter={filter} onOpenCard={setOpenCardId} />
        </div>
      )}

      {activeView === 'calendar' && (
        <CalendarView boardId={boardId} search={search} filter={filter} onOpenCard={setOpenCardId} />
      )}

      {activeView === 'timeline' && (
        <TimelineView boardId={boardId} search={search} filter={filter} onOpenCard={setOpenCardId} />
      )}

      {activeView === 'map' && (
        <MapView boardId={boardId} search={search} filter={filter} onOpenCard={setOpenCardId} />
      )}

      {openCardId && <CardModal cardId={openCardId} onClose={() => setOpenCardId(null)} />}
      <BoardMenuDrawer board={board} open={menuOpen} onClose={() => setMenuOpen(false)} />
    </div>
  )
}
