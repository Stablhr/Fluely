'use client'

import { useState } from 'react'
import { Sparkles, X } from 'lucide-react'
import { suggestCaption } from '@/lib/kali/utils/aiCaptions'
import Button from '../shared/Button'
import { Textarea } from '../shared/Input'

interface AIGenerateModalProps {
  onUse: (caption: string) => void
  onClose: () => void
}

export default function AIGenerateModal({ onUse, onClose }: AIGenerateModalProps) {
  const [prompt, setPrompt] = useState('')
  const [result, setResult] = useState<string | null>(null)

  const handleGenerate = () => {
    if (!prompt.trim()) return
    setResult(suggestCaption(prompt))
  }

  const handleUse = () => {
    if (result) onUse(result)
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-3" role="dialog" aria-modal="true" aria-labelledby="ai-modal-title">
      <div className="animate-overlay absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="animate-in relative z-10 flex w-full max-w-lg flex-col rounded-[14px] border border-border bg-surface shadow-modal">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <div className="flex items-center gap-2">
            <Sparkles size={16} className="text-primary" />
            <h2 id="ai-modal-title" className="text-sm font-semibold text-text-primary">Caption ideas</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close caption ideas"
            className="rounded p-1 text-text-muted hover:text-text-primary"
          >
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <div className="space-y-4 p-4">
          <p className="rounded-md bg-surface-alt px-3 py-2 text-[11px] leading-snug text-text-secondary">
            These are example captions picked to match your topic, not written by AI. AI writing is coming later.
          </p>
          <div>
            <label htmlFor="ai-prompt" className="text-[11px] font-semibold text-text-secondary">Prompt</label>
            <Textarea
              id="ai-prompt"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="Describe what you want to caption... e.g. 'product launch for new feature'"
              rows={3}
              className="mt-1"
            />
          </div>

          <Button
            variant="primary"
            onClick={handleGenerate}
            disabled={!prompt.trim()}
            className="w-full"
          >
            <span className="flex items-center gap-2">
              <Sparkles size={14} />
              Suggest a caption
            </span>
          </Button>

          {result !== null && (
            <div className="rounded-lg border border-primary/30 bg-primary-subtle p-3" role="region" aria-live="polite" aria-label="Suggested caption">
              <p className="text-[11px] font-semibold text-primary-text mb-1.5">Suggested caption</p>
              <p className="text-sm leading-relaxed text-text-primary whitespace-pre-wrap">{result}</p>
              <div className="mt-3 flex gap-2">
                <Button variant="primary" size="sm" onClick={handleUse}>
                  Use This Caption
                </Button>
                <Button variant="ghost" size="sm" onClick={() => setResult(null)}>
                  Another idea
                </Button>
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  )
}
