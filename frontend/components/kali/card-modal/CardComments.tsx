'use client'

import { useRef, useState, useEffect, useCallback } from 'react'
import { MessageSquare, SmilePlus, Trash2, Send } from 'lucide-react'
import EmojiPicker, { Theme } from 'emoji-picker-react'
import type { Card, Member } from '@/lib/kali/store/schema'
import { YOU_ID } from '@/lib/kali/store/schema'
import { useStore } from '@/lib/kali/store/useStore'
import { uid } from '@/lib/kali/utils/id'
import { formatDateTime } from '@/lib/kali/utils/dates'
import { hasUserCommentReaction, toggleUserCommentReaction } from '@/lib/kali/utils/reactions'
import SectionLabel from '../shared/SectionLabel'
import Avatar from '../shared/Avatar'

function parseMentions(text: string): { type: 'text' | 'mention'; value: string; userId?: string; name?: string }[] {
  const parts: { type: 'text' | 'mention'; value: string; userId?: string; name?: string }[] = []
  const regex = /@\[([^\]]+)\]/g
  let lastIndex = 0
  let match: RegExpExecArray | null
  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push({ type: 'text', value: text.slice(lastIndex, match.index) })
    }
    const raw = match[1]
    const pipe = raw.indexOf('|')
    const userId = pipe >= 0 ? raw.slice(0, pipe) : raw
    const name = pipe >= 0 ? raw.slice(pipe + 1) : undefined
    parts.push({ type: 'mention', value: raw, userId, name })
    lastIndex = match.index + match[0].length
  }
  if (lastIndex < text.length) {
    parts.push({ type: 'text', value: text.slice(lastIndex) })
  }
  if (parts.length === 0) parts.push({ type: 'text', value: text })
  return parts
}

