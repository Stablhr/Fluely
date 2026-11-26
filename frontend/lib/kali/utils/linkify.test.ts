import { describe, expect, it } from 'vitest'
import { toHref, tokenizeText } from './linkify'

describe('links in descriptions and comments', () => {
  it('links a web address and leaves the full stop after it as text', () => {
    expect(tokenizeText('See https://example.com/a.')).toEqual([
      { type: 'text', value: 'See ' },
      { type: 'link', value: 'https://example.com/a', href: 'https://example.com/a' },
      { type: 'text', value: '.' },
    ])
  })

  it('adds https to a www. address', () => {
    expect(toHref('www.example.com')).toBe('https://www.example.com/')
  })

  it('never makes a link from a script or data address', () => {
    expect(toHref('javascript:alert(1)')).toBeNull()
    expect(toHref('data:text/html,hi')).toBeNull()
    expect(tokenizeText('javascript:alert(1)')).toEqual([{ type: 'text', value: 'javascript:alert(1)' }])
  })

  it('keeps brackets that belong to the address', () => {
    const [, link] = tokenizeText('(see https://en.wikipedia.org/wiki/Foo_(bar))')
    expect(link).toMatchObject({ type: 'link', value: 'https://en.wikipedia.org/wiki/Foo_(bar)' })
  })
})
