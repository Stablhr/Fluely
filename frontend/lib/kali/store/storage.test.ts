import { beforeEach, describe, expect, it, vi } from 'vitest'
import { loadSocialPosts, socialPostsKey } from './storage'

/** A minimal localStorage, so these run without a browser. */
function fakeStorage() {
  const data = new Map<string, string>()
  return {
    getItem: (k: string) => (data.has(k) ? data.get(k)! : null),
    setItem: (k: string, v: string) => void data.set(k, String(v)),
    removeItem: (k: string) => void data.delete(k),
    clear: () => data.clear(),
    has: (k: string) => data.has(k),
  }
}

const cache = (ids: string[]) => JSON.stringify({ version: 1, data: ids.map((id) => ({ id, title: id })) })
let storage: ReturnType<typeof fakeStorage>

beforeEach(() => {
  storage = fakeStorage()
  vi.stubGlobal('localStorage', storage)
})

describe('the old shared post cache from before per-account caches', () => {
  it('hands posts never sent to the server to the first account that opens the app', () => {
    storage.setItem('kali-social-posts', cache(['draft-1']))

    expect(loadSocialPosts('user-a').map((p) => p.id)).toEqual(['draft-1'])
    expect(storage.has('kali-social-posts')).toBe(false)
    // The next account on this browser does not see them.
    expect(loadSocialPosts('user-b')).toEqual([])
  })

  it('drops posts that were already sent to the server', () => {
    storage.setItem('kali-social-posts', cache(['synced-1']))
    storage.setItem('kali_social_posts_imported', '1')

    expect(loadSocialPosts('user-a')).toEqual([])
    expect(storage.has('kali-social-posts')).toBe(false)
  })

  it('never overwrites an account’s own cache', () => {
    storage.setItem(socialPostsKey('user-a'), cache(['mine']))
    storage.setItem('kali-social-posts', cache(['old']))

    expect(loadSocialPosts('user-a').map((p) => p.id)).toEqual(['mine'])
  })

  it('shows nothing when no one is signed in', () => {
    storage.setItem('kali-social-posts', cache(['draft-1']))
    expect(loadSocialPosts(null)).toEqual([])
    expect(storage.has('kali-social-posts')).toBe(true)
  })
})
