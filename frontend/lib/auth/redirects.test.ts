import { afterEach, describe, expect, it, vi } from 'vitest'
import { getPostAuthPath, getSafeRedirect, withRedirect } from './redirects'

/** Pretends the browser is on `/sign-in` with the given query string. */
function onPage(search: string) {
  vi.stubGlobal('window', { location: { search, origin: 'https://fluely.test' } })
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('after sign-in, only same-site paths are followed', () => {
  it('follows a path on this site, such as an invite link', () => {
    onPage(`?redirect=${encodeURIComponent('/invite?token=abc')}`)
    expect(getSafeRedirect()).toBe('/invite?token=abc')
    expect(getPostAuthPath('user')).toBe('/invite?token=abc')
  })

  it.each([
    ['another site', 'https://evil.example'],
    ['a protocol-relative address', '//evil.example'],
    ['a backslash trick', String.raw`/\evil.example`],
    ['a tab the browser strips', '/\t/evil.example'],
    ['a newline the browser strips', '/\n/evil.example'],
    ['a relative path', 'invite'],
  ])('refuses %s and goes to the dashboard', (_label, target) => {
    onPage(`?redirect=${encodeURIComponent(target)}`)
    expect(getSafeRedirect()).toBeNull()
    expect(getPostAuthPath('user')).toBe('/')
    expect(getPostAuthPath('admin')).toBe('/admin/dashboard')
  })

  it('carries a safe redirect onto the next auth page', () => {
    onPage(`?redirect=${encodeURIComponent('/invite?token=abc')}`)
    expect(withRedirect('/sign-up')).toBe('/sign-up?redirect=%2Finvite%3Ftoken%3Dabc')
    onPage('')
    expect(withRedirect('/sign-up')).toBe('/sign-up')
  })
})
