'use client'

import { useRef, useState, useEffect, useCallback } from 'react'
import { MessageSquare, SmilePlus, AtSign, Trash2 } from 'lucide-react'
import EmojiPicker, { Theme } from 'emoji-picker-react'
import type { Card, Member } from '@/lib/kali/store/schema'
import { YOU_ID } from '@/lib/kali/store/schema'
import { useStore } from '@/lib/kali/store/useStore'
import { uid } from '@/lib/kali/utils/id'
import { formatDateTime } from '@/lib/kali/utils/dates'
import { hasUserCommentReaction, toggleUserCommentReaction } from '@/lib/kali/utils/reactions'
import SectionLabel from '../shared/SectionLabel'
import Avatar from '../shared/Avatar'

interface MentionMatch {
  userId: string
  name: string
  member: Member
}

function parseMentions(text: string): { type: 'text' | 'mention'; value: string; userId?: string }[] {
  const parts: { type: 'text' | 'mention'; value: string; userId?: string }[] = []
  const regex = /@\[([^\]]+)\]/g
  let lastIndex = 0
  let match: RegExpExecArray | null
  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push({ type: 'text', value: text.slice(lastIndex, match.index) })
    }
    parts.push({ type: 'mention', value: match[1], userId: match[1] })
    lastIndex = match.index + match[0].length
  }
  if (lastIndex < text.length) {
    parts.push({ type: 'text', value: text.slice(lastIndex) })
  }
  if (parts.length === 0) parts.push({ type: 'text', value: text })
  return parts
}

