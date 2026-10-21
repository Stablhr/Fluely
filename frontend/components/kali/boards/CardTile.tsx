'use client'

import { memo } from 'react'
import { Draggable } from '@hello-pangea/dnd'
import { Check, Eye, MessageSquare, Paperclip, CalendarDays } from 'lucide-react'
import type { Card } from '@/lib/kali/store/schema'
import { useStore } from '@/lib/kali/store/useStore'
import { formatDate, getUrgency } from '@/lib/kali/utils/dates'
import LabelChip from '../shared/Chip'
import Avatar from '../shared/Avatar'

interface CardTileProps {
  card: Card
  index: number
  onOpenCard: (cardId: string) => void
}

/**
 * The single card tile used by every list/column view.
 *
 * Cover images are rendered flush against the card's top edge, radius-clipped
 * by the card shell, with the title and metadata below -- nothing is layered
 * over the image. Cards without a cover are fully rounded.
 *
 * The cover keeps the original sizing: a portrait band for the default
 * "large" size and a thin strip for "small", the size the cover panel picks.
 */
function CardTile({ card, index, onOpenCard }: CardTileProps) {
  const { data, canWrite, getBoardMembers } = useStore()
  const mayWrite = canWrite(card.boardId)
  const board = data.boards[card.boardId]
  const labels = (card.labelIds
    .map((id) => board?.labels[id])
    .filter(Boolean)) as NonNullable<typeof board>['labels'][string][]
  const memberById = new Map(
    getBoardMembers(card.boardId).map((member) => [member.id, member]),
  )
  const members = card.memberIds
    .map((id) => memberById.get(id) ?? data.members[id])
    .filter(Boolean) as typeof data.members[string][]
  const extraLabels = labels.length > 4 ? labels.length - 4 : 0

  const explicitImageCover =
    card.cover && typeof card.cover !== 'string' && card.cover.type === 'image'
      ? card.cover.dataUrl
      : null
  // An attached image with no explicit cover still reads as the card's cover.
  const imageCover =
    explicitImageCover ??
    card.files.find((file) => file.type === 'image')?.dataUrl ??
    null
  const colorCover = typeof card.cover === 'string' ? card.cover : null
  // The old cover sizing is back: "large" is a portrait band, "small" is a thin
  // strip. A cover that was only ever an attachment has no explicit size and
  // always shows the portrait band.
  const coverStrip = explicitImageCover !== null && card.coverSize === 'small'

  const hasMeta =
    Boolean(card.dueDate) ||
    card.files.length > 0 ||
    card.comments.length > 0 ||
    card.watching ||
    members.length > 0

  return (
    <Draggable draggableId={card.id} index={index} isDragDisabled={!mayWrite}>
      {(provided, snapshot) => (
        <div
          ref={provided.innerRef}
          {...provided.draggableProps}
          {...provided.dragHandleProps}
          onClick={() => !snapshot.isDragging && onOpenCard(card.id)}
          className={`relative flex flex-col overflow-hidden rounded-xl ring-1 transition-shadow duration-150 ${
            mayWrite ? 'cursor-pointer' : 'cursor-default'
          } ${
            snapshot.isDragging
              ? 'z-50 opacity-95 ring-primary shadow-medium'
              : 'ring-[var(--color-card-border)] hover:shadow-subtle hover:ring-[var(--color-card-border-strong)]'
          }`}
          style={{
            ...provided.draggableProps.style,
            background: 'var(--color-card-surface)',
            color: 'var(--color-card-text)',
            borderColor: snapshot.isDragging ? undefined : 'var(--color-card-border)',
          }}
        >
          {imageCover ? (
            <div
              className={`w-full shrink-0 overflow-hidden bg-black/10 ${
                coverStrip ? 'h-8' : ''
              }`}
            >
              <img
                src={imageCover}
                alt=""
                className={`block w-full object-cover ${
                  coverStrip ? 'h-8' : 'aspect-[4/5]'
                }`}
                draggable={false}
              />
            </div>
          ) : colorCover ? (
            <div
              className="h-8 w-full shrink-0"
              style={{ background: colorCover }}
            />
          ) : null}

          <div className="flex min-w-0 flex-col p-2.5">
            {labels.length > 0 && (
              <div className="mb-1.5 flex flex-wrap gap-1">
                {labels.slice(0, 4).map((label) => (
                  <LabelChip key={label.id} label={label} />
                ))}
                {extraLabels > 0 && (
                  <span
                    className="rounded-full px-1.5 py-0.5 font-mono text-[10px] font-medium"
                    style={{
                      background: 'var(--color-card-surface-alt)',
                      color: 'var(--color-card-text-secondary)',
                    }}
                  >
                    +{extraLabels}
                  </span>
                )}
              </div>
            )}

            <div className="flex items-start gap-1.5">
              {card.done && (
                <span
                  className="mt-0.5 inline-flex h-[15px] w-[15px] shrink-0 items-center justify-center rounded-full bg-success text-white"
                  title="Completed"
                  aria-label="Completed"
                >
                  <Check size={10} strokeWidth={3.5} />
                </span>
              )}
              <p
                className={`min-w-0 break-words text-[14px] font-semibold leading-snug ${
                  card.done ? 'line-through' : ''
                }`}
                style={{
                  color: card.done
                    ? 'var(--color-card-text-muted)'
                    : 'var(--color-card-text)',
                }}
              >
                {card.title}
              </p>
            </div>

            {hasMeta && (
              <div
                className="mt-2 flex min-w-0 items-center gap-2 leading-none"
                style={{ color: 'var(--color-card-text-secondary)' }}
              >
                {card.dueDate && (
                  <span
                    className={`inline-flex items-center gap-1 text-[11px] font-medium ${
                      getUrgency(card.dueDate) === 'overdue'
                        ? 'text-danger-text'
                        : getUrgency(card.dueDate) === 'soon'
                          ? 'text-warning-text'
                          : ''
                    }`}
                    title={`Due ${formatDate(card.dueDate)}`}
                  >
                    <CalendarDays size={12} />
                    {formatDate(card.dueDate)}
                  </span>
                )}
                {card.files.length > 0 && (
                  <span className="inline-flex items-center gap-1 font-mono text-[11px]">
                    <Paperclip size={12} />
                    {card.files.length}
                  </span>
                )}
                {card.comments.length > 0 && (
                  <span className="inline-flex items-center gap-1 font-mono text-[11px]">
                    <MessageSquare size={12} />
                    {card.comments.length}
                  </span>
                )}
                {card.watching && (
                  <Eye size={12} style={{ color: '#10c4bb' }} aria-label="Watching" />
                )}

                {members.length > 0 && (
                  <span className="ml-auto flex -space-x-1">
                    {members.slice(0, 3).map((member, memberIndex) => (
                      <Avatar
                        key={member.id}
                        member={member}
                        stacked={memberIndex > 0}
                      />
                    ))}
                  </span>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </Draggable>
  )
}

export default memo(CardTile)
