'use client'

import { ImageIcon, X } from 'lucide-react'
import type { Card } from '@/lib/kali/store/schema'
import { useStore } from '@/lib/kali/store/useStore'
import SectionLabel from '../shared/SectionLabel'

interface CardCoverProps {
  card: Card
  onOpenPanel: () => void
}

export default function CardCover({ card, onOpenPanel }: CardCoverProps) {
  const { updateCard, addActivity } = useStore()

  return (
    <section>
      <SectionLabel icon={<ImageIcon size={14} />}>Cover</SectionLabel>

      <div className="mt-2 space-y-2">
        <button
          type="button"
          onClick={onOpenPanel}
          className="inline-flex items-center gap-1.5 rounded-md bg-surface-alt px-2.5 py-1.5 text-xs font-semibold text-text-secondary transition-colors duration-150 hover:bg-primary-subtle hover:text-primary-hover active:scale-[0.98]"
        >
          <ImageIcon size={13} />
          Change cover
        </button>

        {card.cover && (
          <button
            type="button"
            onClick={() => {
              updateCard(card.id, { cover: null, coverSize: 'small' })
              addActivity(card.id, 'removed the cover')
            }}
            className="flex items-center gap-1 text-xs font-semibold text-text-secondary transition-colors duration-150 hover:text-danger-text"
          >
            <X size={12} />
            Remove cover
          </button>
        )}
      </div>
    </section>
  )
}