function MentionChip({ userId, members, currentUserId }: { userId: string; members: Member[]; currentUserId: string | null }) {
  const member =
    members.find((m) => m.id === userId) ??
    (currentUserId && userId === currentUserId
      ? members.find((m) => m.id === YOU_ID)
      : undefined) ??
    (userId === YOU_ID ? members.find((m) => m.id === YOU_ID) : undefined)
  const name = member?.name ?? (userId === YOU_ID ? 'You' : 'Unknown')
  const removed = !member
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-sm font-medium ${
        removed
          ? 'bg-surface-alt text-text-muted'
          : 'bg-primary-subtle text-primary-hover'
      }`}
    >
      @{name}
    </span>
  )
}

export default function CardComments({ card, readOnly = false, highlightCommentId }: { card: Card; readOnly?: boolean; highlightCommentId?: string | null }) {
  const store = useStore()
  const [text, setText] = useState('')
  const [replyTo, setReplyTo] = useState<string | null>(null)
  const [replyText, setReplyText] = useState('')
  const [activePicker, setActivePicker] = useState<string | null>(null)
  const [mentionOpen, setMentionOpen] = useState(false)
  const [mentionQuery, setMentionQuery] = useState('')
  const [mentionIndex, setMentionIndex] = useState(0)
  const [mentionCursor, setMentionCursor] = useState(0)
  const commentRefs = useRef<Record<string, HTMLDivElement | null>>({})
  const inputRef = useRef<HTMLInputElement>(null)
  const pickerRef = useRef<HTMLDivElement>(null)
  const you = store.data.members[YOU_ID]

  const boardMembers = store.getBoardMembers(card.boardId)
  const memberMap = new Map(boardMembers.map((m) => [m.id, m]))

  const filteredMembers = boardMembers.filter((m) =>
    m.name.toLowerCase().includes(mentionQuery.toLowerCase()),
  )

  // Detect @ trigger
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value
    setText(value)
    const cursor = e.target.selectionStart ?? value.length
    // Find the last @ before cursor with no space after it
    const before = value.slice(0, cursor)
    const match = before.match(/@(\w*)$/)
    if (match) {
      setMentionQuery(match[1])
      setMentionOpen(true)
      setMentionIndex(0)
      setMentionCursor(cursor)
    } else {
      setMentionOpen(false)
    }
  }

  const insertMention = useCallback(
    (member: Member) => {
      const input = inputRef.current
      if (!input) return
      const cursor = mentionCursor || input.selectionStart || text.length
      const before = text.slice(0, cursor)
      const after = text.slice(cursor)
      const match = before.match(/@(\w*)$/)
      if (!match) return
      const start = cursor - match[0].length
      // Store the server user id in the token, not the local "you" key, so the
      // backend can validate and notify. For the current user, resolve to their
      // server id; otherwise the member id is already the server id.
      const serverId =
        member.id === YOU_ID ? (store.currentUserId ?? member.id) : member.id
      const newText = before.slice(0, start) + `@[${serverId}] ` + after
      setText(newText)
      setMentionOpen(false)
      // Restore cursor
      setTimeout(() => {
        const pos = start + `@[${member.id}] `.length
        input.setSelectionRange(pos, pos)
        input.focus()
      }, 0)
    },
    [text],
  )

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (mentionOpen && filteredMembers.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        setMentionIndex((i) => Math.min(i + 1, filteredMembers.length - 1))
        return
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault()
        setMentionIndex((i) => Math.max(i - 1, 0))
        return
      }
      if (e.key === 'Enter') {
        e.preventDefault()
        insertMention(filteredMembers[mentionIndex])
        return
      }
      if (e.key === 'Escape') {
        setMentionOpen(false)
        return
      }
    }
    if (e.key === 'Enter' && !mentionOpen) {
      submit()
    }
  }

  const submit = (parentId: string | null = null, body?: string) => {
    const t = (body ?? text).trim()
    if (!t) return
    store.updateCard(card.id, {
      comments: [
        ...card.comments,
        { id: uid(), authorId: YOU_ID, parentId, text: t, reactions: {}, createdAt: new Date().toISOString() },
      ],
    })
    store.addActivity(card.id, parentId ? 'replied to a comment' : 'added a comment')
    if (parentId) {
      setReplyText('')
      setReplyTo(null)
    } else {
      setText('')
    }
    setMentionOpen(false)
  }

  const canDeleteComment = (comment: { authorId: string }) =>
    !readOnly &&
    (comment.authorId === YOU_ID || comment.authorId === store.currentUserId)

  const deleteComment = (commentId: string) => {
    const next = card.comments.filter((c) => c.id !== commentId)
    store.updateCard(card.id, { comments: next })
    store.addActivity(card.id, 'deleted a comment')
  }

  const toggleCommentReaction = (commentId: string, emoji: string) => {
    const comments = card.comments.map((c) => {
      if (c.id !== commentId) return c
      const current = c.reactions[emoji] ?? 0
      const added = toggleUserCommentReaction(card.id, commentId, emoji)
      return {
        ...c,
        reactions: {
          ...c.reactions,
          [emoji]: added ? current + 1 : Math.max(0, current - 1),
        },
      }
    })
    const cleaned = comments.map((c) => {
      const r = { ...c.reactions }
      for (const [k, v] of Object.entries(r)) {
        if (v <= 0) delete r[k]
      }
      return { ...c, reactions: r }
    })
    store.updateCard(card.id, { comments: cleaned })
    store.addActivity(card.id, `Reacted ${emoji} to a comment`)
  }

  // Close mention popover on outside click
  useEffect(() => {
    if (!mentionOpen) return
    const handler = (e: MouseEvent) => {
      if (inputRef.current && !inputRef.current.contains(e.target as Node)) {
        setMentionOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [mentionOpen])

  // Highlight a comment when arriving from a mention notification.
  useEffect(() => {
    if (!highlightCommentId) return
    const el = commentRefs.current[highlightCommentId]
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' })
      el.classList.add('ring-2', 'ring-primary')
      const t = setTimeout(() => el.classList.remove('ring-2', 'ring-primary'), 2000)
      return () => clearTimeout(t)
    }
  }, [highlightCommentId, card.comments])

  return (
    <section>
      <SectionLabel icon={<MessageSquare size={14} />}>Comments</SectionLabel>

      {!readOnly && (
      <div className="relative mt-2 flex items-start gap-2">
        {you && <Avatar member={you} size={24} />}
        <div className="relative flex-1">
          <input
            ref={inputRef}
            value={text}
            onChange={handleChange}
            onKeyDown={handleKeyDown}
            placeholder="Write a comment…"
            className="w-full rounded-md border border-border-strong bg-surface px-3 py-2 text-sm text-text-primary outline-none transition-colors duration-150 placeholder:text-text-muted focus:border-primary focus:ring-2 focus:border-primary/20"
          />
          {mentionOpen && filteredMembers.length > 0 && (
            <div className="absolute bottom-full left-0 z-30 mb-1 max-h-48 w-64 overflow-y-auto rounded-lg border border-border bg-surface-elevated shadow-subtle">
              {filteredMembers.map((member, i) => (
                <button
                  key={member.id}
                  type="button"
                  onClick={() => insertMention(member)}
                  className={`flex w-full items-center gap-2 px-3 py-2 text-left text-sm transition-colors ${
                    i === mentionIndex ? 'bg-primary-subtle' : 'hover:bg-surface-alt'
                  }`}
                >
                  <Avatar member={member} size={20} />
                  <span className="truncate font-medium text-text-primary">{member.name}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
      )}

      <div className="mt-3 space-y-3">
        {card.comments
          .filter((c) => !c.parentId)
          .map((comment) => {
          const boardMembers = store.getBoardMembers(card.boardId)
          const author =
            store.data.members[comment.authorId] ??
            boardMembers.find((m) => m.id === comment.authorId) ??
            {
              id: comment.authorId,
              name:
                comment.authorId === store.currentUserId ||
                comment.authorId === YOU_ID
                  ? "You"
                  : "Unknown",
              color: "#3971B8",
            }
          const reactionEntries = Object.entries(comment.reactions).filter(([, c]) => c > 0)
          const pickerOpen = activePicker === comment.id
          const parts = parseMentions(comment.text)

          return (
            <div key={comment.id} ref={(el) => { commentRefs.current[comment.id] = el }} className="flex items-start gap-2 rounded-lg transition-all">
              <Avatar member={author} size={24} />
              <div className="min-w-0 flex-1">
                <div className="rounded-lg bg-surface-alt px-3 py-2">
                  <div className="flex items-baseline gap-2">
                    <span className="text-xs font-semibold text-text-primary">{author.name}</span>
                    <span className="font-mono text-[10.5px] text-text-muted">
                      {formatDateTime(comment.createdAt)}
                    </span>
                  </div>
                  <p className="mt-0.5 whitespace-pre-wrap break-words text-sm leading-relaxed text-text-primary">
                    {parts.map((part, i) =>
                      part.type === 'mention' && part.userId ? (
                        <MentionChip key={i} userId={part.userId} members={boardMembers} currentUserId={store.currentUserId} />
                      ) : (
                        <span key={i}>{part.value}</span>
                      ),
                    )}
                  </p>
                </div>

                {reactionEntries.length > 0 && (
                  <div className="mt-1.5 flex flex-wrap gap-1">
                    {reactionEntries.map(([emoji, count]) => {
                      const active = hasUserCommentReaction(card.id, comment.id, emoji)
                      return (
                        <button
                          key={emoji}
                          type="button"
                          disabled={readOnly}
                          onClick={() => toggleCommentReaction(comment.id, emoji)}
                          className={`inline-flex items-center gap-0.5 rounded-full px-2 py-0.5 text-xs transition-colors duration-150 active:scale-[0.98] ${
                            active
                              ? 'bg-primary-subtle text-primary-hover ring-1 ring-inset ring-primary'
                              : 'bg-surface-alt text-text-secondary hover:bg-surface-elevated'
                          }`}
                        >
                          <span>{emoji}</span>
                          <span className="font-mono text-[10px]">{count}</span>
                        </button>
                      )
                    })}
                  </div>
                )}

                {!readOnly && (
                <div className="relative mt-1 flex items-center gap-1" ref={pickerRef}>
                  <button
                    type="button"
                    onClick={() => setActivePicker(pickerOpen ? null : comment.id)}
                    aria-label="Add reaction"
                    className="inline-flex items-center gap-1 rounded-md p-1 text-text-muted transition-colors duration-150 hover:bg-surface-alt hover:text-text-secondary"
                    title="Add reaction"
                  >
                    <SmilePlus size={14} />
                  </button>

                  {canDeleteComment(comment) && (
                    <button
                      type="button"
                      onClick={() => deleteComment(comment.id)}
                      aria-label="Delete comment"
                      title="Delete comment"
                      className="inline-flex items-center gap-1 rounded-md p-1 text-text-muted transition-colors duration-150 hover:bg-danger-subtle hover:text-danger-text"
                    >
                      <Trash2 size={14} />
                    </button>
                  )}

                  {!readOnly && (
                    <button
                      type="button"
                      onClick={() => setReplyTo(replyTo === comment.id ? null : comment.id)}
                      className="inline-flex items-center gap-1 rounded-md px-1.5 py-1 text-xs font-medium text-text-muted transition-colors duration-150 hover:bg-surface-alt hover:text-text-secondary"
                    >
                      Reply
                    </button>
                  )}

                  {pickerOpen && (
                    <div className="absolute left-0 top-8 z-30 max-w-[min(320px,100%)] animate-in">
                      <EmojiPicker
                        onEmojiClick={(emojiData: any) => {
                          toggleCommentReaction(comment.id, emojiData.emoji)
                          setActivePicker(null)
                        }}
                        theme={Theme.LIGHT}
                        width={320}
                        height={380}
                        lazyLoadEmojis
                        autoFocusSearch
                        skinTonesDisabled
                        previewConfig={{ showPreview: false }}
                      />
                    </div>
                  )}
                </div>
                )}

                {/* Replies */}
                {card.comments
                  .filter((c) => c.parentId === comment.id)
                  .map((reply) => {
                    const replyAuthor =
                      store.data.members[reply.authorId] ??
                      boardMembers.find((m) => m.id === reply.authorId) ?? {
                        id: reply.authorId,
                        name:
                          reply.authorId === store.currentUserId || reply.authorId === YOU_ID
                            ? "You"
                            : "Unknown",
                        color: "#3971B8",
                      }
                    const replyParts = parseMentions(reply.text)
                    return (
                      <div key={reply.id} className="mt-2 flex items-start gap-2 pl-4">
                        <Avatar member={replyAuthor} size={20} />
                        <div className="min-w-0 flex-1">
                          <div className="rounded-lg bg-surface px-3 py-2">
                            <div className="flex items-baseline gap-2">
                              <span className="text-xs font-semibold text-text-primary">{replyAuthor.name}</span>
                              <span className="font-mono text-[10.5px] text-text-muted">
                                {formatDateTime(reply.createdAt)}
                              </span>
                            </div>
                            <p className="mt-0.5 whitespace-pre-wrap break-words text-sm leading-relaxed text-text-primary">
                              {replyParts.map((part, i) =>
                                part.type === 'mention' && part.userId ? (
                                  <MentionChip key={i} userId={part.userId} members={boardMembers} currentUserId={store.currentUserId} />
                                ) : (
                                  <span key={i}>{part.value}</span>
                                ),
                              )}
                            </p>
                          </div>
                          {!readOnly && canDeleteComment(reply) && (
                            <button
                              type="button"
                              onClick={() => deleteComment(reply.id)}
                              className="mt-1 inline-flex items-center gap-1 rounded-md p-1 text-xs text-text-muted transition-colors duration-150 hover:bg-danger-subtle hover:text-danger-text"
                            >
                              <Trash2 size={12} />
                            </button>
                          )}
                        </div>
                      </div>
                    )
                  })}

                {/* Reply input */}
                {replyTo === comment.id && !readOnly && (
                  <div className="mt-2 flex items-start gap-2 pl-4">
                    {you && <Avatar member={you} size={20} />}
                    <input
                      autoFocus
                      value={replyText}
                      onChange={(e) => setReplyText(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') submit(comment.id, replyText)
                        if (e.key === 'Escape') {
                          setReplyTo(null)
                          setReplyText('')
                        }
                      }}
                      placeholder="Write a reply…"
                      className="flex-1 rounded-md border border-border-strong bg-surface px-3 py-2 text-sm text-text-primary outline-none transition-colors duration-150 placeholder:text-text-muted focus:border-primary focus:ring-2 focus:border-primary/20"
                    />
                  </div>
                )}
              </div>
            </div>
          )
        })}

        {card.comments.length === 0 && (
          <p className="text-xs text-text-muted">No comments yet.</p>
        )}
      </div>
    </section>
  )
}