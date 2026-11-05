'use client'

import { Fragment, type ReactNode } from 'react'
import { tokenizeText } from '@/lib/kali/utils/linkify'
import { parsePreviewLine } from '@/lib/kali/utils/embed'
import LinkEmbed from './LinkEmbed'
import LinkCard from './LinkCard'

/**
 * Renders plain text with its URLs turned into links.
 *
 * The store keeps descriptions, comments and captions as plain strings, so the
 * original text is never modified — only the rendering changes. That keeps
 * server sync and existing records untouched.
 *
 * A line that is exactly one supported URL becomes an inline provider preview
 * or a compact link card; every other URL stays an ordinary link, so a preview
 * never appears mid-sentence.
 */

const LINK_CLASS =
  'rounded-sm text-primary-text underline underline-offset-2 transition-colors hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40'

/** Stops a single long description from mounting a wall of third-party frames. */
const MAX_PREVIEWS_PER_TEXT = 3

function renderTokens(text: string, interactive: boolean): ReactNode[] {
  return tokenizeText(text).map((token, index) => {
    if (token.type === 'text') {
      return <Fragment key={index}>{token.value}</Fragment>
    }

    if (!interactive) {
      // Inert stand-in for preview mocks: looks like a link, cannot navigate.
      return (
        <span key={index} className={LINK_CLASS}>
          {token.value}
        </span>
      )
    }

    return (
      <a
        key={index}
        href={token.href}
        target="_blank"
        rel="noopener noreferrer nofollow ugc"
        title={token.href}
        className={LINK_CLASS}
      >
        {token.value}
      </a>
    )
  })
}

function renderBody(text: string, interactive: boolean, embeds: boolean): ReactNode[] {
  const lines = text.split('\n')
  const nodes: ReactNode[] = []
  let previewCount = 0
  let previousWasPreview = false

  lines.forEach((line, index) => {
    const preview =
      embeds && previewCount < MAX_PREVIEWS_PER_TEXT ? parsePreviewLine(line) : null

    if (preview) {
      previewCount += 1
      previousWasPreview = true
      nodes.push(
        preview.kind === 'embed' ? (
          <LinkEmbed
            key={`embed-${index}`}
            descriptor={preview.descriptor}
            interactive={interactive}
          />
        ) : (
          <LinkCard
            key={`card-${index}`}
            href={preview.link.href}
            label={preview.link.value}
            interactive={interactive}
          />
        )
      )
      return
    }

    // A block-level preview already starts a new line, so keeping the source
    // newline beside it would render an empty line.
    if (index > 0 && !previousWasPreview) nodes.push('\n')

    nodes.push(<Fragment key={`line-${index}`}>{renderTokens(line, interactive)}</Fragment>)
    previousWasPreview = false
  })

  return nodes
}

/**
 * Just the token run, without a wrapper element. Use this inside a container
 * that already exists and whose markup must not change — comment bodies, for
 * example, where mention chips and text sit side by side.
 */
export function LinkText({ text, interactive = true }: { text: string; interactive?: boolean }) {
  if (!text) return null
  return <>{renderTokens(text, interactive)}</>
}

type RichTextTag = 'p' | 'div' | 'span'

interface RichTextProps {
  text: string
  as?: RichTextTag
  className?: string
  /** Set false inside preview mocks so a link cannot navigate away from the app. */
  interactive?: boolean
  /** Set false on surfaces that should only linkify (activity feeds). */
  embeds?: boolean
}

export default function RichText({
  text,
  as: Tag = 'p',
  className = '',
  interactive = true,
  embeds = true,
}: RichTextProps) {
  if (!text) return null

  return (
    <Tag className={`whitespace-pre-wrap break-words ${className}`.trim()}>
      {renderBody(text, interactive, embeds)}
    </Tag>
  )
}
