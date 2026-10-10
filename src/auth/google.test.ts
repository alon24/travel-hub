import { afterEach, describe, expect, it } from 'vitest'
import { loadSession } from './google.ts'

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
