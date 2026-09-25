'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import type { AppData, Board, Card, List, Label, Share, SocialPost, SocialPostPlatform, SocialMediaAttachment, SocialAnalytics, Platform, ThemeMode } from './schema'
import { BOARD_TEMPLATES, emptyData } from './schema'
import { clearData, loadData, saveData } from './storage'
import { StoreContext } from './useStore'
import type { Store } from './useStore'
import { uid } from '@/lib/kali/utils/id'
import { formatDate } from '@/lib/kali/utils/dates'
import { useSocialPosts } from '@/lib/kali/feature-hooks/useSocialPosts'

function patchRecord<T extends { id: string }>(
  rec: Record<string, T>,
  id: string,
  patch: Partial<T>,
): Record<string, T> {
  const item = rec[id]
  if (!item) return rec
  return { ...rec, [id]: { ...item, ...patch } }
}

const now = () => new Date().toISOString()

function makeCard(list: List, title: string, extra: Partial<Card> = {}): Card {
  return {
    id: uid(),
    boardId: list.boardId,
    listId: list.id,
    title,
    desc: '',
    cover: null,
    coverSize: 'small',
    labelIds: [],
    memberIds: [],
    dueDate: null,
    startDate: null,
    location: '',
    watching: false,
    archived: false,
    done: false,
    files: [],
    comments: [],
    activity: [],
    createdAt: now(),
    updatedAt: now(),
    ...extra,
  }
}

function withCardAdded(prev: AppData, card: Card): AppData {
  const list = prev.lists[card.listId]
  if (!list) return prev
  const board = prev.boards[card.boardId]
  return {
    ...prev,
    cards: { ...prev.cards, [card.id]: card },
    lists: { ...prev.lists, [card.listId]: { ...list, cardOrder: [...list.cardOrder, card.id] } },
    boards: board ? { ...prev.boards, [board.id]: { ...board, updatedAt: now() } } : prev.boards,
  }
}

