import { afterEach, describe, expect, it } from 'vitest'
import { loadSession, signOut } from './google.ts'

const KEY = 'travel-hub.session'

afterEach(() => localStorage.clear())

describe('loadSession', () => {
  it('returns a saved session that is still valid', () => {
    const s = { token: 't', expires: Date.now() + 3_600_000, email: 'a@example.com' }
    localStorage.setItem(KEY, JSON.stringify(s))
    expect(loadSession()).toEqual(s)
  })

  it('drops a session that is about to expire', () => {
    localStorage.setItem(KEY, JSON.stringify({ token: 't', expires: Date.now() + 30_000, email: 'a@example.com' }))
    expect(loadSession()).toBeNull()
  })

  it('ignores missing or broken data', () => {
    expect(loadSession()).toBeNull()
    localStorage.setItem(KEY, '{not json')
    expect(loadSession()).toBeNull()
    localStorage.setItem(KEY, JSON.stringify({ token: 't', expires: Date.now() + 3_600_000 }))
    expect(loadSession()).toBeNull()
  })
})

describe('signOut', () => {
  it('ends the suite: Skyhop and MyMaps AI copies of the same token go too, other accounts stay', async () => {
    const s = { token: 't', expires: Date.now() + 3_600_000, email: 'a@example.com' }
    localStorage.setItem(KEY, JSON.stringify(s))
    localStorage.setItem('skyhop.google', JSON.stringify({ token: 't', until: s.expires, email: s.email }))
    localStorage.setItem('mymaps-ai.google-token', JSON.stringify({ value: 'other', expires: s.expires }))
    await signOut(s)
    expect(localStorage.getItem(KEY)).toBeNull()
    expect(localStorage.getItem('skyhop.google')).toBeNull()
    expect(localStorage.getItem('mymaps-ai.google-token')).not.toBeNull()
  })
})
