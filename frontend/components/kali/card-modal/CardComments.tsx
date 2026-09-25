'use client'

import { useRef, useState } from 'react'
import { MessageSquare, SmilePlus } from 'lucide-react'
import EmojiPicker, { Theme } from 'emoji-picker-react'
import type { Card } from '@/lib/kali/store/schema'
import { YOU_ID } from '@/lib/kali/store/schema'
import { useStore } from '@/lib/kali/store/useStore'
import { uid } from '@/lib/kali/utils/id'
import { formatDateTime } from '@/lib/kali/utils/dates'
import { hasUserCommentReaction, toggleUserCommentReaction } from '@/lib/kali/utils/reactions'
import SectionLabel from '../shared/SectionLabel'
import Avatar from '../shared/Avatar'

export default function CardComments({ card }: { card: Card }) {
  const store = useStore()
  const [text, setText] = useState('')
  const [activePicker, setActivePicker] = useState<string | null>(null)
  const pickerRef = useRef<HTMLDivElement>(null)
  const you = store.data.members[YOU_ID]

  const submit = () => {
    const t = text.trim()
    if (!t) return
    store.updateCard(card.id, {
      comments: [
        ...card.comments,
        { id: uid(), authorId: YOU_ID, text: t, reactions: {}, createdAt: new Date().toISOString() },
      ],
    })
    store.addActivity(card.id, 'added a comment')
    setText('')
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

  return (
    <section>
      <SectionLabel icon={<MessageSquare size={14} />}>Comments</SectionLabel>

      <div className="mt-2 flex items-start gap-2">
        {you && <Avatar member={you} size={24} />}
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') submit()
          }}
          placeholder="Write a comment…"
          className="flex-1 rounded-md border border-border-strong bg-surface px-3 py-2 text-sm text-text-primary outline-none transition-colors duration-150 placeholder:text-text-muted focus:border-primary focus:ring-2 focus:ring-primary/20"
        />
      </div>

      <div className="mt-3 space-y-3">
        {card.comments.map((comment) => {
          const author = store.data.members[comment.authorId]
          if (!author) return null
          const reactionEntries = Object.entries(comment.reactions).filter(([, c]) => c > 0)
          const pickerOpen = activePicker === comment.id

          return (
            <div key={comment.id} className="flex items-start gap-2">
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
                    {comment.text}
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

                <div className="relative mt-1" ref={pickerRef}>
                  <button
                    type="button"
                    onClick={() => setActivePicker(pickerOpen ? null : comment.id)}
                    aria-label="Add reaction"
                    className="inline-flex items-center gap-1 rounded-md p-1 text-text-muted transition-colors duration-150 hover:bg-surface-alt hover:text-text-secondary"
                    title="Add reaction"
                  >
                    <SmilePlus size={14} />
                  </button>

                  {pickerOpen && (
                    <div className="absolute left-0 top-8 z-30 max-w-[min(320px,100%)] animate-in">
                      <EmojiPicker
                        onEmojiClick={(emojiData) => {
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
