'use client'

import { Library, Trash2, X, Image as ImageIcon, Film, Music } from 'lucide-react'
import { useMediaLibrary } from '@/lib/kali/feature-hooks/useMediaLibrary'
import type { SocialMediaAttachment } from '@/lib/kali/store/schema'

function TypeIcon({ type }: { type: string }) {
  if (type === 'video') return <Film size={13} className="text-text-muted" />
  if (type === 'audio') return <Music size={13} className="text-text-muted" />
  return <ImageIcon size={13} className="text-text-muted" />
}

export default function MediaLibraryPanel({
  onClose,
  onUse,
}: {
  onClose: () => void
  onUse?: (item: { dataUrl: string; name: string; type: string; platformCompat: SocialMediaAttachment['platformCompat'] }) => void
}) {
  const { items, removeFromLibrary } = useMediaLibrary()

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-[#0f1a19]/50" onClick={onClose} />
      <div className="animate-in relative z-10 flex h-full max-h-[620px] w-full max-w-md flex-col overflow-hidden rounded-[14px] border border-border bg-surface shadow-modal">
        <div className="flex items-center gap-2 border-b border-border px-4 py-3">
          <Library size={16} className="text-primary" />
          <h2 className="text-sm font-semibold text-text-primary">Media Library</h2>
          <span className="rounded-full bg-surface-alt px-2 py-0.5 font-mono text-[10px] text-text-secondary">{items.length}</span>
          <button type="button" onClick={onClose} aria-label="Close" className="ml-auto rounded p-1 text-text-muted hover:bg-surface-alt hover:text-text-primary">
            <X size={16} />
          </button>
        </div>

        <div className="scroll-slim flex-1 overflow-y-auto p-4">
          {items.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-12 text-text-muted">
              <Library size={24} />
              <p className="text-sm font-medium text-text-secondary">Library is empty</p>
              <p className="px-6 text-center text-xs">
                Uploaded media can be saved to the library and reused across posts.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-2">
              {items.map((item) => (
                <div key={item.id} className="group relative overflow-hidden rounded-lg border border-border">
                  {item.type === 'image' ? (
                    <img src={item.dataUrl} alt={item.name} className="h-24 w-full object-cover" />
                  ) : (
                    <div className="flex h-24 w-full flex-col items-center justify-center gap-1 bg-surface-alt">
                      <TypeIcon type={item.type} />
                      <span className="max-w-full truncate px-1 text-[9px] text-text-muted">{item.name}</span>
                    </div>
                  )}
                  <button
                    type="button"
                    onClick={() => removeFromLibrary(item.id)}
                    aria-label={`Remove ${item.name} from library`}
                    className="absolute right-1 top-1 rounded-full bg-black/50 p-1 text-white opacity-0 transition-opacity group-hover:opacity-100"
                  >
                    <Trash2 size={11} />
                  </button>
                  {onUse && (
                    <button
                      type="button"
                      onClick={() => onUse({ dataUrl: item.dataUrl, name: item.name, type: item.type, platformCompat: item.platformCompat })}
                      className="absolute inset-x-0 bottom-0 bg-primary/90 py-1 text-[10px] font-semibold text-primary-foreground opacity-0 transition-opacity group-hover:opacity-100"
                    >
                      Use
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
