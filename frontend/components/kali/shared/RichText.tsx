import { Fragment, type ReactNode } from 'react'
import { tokenizeText } from '@/lib/kali/utils/linkify'

/**
 * Renders plain text with its URLs turned into links.
 *
 * The store keeps descriptions, comments and captions as plain strings, so the
 * original text is never modified — only the rendering changes. That keeps
 * server sync and existing records untouched.
 */

const LINK_CLASS =
  'rounded-sm text-primary-text underline underline-offset-2 transition-colors hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40'

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
}

export default function RichText({
  text,
  as: Tag = 'p',
  className = '',
  interactive = true,
}: RichTextProps) {
  if (!text) return null

  return (
    <Tag className={`whitespace-pre-wrap break-words ${className}`.trim()}>
      <LinkText text={text} interactive={interactive} />
    </Tag>
  )
}