function MentionChip({
  userId,
  name,
  members,
  currentUserId,
}: {
  userId: string
  name?: string
  members: Member[]
  currentUserId: string | null
}) {
  const member =
    members.find((m) => m.id === userId) ??
    (currentUserId && userId === currentUserId
      ? members.find((m) => m.id === YOU_ID)
      : undefined) ??
    (userId === YOU_ID ? members.find((m) => m.id === YOU_ID) : undefined)
  const displayName =
    name ||
    member?.name ||
    (userId === YOU_ID || userId === currentUserId ? 'You' : 'Unknown')
  const removed = !member && !name
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[13px] leading-4 font-medium ${
        removed
          ? 'bg-surface-alt text-text-muted'
          : 'bg-primary-subtle text-primary-text'
      }`}
    >
      @{displayName}
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
  const [expandedThreads, setExpandedThreads] = useState<Record<string, boolean>>({})
  const inputRef = useRef<HTMLInputElement>(null)
  const replyInputRef = useRef<HTMLInputElement>(null)
  const commentRefs = useRef<Record<string, HTMLDivElement | null>>({})
  const you = store.data.members[YOU_ID]

  const boardMembers = store.getBoardMembers(card.boardId)

  // Convert composer text (which uses `@Name` for mentions) into the structured
  // `@[id|Name]` form the store/backend expect, so ids never appear in the UI.
  const toStructured = (input: string): string => {
    let result = ''
    let i = 0
    while (i < input.length) {
      if (input[i] === '@') {
        let best: Member | null = null
        for (const m of boardMembers) {
          const candidate = '@' + m.name
          if (input.startsWith(candidate, i) && (!best || m.name.length > best.name.length)) {
            best = m
          }
        }
        if (best) {
          const serverId = best.id === YOU_ID ? (store.currentUserId ?? best.id) : best.id
          result += `@[${serverId}|${best.name}]`
          i += best.name.length + 1
          continue
        }
      }
      result += input[i]
      i++
    }
    return result
  }

  const filteredMembers = boardMembers.filter((m) =>
    m.name.toLowerCase().includes(mentionQuery.toLowerCase()),
  )

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value
    setText(value)
    const cursor = e.target.selectionStart ?? value.length
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

  const handleReplyChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value
    setReplyText(value)
    const cursor = e.target.selectionStart ?? value.length
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
    (member: Member, target: 'main' | 'reply') => {
      const input = target === 'main' ? inputRef.current : replyInputRef.current
      if (!input) return
      const currentText = target === 'main' ? text : replyText
      const setTextFn = target === 'main' ? setText : setReplyText
      const cursor = mentionCursor || input.selectionStart || currentText.length
      const before = currentText.slice(0, cursor)
      const after = currentText.slice(cursor)
      const match = before.match(/@(\w*)$/)
      if (!match) return
      const start = cursor - match[0].length
      const serverId = member.id === YOU_ID ? (store.currentUserId ?? member.id) : member.id
      const newText = before.slice(0, start) + `@${member.name} ` + after
      setTextFn(newText)
      setMentionOpen(false)
      setTimeout(() => {
        const pos = start + `@[${serverId}] `.length
        input.setSelectionRange(pos, pos)
        input.focus()
      }, 0)
    },
    [text, replyText, mentionCursor, store.currentUserId],
  )

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>, target: 'main' | 'reply', parentId: string | null) => {
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
        insertMention(filteredMembers[mentionIndex], target)
        return
      }
      if (e.key === 'Escape') {
        setMentionOpen(false)
        return
      }
    }
    if (e.key === 'Enter' && !mentionOpen) {
      e.preventDefault()
      if (target === 'main') submit(null)
      else if (parentId) submit(parentId, replyText)
    }
    if (e.key === 'Escape' && target === 'reply') {
      setReplyTo(null)
      setReplyText('')
    }
  }

  const submit = (parentId: string | null = null, body?: string) => {
    const raw = (body ?? text).trim()
    if (!raw) return
    const t = toStructured(raw)
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

  const canDeleteComment = (comment: { authorId: string }) =>
    !readOnly &&
    (comment.authorId === YOU_ID || comment.authorId === store.currentUserId)

  // Replying to a reply joins the same thread and pre-fills a mention of the
  // person being replied to.
  const startReply = (comment: typeof card.comments[number]) => {
    const threadId = comment.parentId ?? comment.id
    if (replyTo === threadId) {
      setReplyTo(null)
      setReplyText('')
      return
    }
    setReplyTo(threadId)
    const isMe = comment.authorId === YOU_ID || comment.authorId === store.currentUserId
    const authorName =
      boardMembers.find((m) => m.id === comment.authorId)?.name ||
      store.data.members[comment.authorId]?.name ||
      (isMe ? 'You' : 'Unknown')
    setReplyText(comment.parentId && !isMe ? `@${authorName} ` : '')
  }

  const deleteComment = (commentId: string) => {
    const next = card.comments.filter((c) => c.id !== commentId && c.parentId !== commentId)
    store.updateCard(card.id, { comments: next })
    store.addActivity(card.id, 'deleted a comment')
  }

  // Close mention popover on outside click
  useEffect(() => {
    if (!mentionOpen) return
    const handler = (e: MouseEvent) => {
      const target = e.target as Node
      if (inputRef.current?.contains(target)) return
      if (replyInputRef.current?.contains(target)) return
      if ((target as Element)?.closest?.('[data-mention-popover]')) return
      setMentionOpen(false)
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

  const topLevelComments = card.comments.filter(
    (c) => !c.parentId || !card.comments.some((p) => p.id === c.parentId),
  )

  const renderMentionText = (text: string, members: Member[]) =>
    parseMentions(text).map((part, i) =>
      part.type === 'mention' && part.userId ? (
        <MentionChip key={i} userId={part.userId} name={part.name} members={members} currentUserId={store.currentUserId} />
      ) : (
        <span key={i}>{part.value}</span>
      ),
    )

  const renderComment = (comment: typeof card.comments[number]) => {
    const author =
      store.data.members[comment.authorId] ??
      boardMembers.find((m) => m.id === comment.authorId) ?? {
        id: comment.authorId,
        name: comment.authorId === store.currentUserId || comment.authorId === YOU_ID ? 'You' : 'Unknown',
        color: '#3971B8',
      }
    const reactionEntries = Object.entries(comment.reactions).filter(([, c]) => c > 0)
    const pickerOpen = activePicker === comment.id

    return (
      <div key={comment.id} ref={(el) => { commentRefs.current[comment.id] = el }} className="flex items-start gap-2 rounded-lg transition-all">
        <Avatar member={author} size={36} />
        <div className="min-w-0 flex-1">
          <div className="rounded-2xl bg-brand-vanilla/15 px-4 py-3 dark:bg-brand-vanilla/10">
            <div className="flex items-baseline gap-2">
              <span className="font-heading text-sm font-semibold text-text-primary">{author.name}</span>
              <span className="font-mono text-[11px] text-text-muted">{formatDateTime(comment.createdAt)}</span>
            </div>
            <p className="mt-0.5 whitespace-pre-wrap break-words text-sm leading-relaxed text-text-primary">
              {renderMentionText(comment.text, boardMembers)}
            </p>
          </div>

          {/* Action row */}
          {!readOnly && (
            <div className="mt-1 flex items-center gap-3.5 text-xs text-text-muted">
              <button
                type="button"
                onClick={() => setActivePicker(pickerOpen ? null : comment.id)}
                className="inline-flex items-center gap-1 transition-colors hover:text-text-secondary"
              >
                <SmilePlus size={13} />
              </button>
              <button
                type="button"
                onClick={() => startReply(comment)}
                className="font-medium transition-colors hover:text-text-secondary"
              >
                Reply
              </button>
              {canDeleteComment(comment) && (
                <button
                  type="button"
                  onClick={() => deleteComment(comment.id)}
                  className="inline-flex items-center gap-1 transition-colors hover:text-danger-text"
                >
                  <Trash2 size={13} />
                </button>
              )}
            </div>
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
        </div>
      </div>
    )
  }

  return (
    <section>
      <SectionLabel icon={<MessageSquare size={14} />}>Comments</SectionLabel>

      {!readOnly && (
      <div className="relative mt-2 flex items-start gap-2">
        {you && <Avatar member={you} size={36} />}
        <div className="relative flex-1">
          <input
            ref={inputRef}
            value={text}
            onChange={handleChange}
            onKeyDown={(e) => handleKeyDown(e, 'main', null)}
            placeholder="Write a comment…"
            className="w-full rounded-2xl border border-border-strong bg-surface px-4 py-3 text-sm text-text-primary outline-none transition-colors duration-150 placeholder:text-text-muted focus:border-primary focus:ring-2 focus:border-primary/20"
          />
          {mentionOpen && filteredMembers.length > 0 && (
            <div data-mention-popover className="absolute bottom-full left-0 z-30 mb-1 max-h-48 w-64 overflow-y-auto rounded-lg border border-border bg-surface-elevated shadow-subtle">
              {filteredMembers.map((member, i) => (
                <button
                  key={member.id}
                  type="button"
                  onClick={() => insertMention(member, 'main')}
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
          {text.trim() && text.includes('@') && (
            <div className="mt-1 px-4 text-xs text-text-muted">
              {renderMentionText(toStructured(text), boardMembers)}
            </div>
          )}
        </div>
      </div>
      )}

      <div className="mt-3 space-y-4">
        {topLevelComments.length === 0 && (
          <p className="text-xs text-text-muted">No comments yet.</p>
        )}
        {topLevelComments.map((comment) => {
          const replies = card.comments.filter((c) => c.parentId === comment.id)
          const collapsed = !expandedThreads[comment.id] && replies.length > 3
          const visibleReplies = collapsed ? replies.slice(-2) : replies
          const hiddenCount = replies.length - visibleReplies.length

          return (
            <div key={comment.id} className="space-y-4">
              {renderComment(comment)}
              {hiddenCount > 0 && (
                <button
                  type="button"
                  onClick={() => setExpandedThreads((prev) => ({ ...prev, [comment.id]: true }))}
                  className="ml-11 text-xs font-medium text-primary-hover hover:underline"
                >
                  View {hiddenCount} earlier {hiddenCount === 1 ? 'reply' : 'replies'}
                </button>
              )}
              {visibleReplies.map((reply) => renderComment(reply))}
              {replyTo === comment.id && !readOnly && (
                <div className="relative flex items-start gap-2">
                  {you && <Avatar member={you} size={36} />}
                  <div className="relative flex-1">
                    <input
                      ref={replyInputRef}
                      autoFocus
                      value={replyText}
                      onChange={handleReplyChange}
                      onKeyDown={(e) => handleKeyDown(e, 'reply', comment.id)}
                      placeholder="Write a reply…"
                      className="w-full rounded-2xl border border-border-strong bg-surface px-4 py-2.5 text-sm text-text-primary outline-none transition-colors duration-150 placeholder:text-text-muted focus:border-primary focus:ring-2 focus:border-primary/20"
                    />
                    {mentionOpen && filteredMembers.length > 0 && (
                      <div data-mention-popover className="absolute bottom-full left-0 z-30 mb-1 max-h-48 w-64 overflow-y-auto rounded-lg border border-border bg-surface-elevated shadow-subtle">
                        {filteredMembers.map((member, i) => (
                          <button
                            key={member.id}
                            type="button"
                            onClick={() => insertMention(member, 'reply')}
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
                      {replyText.trim() && replyText.includes('@') && (
                        <div className="mt-1 px-4 text-xs text-text-muted">
                          {renderMentionText(toStructured(replyText), boardMembers)}
                        </div>
                      )}
                  </div>
                  <button
                    type="button"
                    onClick={() => submit(comment.id, replyText)}
                    disabled={!replyText.trim()}
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground transition-colors duration-150 hover:bg-primary-hover disabled:opacity-40"
                  >
                    <Send size={14} />
                  </button>
                  <button
                    type="button"
                    onClick={() => { setReplyTo(null); setReplyText('') }}
                    className="text-xs text-text-muted transition-colors hover:text-text-secondary"
                  >
                    Cancel
                  </button>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </section>
  )
}