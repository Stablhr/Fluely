'use client'

import { useState } from 'react'
import { Sparkles, X, Coins } from 'lucide-react'
import { generateMockCaption, MOCK_MODELS, getTokenUsage, MOCK_MONTHLY_TOKEN_LIMIT } from '@/lib/kali/utils/aiCaptions'
import Button from '../shared/Button'
import { Textarea } from '../shared/Input'

interface AIGenerateModalProps {
  onUse: (caption: string) => void
  onClose: () => void
}

export default function AIGenerateModal({ onUse, onClose }: AIGenerateModalProps) {
  const [prompt, setPrompt] = useState('')
  const [selectedModel, setSelectedModel] = useState<string>(MOCK_MODELS[0])
  const [result, setResult] = useState<string | null>(null)
  const [generating, setGenerating] = useState(false)
  const [tokenUsage, setTokenUsage] = useState(getTokenUsage())

  const handleGenerate = () => {
    if (!prompt.trim()) return
    setGenerating(true)
    // Simulate API delay
    setTimeout(() => {
      const res = generateMockCaption(prompt)
      setResult(res.caption)
      const newUsage = getTokenUsage() + res.tokensUsed
      setTokenUsage(newUsage)
      setGenerating(false)
    }, 800)
  }

  const handleUse = () => {
    if (result) onUse(result)
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-3" role="dialog" aria-modal="true" aria-labelledby="ai-modal-title">
      <div className="absolute inset-0 bg-[#0f1a19]/50" onClick={onClose} />
      <div className="animate-in relative z-10 flex w-full max-w-lg flex-col rounded-[14px] border border-border bg-surface shadow-modal">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <div className="flex items-center gap-2">
            <Sparkles size={16} className="text-primary" />
            <h2 id="ai-modal-title" className="text-sm font-semibold text-text-primary">AI Caption Generator</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close AI generator"
            className="rounded p-1 text-text-muted hover:text-text-primary"
          >
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <div className="space-y-4 p-4">
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

          <div className="flex flex-wrap items-center gap-3">
            <div className="flex-1">
              <label htmlFor="ai-model" className="text-[11px] font-semibold text-text-secondary">Model</label>
              <select
                id="ai-model"
                value={selectedModel}
                onChange={(e) => setSelectedModel(e.target.value)}
                aria-label="Select AI model"
                className="mt-1 w-full rounded-md border border-border-strong bg-surface px-2.5 py-1.5 text-sm text-text-primary outline-none focus:border-primary"
              >
                {MOCK_MODELS.map((m) => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
            </div>
            <div className="flex items-center gap-1.5 rounded-md bg-surface-alt px-2.5 py-1.5" aria-label="Token usage">
              <Coins size={13} className="text-text-muted" />
              <span className="text-[11px] font-mono text-text-secondary">
                {tokenUsage.toLocaleString()} / {MOCK_MONTHLY_TOKEN_LIMIT.toLocaleString()}
              </span>
            </div>
          </div>

          <Button
            variant="primary"
            onClick={handleGenerate}
            disabled={!prompt.trim() || generating}
            className="w-full"
          >
            {generating ? (
              <span className="flex items-center gap-2">
                <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                Generating...
              </span>
            ) : (
              <span className="flex items-center gap-2">
                <Sparkles size={14} />
                Generate Caption
              </span>
            )}
          </Button>

          {result !== null && (
            <div className="rounded-lg border border-primary/30 bg-primary-subtle p-3" role="region" aria-live="polite" aria-label="Generated caption result">
              <p className="text-[11px] font-semibold text-primary-text mb-1.5">Generated Caption</p>
              <p className="text-sm leading-relaxed text-text-primary whitespace-pre-wrap">{result}</p>
              <div className="mt-3 flex gap-2">
                <Button variant="primary" size="sm" onClick={handleUse}>
                  Use This Caption
                </Button>
                <Button variant="ghost" size="sm" onClick={() => setResult(null)}>
                  Regenerate
                </Button>
              </div>
            </div>
          )}

          <p className="text-[10px] text-text-muted text-center">
            This is a mock AI generator. In production, this would connect to OpenAI/Anthropic via a backend proxy.
          </p>
        </div>
      </div>
    </div>
  )
}