export function StoreProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<AppData>(() => loadData())
  const [error, setError] = useState<string | null>(null)
  const dataRef = useRef(data)

  useEffect(() => {
    dataRef.current = data
  }, [data])

  // Social posts: API-first with localStorage fallback
  const social = useSocialPosts()

  useEffect(() => {
    const timer = window.setTimeout(() => {
      try {
        saveData(dataRef.current)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Could not save your changes.')
      }
    }, 400)
    return () => window.clearTimeout(timer)
  }, [data])

  useEffect(() => {
    const flush = () => {
      try {
        saveData(dataRef.current)
      } catch {
        // best effort on unload
      }
    }
    window.addEventListener('beforeunload', flush)
    return () => window.removeEventListener('beforeunload', flush)
  }, [])

  const dismissError = () => setError(null)

  const mutate = (fn: (draft: AppData) => AppData) => setData(fn)

  const getBoard = (id: string) => data.boards[id]
  const getCard = (id: string) => data.cards[id]

  const getLists = (boardId: string): List[] => {
    const board = data.boards[boardId]
    if (!board) return []
    return board.listOrder.map((id) => data.lists[id]).filter(Boolean)
  }

  const getCards = (listId: string): Card[] => {
    const list = data.lists[listId]
    if (!list) return []
    return list.cardOrder.map((id) => data.cards[id]).filter(Boolean)
  }

  const createBoard = (templateId: string, name: string): string => {
    const template = BOARD_TEMPLATES.find((t) => t.id === templateId) ?? BOARD_TEMPLATES[0]
    const boardId = uid()
    const labels: Record<string, Label> = {}
    template.labels.forEach((l) => {
      const id = uid()
      labels[id] = { id, name: l.name, color: l.color }
    })
    const lists: Record<string, List> = {}
    const listOrder: string[] = []
    template.lists.forEach((listName, order) => {
      const id = uid()
      lists[id] = { id, boardId, name: listName, assignee: '', collapsed: false, order, cardOrder: [], backgroundColor: '' }
      listOrder.push(id)
    })
    const board: Board = {
      id: boardId,
      name,
      description: template.description,
      visibility: 'private',
      starred: false,
      background: template.swatch,
      createdAt: now(),
      updatedAt: now(),
      listOrder,
      labels,
      shares: [],
      settings: { commentPermission: 'members', selfJoin: false },
      activity: [],
      archivedLists: [],
    }
    mutate((prev) => ({
      ...prev,
      boards: { ...prev.boards, [boardId]: board },
      lists: { ...prev.lists, ...lists },
      ui: { ...prev.ui, lastVisitedBoardId: boardId },
    }))
    return boardId
  }

  const deleteBoard = (id: string) => {
    mutate((prev) => {
      const board = prev.boards[id]
      if (!board) return prev
      const listIds = new Set(board.listOrder)
      const lists: Record<string, List> = {}
      for (const [k, v] of Object.entries(prev.lists)) {
        if (!listIds.has(k)) lists[k] = v
      }
      const cards: Record<string, Card> = {}
      for (const [k, v] of Object.entries(prev.cards)) {
        if (!listIds.has(v.listId)) cards[k] = v
      }
      const boards = { ...prev.boards }
      delete boards[id]
      return {
        ...prev,
        boards,
        lists,
        cards,
        ui: {
          ...prev.ui,
          lastVisitedBoardId: prev.ui.lastVisitedBoardId === id ? null : prev.ui.lastVisitedBoardId,
        },
      }
    })
  }

  const renameBoard = (id: string, name: string) =>
    mutate((prev) => ({
      ...prev,
      boards: patchRecord(prev.boards, id, { name, updatedAt: now() }),
    }))

  const toggleStar = (id: string) =>
    mutate((prev) => {
      const board = prev.boards[id]
      if (!board) return prev
      return {
        ...prev,
        boards: patchRecord(prev.boards, id, { starred: !board.starred, updatedAt: now() }),
      }
    })

  const addList = (boardId: string, name: string) => {
    const id = uid()
    mutate((prev) => {
      const board = prev.boards[boardId]
      if (!board) return prev
      const list: List = { id, boardId, name, assignee: '', collapsed: false, order: board.listOrder.length, cardOrder: [], backgroundColor: '' }
      return {
        ...prev,
        lists: { ...prev.lists, [id]: list },
        boards: {
          ...prev.boards,
          [boardId]: {
            ...board,
            listOrder: [...board.listOrder, id],
            activity: [{ id: uid(), text: `Created list '${name}'`, createdAt: now() }, ...(board.activity ?? [])],
            updatedAt: now(),
          },
        },
      }
    })
  }

  const renameList = (id: string, name: string) =>
    mutate((prev) => {
      const list = prev.lists[id]
      if (!list) return prev
      const board = prev.boards[list.boardId]
      return {
        ...prev,
        lists: patchRecord(prev.lists, id, { name }),
        boards: board
          ? {
              ...prev.boards,
              [list.boardId]: {
                ...board,
                activity: [{ id: uid(), text: `Renamed list to '${name}'`, createdAt: now() }, ...(board.activity ?? [])],
                updatedAt: now(),
              },
            }
          : prev.boards,
      }
    })

  const setListAssignee = (id: string, name: string) =>
    mutate((prev) => ({ ...prev, lists: patchRecord(prev.lists, id, { assignee: name }) }))

  const setListBackgroundColor = (id: string, color: string) =>
    mutate((prev) => ({ ...prev, lists: patchRecord(prev.lists, id, { backgroundColor: color }) }))

  const toggleListCollapsed = (id: string) =>
    mutate((prev) => {
      const list = prev.lists[id]
      if (!list) return prev
      return { ...prev, lists: patchRecord(prev.lists, id, { collapsed: !list.collapsed }) }
    })

  const archiveList = (id: string) => {
    mutate((prev) => {
      const list = prev.lists[id]
      if (!list) return prev
      const board = prev.boards[list.boardId]
      if (!board) return prev
      const cardIds = new Set(list.cardOrder)
      const archivedCards: Card[] = list.cardOrder
        .map((cid) => prev.cards[cid])
        .filter((c): c is Card => Boolean(c))
      const archivedEntry = { list: { ...list }, cards: archivedCards }
      const cards: Record<string, Card> = {}
      for (const [k, v] of Object.entries(prev.cards)) {
        if (!cardIds.has(k)) cards[k] = v
      }
      const lists = { ...prev.lists }
      delete lists[id]
      const boardActivity = [{ id: uid(), text: `Archived list '${list.name}'`, createdAt: now() }, ...(board.activity ?? [])]
      return {
        ...prev,
        lists,
        cards,
        boards: {
          ...prev.boards,
          [list.boardId]: {
            ...board,
            listOrder: board.listOrder.filter((x) => x !== id),
            archivedLists: [...(board.archivedLists ?? []), archivedEntry],
            activity: boardActivity,
            updatedAt: now(),
          },
        },
      }
    })
  }

  const restoreList = (boardId: string, archivedIndex: number) => {
    mutate((prev) => {
      const board = prev.boards[boardId]
      if (!board) return prev
      const entry = (board.archivedLists ?? [])[archivedIndex]
      if (!entry) return prev
      const { list, cards: archivedCards } = entry
      const newLists = { ...prev.lists, [list.id]: list }
      const newCards = { ...prev.cards }
      for (const c of archivedCards) {
        newCards[c.id] = c
      }
      const boardActivity = [{ id: uid(), text: `Restored list '${list.name}'`, createdAt: now() }, ...(board.activity ?? [])]
      return {
        ...prev,
        lists: newLists,
        cards: newCards,
        boards: {
          ...prev.boards,
          [boardId]: {
            ...board,
            listOrder: [...board.listOrder, list.id],
            archivedLists: (board.archivedLists ?? []).filter((_, i) => i !== archivedIndex),
            activity: boardActivity,
            updatedAt: now(),
          },
        },
      }
    })
  }

  const moveList = (boardId: string, startIndex: number, endIndex: number) => {
    mutate((prev) => {
      const board = prev.boards[boardId]
      if (!board) return prev
      const order = [...board.listOrder]
      const [moved] = order.splice(startIndex, 1)
      if (!moved) return prev
      order.splice(endIndex, 0, moved)
      return { ...prev, boards: { ...prev.boards, [boardId]: { ...board, listOrder: order, updatedAt: now() } } }
    })
  }

  const addCard = (listId: string, title: string): string => {
    const id = uid()
    mutate((prev) => {
      const list = prev.lists[listId]
      if (!list) return prev
      const board = prev.boards[list.boardId]
      const card = makeCard(list, title, { id })
      const base = withCardAdded(prev, card)
      return board
        ? {
            ...base,
            boards: {
              ...base.boards,
              [list.boardId]: {
                ...base.boards[list.boardId],
                activity: [{ id: uid(), text: `Created card '${title}'`, createdAt: now() }, ...(base.boards[list.boardId]?.activity ?? [])],
              },
            },
          }
        : base
    })
    return id
  }

  const deleteCard = (id: string) => {
    mutate((prev) => {
      const card = prev.cards[id]
      if (!card) return prev
      const cards = { ...prev.cards }
      delete cards[id]
      const list = prev.lists[card.listId]
      if (!list) return { ...prev, cards }
      return {
        ...prev,
        cards,
        lists: { ...prev.lists, [card.listId]: { ...list, cardOrder: list.cardOrder.filter((x) => x !== id) } },
      }
    })
  }

  const updateCard = (id: string, patch: Partial<Card>) =>
    mutate((prev) => ({ ...prev, cards: patchRecord(prev.cards, id, { ...patch, updatedAt: now() }) }))

  const moveCard = (cardId: string, destListId: string, destIndex: number) => {
    mutate((prev) => {
      const card = prev.cards[cardId]
      if (!card) return prev
      const srcListId = card.listId
      const src = prev.lists[srcListId]
      const dest = prev.lists[destListId]
      if (!src || !dest) return prev
      const srcOrder = src.cardOrder.filter((id) => id !== cardId)
      const destOrder =
        srcListId === destListId ? srcOrder : dest.cardOrder.filter((id) => id !== cardId)
      destOrder.splice(destIndex, 0, cardId)
      const movedText =
        srcListId === destListId
          ? 'moved this card within the list'
          : `moved this card to ${dest.name}`
      const board = prev.boards[card.boardId]
      const boardActivity = board && srcListId !== destListId
        ? [{ id: uid(), text: `Moved '${card.title}' from ${src.name} to ${dest.name}`, createdAt: now() }, ...(board.activity ?? [])]
        : board?.activity ?? []
      return {
        ...prev,
        lists: {
          ...prev.lists,
          [srcListId]: { ...src, cardOrder: srcOrder },
          [destListId]: { ...dest, cardOrder: destOrder },
        },
        cards: {
          ...prev.cards,
          [cardId]: {
            ...card,
            listId: destListId,
            updatedAt: now(),
            activity: [{ id: uid(), text: movedText, createdAt: now() }, ...card.activity],
          },
        },
        boards: board
          ? { ...prev.boards, [card.boardId]: { ...board, activity: boardActivity, updatedAt: now() } }
          : prev.boards,
      }
    })
  }

  const addActivity = (cardId: string, text: string) => {
    mutate((prev) => {
      const card = prev.cards[cardId]
      if (!card) return prev
      return {
        ...prev,
        cards: {
          ...prev.cards,
          [cardId]: {
            ...card,
            updatedAt: now(),
            activity: [{ id: uid(), text, createdAt: now() }, ...card.activity],
          },
        },
      }
    })
  }

  const addInboxItem = (text: string) =>
    mutate((prev) => ({ ...prev, inbox: [{ id: uid(), text, createdAt: now() }, ...prev.inbox] }))

  const dismissInboxItem = (id: string) =>
    mutate((prev) => ({ ...prev, inbox: prev.inbox.filter((i) => i.id !== id) }))

  const archiveCard = (id: string) =>
    mutate((prev) => {
      const card = prev.cards[id]
      if (!card || card.archived) return prev
      const board = prev.boards[card.boardId]
      return {
        ...prev,
        cards: {
          ...prev.cards,
          [id]: {
            ...card,
            archived: true,
            updatedAt: now(),
            activity: [{ id: uid(), text: 'archived this card', createdAt: now() }, ...card.activity],
          },
        },
        boards: board
          ? {
              ...prev.boards,
              [card.boardId]: {
                ...board,
                activity: [{ id: uid(), text: `Archived card '${card.title}'`, createdAt: now() }, ...(board.activity ?? [])],
                updatedAt: now(),
              },
            }
          : prev.boards,
      }
    })

  const restoreCard = (id: string) =>
    mutate((prev) => {
      const card = prev.cards[id]
      if (!card || !card.archived) return prev
      let listId = card.listId
      let listName = prev.lists[listId]?.name
      if (!prev.lists[listId]) {
        const board = prev.boards[card.boardId]
        listId = board?.listOrder[0] ?? card.listId
        listName = prev.lists[listId]?.name ?? 'a list'
      }
      const board = prev.boards[card.boardId]
      const boardActivity = board
        ? [{ id: uid(), text: `Restored card '${card.title}' to ${listName}`, createdAt: now() }, ...(board.activity ?? [])]
        : []
      return {
        ...prev,
        cards: {
          ...prev.cards,
          [id]: {
            ...card,
            archived: false,
            listId,
            updatedAt: now(),
            activity: [{ id: uid(), text: 'restored this card', createdAt: now() }, ...card.activity],
          },
        },
        boards: board
          ? { ...prev.boards, [card.boardId]: { ...board, activity: boardActivity, updatedAt: now() } }
          : prev.boards,
      }
    })

  const toggleDone = (id: string) =>
    mutate((prev) => {
      const card = prev.cards[id]
      if (!card) return prev
      const done = !card.done
      return {
        ...prev,
        cards: {
          ...prev.cards,
          [id]: {
            ...card,
            done,
            updatedAt: now(),
            activity: [
              { id: uid(), text: done ? 'marked this card as done' : 'reopened this card', createdAt: now() },
              ...card.activity,
            ],
          },
        },
      }
    })

  const setBoardVisibility = (id: string, visibility: Board['visibility']) =>
    mutate((prev) => {
      const board = prev.boards[id]
      if (!board) return prev
      return {
        ...prev,
        boards: {
          ...prev.boards,
          [id]: {
            ...board,
            visibility,
            activity: [{ id: uid(), text: `Changed visibility to ${visibility}`, createdAt: now() }, ...(board.activity ?? [])],
            updatedAt: now(),
          },
        },
      }
    })

  const setBoardBackground = (id: string, background: string) =>
    mutate((prev) => {
      const board = prev.boards[id]
      if (!board) return prev
      return {
        ...prev,
        boards: {
          ...prev.boards,
          [id]: {
            ...board,
            background,
            activity: [{ id: uid(), text: 'Changed board background', createdAt: now() }, ...(board.activity ?? [])],
            updatedAt: now(),
          },
        },
      }
    })

  const setBoardDescription = (id: string, description: string) =>
    mutate((prev) => ({
      ...prev,
      boards: patchRecord(prev.boards, id, { description, updatedAt: now() }),
    }))

  const addBoardActivity = (boardId: string, text: string) =>
    mutate((prev) => {
      const board = prev.boards[boardId]
      if (!board) return prev
      return {
        ...prev,
        boards: {
          ...prev.boards,
          [boardId]: { ...board, activity: [{ id: uid(), text, createdAt: now() }, ...(board.activity ?? [])], updatedAt: now() },
        },
      }
    })

  const setBoardSettings = (boardId: string, patch: Partial<Board['settings']>) =>
    mutate((prev) => {
      const board = prev.boards[boardId]
      if (!board) return prev
      const currentSettings = board.settings ?? { commentPermission: 'members' as const, selfJoin: false }
      const newSettings = { ...currentSettings, ...patch }
      const changed: string[] = []
      if (patch.commentPermission && patch.commentPermission !== currentSettings.commentPermission) {
        changed.push(`comments to ${patch.commentPermission === 'members' ? 'board members' : 'anyone'}`)
      }
      if (patch.selfJoin !== undefined && patch.selfJoin !== currentSettings.selfJoin) {
        changed.push(`self-join ${patch.selfJoin ? 'enabled' : 'disabled'}`)
      }
      const activityText = changed.length > 0 ? `Updated settings: ${changed.join(', ')}` : 'Updated board settings'
      return {
        ...prev,
        boards: {
          ...prev.boards,
          [boardId]: {
            ...board,
            settings: newSettings,
            activity: [{ id: uid(), text: activityText, createdAt: now() }, ...(board.activity ?? [])],
            updatedAt: now(),
          },
        },
      }
    })

  const makeTemplate = (boardId: string): string => {
    const srcBoard = data.boards[boardId]
    if (!srcBoard) return ''
    const newBoardId = uid()
    const labels: Record<string, Label> = {}
    Object.values(srcBoard.labels).forEach((l) => {
      const id = uid()
      labels[id] = { id, name: l.name, color: l.color }
    })
    const newLists: Record<string, List> = {}
    const listOrder: string[] = []
    srcBoard.listOrder.forEach((listId) => {
      const src = data.lists[listId]
      if (!src) return
      const newId = uid()
      newLists[newId] = { ...src, id: newId, boardId: newBoardId, cardOrder: [] }
      listOrder.push(newId)
    })
    const newBoard: Board = {
      id: newBoardId,
      name: `${srcBoard.name} (template)`,
      description: srcBoard.description,
      visibility: 'private',
      starred: false,
      background: srcBoard.background,
      createdAt: now(),
      updatedAt: now(),
      listOrder,
      labels,
      shares: [],
      settings: { commentPermission: 'members', selfJoin: false },
      activity: [{ id: uid(), text: `Created template from '${srcBoard.name}'`, createdAt: now() }],
      archivedLists: [],
    }
    mutate((prev) => ({
      ...prev,
      boards: { ...prev.boards, [newBoardId]: newBoard },
      lists: { ...prev.lists, ...newLists },
      ui: { ...prev.ui, lastVisitedBoardId: newBoardId },
    }))
    return newBoardId
  }

  const addLabel = (boardId: string, name: string, color: string): string => {
    const id = uid()
    mutate((prev) => {
      const board = prev.boards[boardId]
      if (!board) return prev
      const label: Label = { id, name, color }
      return {
        ...prev,
        boards: {
          ...prev.boards,
          [boardId]: {
            ...board,
            labels: { ...board.labels, [id]: label },
            activity: [{ id: uid(), text: `Created label '${name}'`, createdAt: now() }, ...(board.activity ?? [])],
            updatedAt: now(),
          },
        },
      }
    })
    return id
  }

  const updateLabel = (boardId: string, labelId: string, patch: Partial<Label>) =>
    mutate((prev) => {
      const board = prev.boards[boardId]
      const label = board?.labels[labelId]
      if (!board || !label) return prev
      return {
        ...prev,
        boards: {
          ...prev.boards,
          [boardId]: {
            ...board,
            labels: { ...board.labels, [labelId]: { ...label, ...patch } },
            updatedAt: now(),
          },
        },
      }
    })

  const deleteLabel = (boardId: string, labelId: string) =>
    mutate((prev) => {
      const board = prev.boards[boardId]
      if (!board || !board.labels[labelId]) return prev
      const labelName = board.labels[labelId].name
      const labels = { ...board.labels }
      delete labels[labelId]
      const cards: Record<string, Card> = {}
      for (const [k, v] of Object.entries(prev.cards)) {
        cards[k] =
          v.boardId === boardId && v.labelIds.includes(labelId)
            ? { ...v, labelIds: v.labelIds.filter((l) => l !== labelId) }
            : v
      }
      return {
        ...prev,
        boards: {
          ...prev.boards,
          [boardId]: {
            ...board,
            labels,
            activity: [{ id: uid(), text: `Deleted label '${labelName}'`, createdAt: now() }, ...(board.activity ?? [])],
            updatedAt: now(),
          },
        },
        cards,
      }
    })

  const addShare = (boardId: string, name: string, role: Share['role']) =>
    mutate((prev) => {
      const board = prev.boards[boardId]
      if (!board) return prev
      const share: Share = { id: uid(), name, role }
      return {
        ...prev,
        boards: {
          ...prev.boards,
          [boardId]: { ...board, shares: [...(board.shares ?? []), share], updatedAt: now() },
        },
      }
    })

  const removeShare = (boardId: string, shareId: string) =>
    mutate((prev) => {
      const board = prev.boards[boardId]
      if (!board) return prev
      return {
        ...prev,
        boards: {
          ...prev.boards,
          [boardId]: {
            ...board,
            shares: (board.shares ?? []).filter((s) => s.id !== shareId),
            updatedAt: now(),
          },
        },
      }
    })

  const updateShareRole = (boardId: string, shareId: string, role: Share['role']) =>
    mutate((prev) => {
      const board = prev.boards[boardId]
      if (!board) return prev
      const shares = (board.shares ?? []).map((s) => (s.id === shareId ? { ...s, role } : s))
      return {
        ...prev,
        boards: { ...prev.boards, [boardId]: { ...board, shares, updatedAt: now() } },
      }
    })

  const createShareLink = (boardId: string) =>
    mutate((prev) => {
      const board = prev.boards[boardId]
      if (!board) return prev
      return {
        ...prev,
        boards: {
          ...prev.boards,
          [boardId]: {
            ...board,
            shareLink: { token: uid(), enabled: true, createdAt: now() },
            updatedAt: now(),
          },
        },
      }
    })

  const moveInboxToBoard = (itemId: string, boardId: string, listId: string) =>
    mutate((prev) => {
      const item = prev.inbox.find((i) => i.id === itemId)
      const list = prev.lists[listId]
      if (!item || !list || list.boardId !== boardId) return prev
      const card = makeCard(list, item.text, {
        activity: [{ id: uid(), text: 'created from inbox', createdAt: now() }],
      })
      return {
        ...withCardAdded(prev, card),
        inbox: prev.inbox.filter((i) => i.id !== itemId),
      }
    })

  const scheduleInboxItem = (itemId: string, boardId: string, date: string) =>
    mutate((prev) => {
      const item = prev.inbox.find((i) => i.id === itemId)
      const board = prev.boards[boardId]
      if (!item || !board || board.listOrder.length === 0) return prev
      const listId = board.listOrder[0]
      const list = prev.lists[listId]
      if (!list) return prev
      const card = makeCard(list, item.text, {
        dueDate: date,
        activity: [
          { id: uid(), text: `scheduled for ${formatDate(date)}`, createdAt: now() },
          { id: uid(), text: 'created from inbox', createdAt: now() },
        ],
      })
      return {
        ...withCardAdded(prev, card),
        inbox: prev.inbox.filter((i) => i.id !== itemId),
      }
    })

  const setDarkMode = (mode: ThemeMode) =>
    mutate((prev) => ({
      ...prev,
      ui: { ...prev.ui, darkMode: mode },
    }))

  const resetAll = () => {
    clearData()
    setData(emptyData())
  }

  /* ── Social Posts (delegated to useSocialPosts hook) ──────────── */

  const addSocialPost = (input: Omit<SocialPost, 'id' | 'createdAt' | 'updatedAt'>): SocialPost => {
    // Synchronous wrapper — fires API call in background, returns optimistic result
    const optimistic: SocialPost = {
      ...input,
      id: uid(),
      createdAt: now(),
      updatedAt: now(),
    }
    social.addPost(input).catch(() => {})
    return optimistic
  }

  const updateSocialPost = (id: string, patch: Partial<SocialPost>) =>
    social.updatePost(id, patch)

  const deleteSocialPost = (id: string) =>
    social.deletePost(id)

  const duplicateSocialPost = (id: string): SocialPost | null =>
    social.duplicatePost(id)

  const moveSocialPost = (id: string, newDate: string, newTime?: string) =>
    social.movePost(id, newDate, newTime)

  const scheduleSocialPost = (id: string, input: { scheduledDate: string; scheduledTime?: string; timezone?: string; repeat?: SocialPost['repeat']; repeatUntil?: string }) =>
    social.schedulePost(id, input)

  const cancelSocialPost = (id: string, platform?: Platform) =>
    social.cancelPost(id, platform)

  const retrySocialPost = (id: string, platform?: Platform) =>
    social.retryPost(id, platform)

  const refreshSocialJobs = (postId?: string) =>
    social.refreshJobs(postId)

  const refreshSocialPost = (postId: string) =>
    social.refreshPost(postId)

  const getSocialPostsByDate = (date: string): SocialPost[] =>
    social.getByDate(date)

  const getSocialPostsByPlatform = (platform: Platform): SocialPost[] =>
    social.getByPlatform(platform)

  const getSocialPostsByStatus = (status: SocialPost['status']): SocialPost[] =>
    social.getByStatus(status)

  const getSocialPostsByCard = (cardId: string): SocialPost[] =>
    social.getByCard(cardId)

  const getUnscheduledPosts = (): SocialPost[] =>
    social.getUnscheduled()

  const addPlatformToPost = (postId: string, platform: Platform) =>
    social.addPlatform(postId, platform)

  const removePlatformFromPost = (postId: string, platform: Platform) =>
    social.removePlatform(postId, platform)

  const updatePostPlatform = (postId: string, platform: Platform, patch: Partial<SocialPostPlatform>) =>
    social.updatePlatform(postId, platform, patch)

  const addMediaToPost = (postId: string, media: Omit<SocialMediaAttachment, 'id'>) =>
    social.addMedia(postId, media)

  const removeMediaFromPost = (postId: string, mediaId: string) =>
    social.removeMedia(postId, mediaId)

  const updatePostAnalytics = (postId: string, platform: Platform, analytics: SocialAnalytics) =>
    social.updateAnalytics(postId, platform, analytics)

  const boards = useMemo(
    () => Object.values(data.boards).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)),
    [data.boards],
  )
  const members = useMemo(() => Object.values(data.members), [data.members])

  const value: Store = {
    data,
    error,
    dismissError,
    boards,
    members,
    getBoard,
    getLists,
    getCards,
    getCard,
    createBoard,
    deleteBoard,
    renameBoard,
    toggleStar,
    addList,
    renameList,
    setListAssignee,
    setListBackgroundColor,
    toggleListCollapsed,
    archiveList,
    restoreList,
    moveList,
    addCard,
    deleteCard,
    updateCard,
    moveCard,
    addActivity,
    addBoardActivity,
    setBoardSettings,
    makeTemplate,
    addInboxItem,
    dismissInboxItem,
    moveInboxToBoard,
    scheduleInboxItem,
    archiveCard,
    restoreCard,
    toggleDone,
    setBoardVisibility,
    setBoardBackground,
    setBoardDescription,
    addLabel,
    updateLabel,
    deleteLabel,
    addShare,
    removeShare,
    updateShareRole,
    createShareLink,
    setDarkMode,
    resetAll,
    socialPosts: social.posts,
    socialJobs: social.jobs,
    addSocialPost,
    updateSocialPost,
    deleteSocialPost,
    duplicateSocialPost,
    moveSocialPost,
    scheduleSocialPost,
    cancelSocialPost,
    retrySocialPost,
    refreshSocialJobs,
    refreshSocialPost,
    getSocialPostsByDate,
    getSocialPostsByPlatform,
    getSocialPostsByStatus,
    getSocialPostsByCard,
    getUnscheduledPosts,
    addPlatformToPost,
    removePlatformFromPost,
    updatePostPlatform,
    addMediaToPost,
    removeMediaFromPost,
    updatePostAnalytics,
  }

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>
}
