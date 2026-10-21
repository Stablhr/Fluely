'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd'
import type { DropResult } from '@hello-pangea/dnd'
import { useStore } from '@/lib/kali/store/useStore'
import { useBoardPoll } from '@/lib/kali/realtime/useBoardPoll'
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
import { beginDragCursor, endDragCursor } from '@/lib/kali/utils/dragCursor'

export type BoardViewType = 'board' | 'table' | 'calendar' | 'timeline' | 'map'

const EMPTY_FILTER: BoardFilter = { labelIds: [], memberIds: [] }

export default function BoardView() {
  const params = useParams<{ boardId?: string | string[] }>()
  const rawBoardId = params.boardId
  const boardId = Array.isArray(rawBoardId) ? (rawBoardId[0] ?? '') : (rawBoardId ?? '')
  const store = useStore()
  // Destructured so the effect below can depend on the function alone. The
  // `store` object itself is new on every render; depending on it would fetch
  // the board structure forever.
  const { syncBoardStructure, loadCollaborators } = store
  const board = store.data.boards[boardId]
  const [search, setSearch] = useState('')
  const [openCardId, setOpenCardId] = useState<string | null>(null)
  const [menuOpen, setMenuOpen] = useState(false)
  const [viewsOpen, setViewsOpen] = useState(false)
  const [filterOpen, setFilterOpen] = useState(false)
  const [filter, setFilter] = useState<BoardFilter>(EMPTY_FILTER)
  const [activeView, setActiveView] = useState<BoardViewType>('board')
  // A boolean rather than `board` itself: merges hand back a fresh board
  // object every sync, and depending on it would refetch forever. This flips
  // once when the board appears -- right after sign-in, when the boards query
  // resolves -- which is exactly when a pull is needed.
  const hasBoard = Boolean(board)
  const hasServerBoard = Boolean(board?.ownerId && board.revision !== null)

  // Live sync is only for boards with a server row behind them: a local-only
  // board has no channel to join, and the public-board page is a different
  // component entirely — anonymous viewers keep the static snapshot.
  useBoardPoll(boardId, Boolean(board?.ownerId && board.revision !== null), board?.revision ?? 0)

  useEffect(() => {
    if (!hasBoard) return
    void syncBoardStructure(boardId)
  }, [boardId, hasBoard, syncBoardStructure])

  // Cards store assignee ids, so the board needs the roster to draw avatars.
  // Loaded once per board open; the poll keeps the structure itself current.
  useEffect(() => {
    if (!hasServerBoard) return
    void loadCollaborators(boardId)
  }, [boardId, hasServerBoard, loadCollaborators])

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
  const mayWrite = store.canWrite(boardId)

  const onDragEnd = (result: DropResult) => {
    endDragCursor()
    if (!mayWrite) return
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
        <DragDropContext onDragStart={beginDragCursor} onDragEnd={onDragEnd}>
          <Droppable droppableId="board-lists" type="LIST" direction="horizontal">
            {(provided) => (
              <div
                ref={provided.innerRef}
                {...provided.droppableProps}
                className="scroll-slim flex h-full items-stretch gap-3 overflow-x-auto bg-board-canvas p-4"
              >
                {lists.map((list, index) => (
                  <Draggable key={list.id} draggableId={list.id} index={index} isDragDisabled={!mayWrite}>
                    {(listProvided) => (
                      <div ref={listProvided.innerRef} {...listProvided.draggableProps} className="flex h-full min-h-0">
                        <ListColumn
                          list={list}
                          dragHandleProps={mayWrite ? listProvided.dragHandleProps : null}
                          search={search}
                          filter={filter}
                          onOpenCard={setOpenCardId}
                        />
                      </div>
                    )}
                  </Draggable>
                ))}
                {provided.placeholder}
                {mayWrite && (
                  <div className="self-start">
                    <AddListForm boardId={boardId} />
                  </div>
                )}
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
