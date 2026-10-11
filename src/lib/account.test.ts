import { afterEach, describe, expect, it, vi } from 'vitest'
import { AccountApi, AccountError, cachedRole } from './account.ts'

const W = 'https://worker.test/'
const reply = (status: number, body: unknown) => vi.fn(async () => new Response(JSON.stringify(body), { status }))

afterEach(() => localStorage.clear())

describe('AccountApi.role', () => {
  it('asks the Worker with the Google token and remembers the answer', async () => {
    const f = reply(200, { email: 'a@x.com', role: 'admin' })
    expect(await new AccountApi(W, 'tok', f).role('a@x.com')).toBe('admin')
    const [url, init] = f.mock.calls[0] as unknown as [string, RequestInit]
    expect(url).toBe('https://worker.test/me')
    expect(init.headers).toMatchObject({ Authorization: 'Bearer tok', 'X-App': 'hub' })
    expect(cachedRole('a@x.com')).toBe('admin')
    expect(cachedRole('b@x.com')).toBeNull()
  })

  it('returns null for an account that is not on the list, and forgets its old role', async () => {
    localStorage.setItem('travel-hub.role', JSON.stringify({ email: 'a@x.com', role: 'user' }))
    expect(await new AccountApi(W, 'tok', reply(401, { error: 'unauthorized' })).role('a@x.com')).toBeNull()
    expect(cachedRole('a@x.com')).toBeNull()
  })

  it('offline, falls back to the last role of the same account', async () => {
    localStorage.setItem('travel-hub.role', JSON.stringify({ email: 'a@x.com', role: 'user' }))
    const down = vi.fn(async () => {
      throw new TypeError('Failed to fetch')
    })
    expect(await new AccountApi(W, 'tok', down).role('a@x.com')).toBe('user')
    await expect(new AccountApi(W, 'tok', down).role('b@x.com')).rejects.toThrow('Could not reach the server')
  })
})

describe('admin calls', () => {
  it('sends the right requests and surfaces the Worker error text', async () => {
    const f = reply(200, { user: { email: 'n@x.com', role: 'user' } })
    const api = new AccountApi(W, 'tok', f)
    await api.addUser('n@x.com', 'user')
    let [url, init] = f.mock.calls[0] as unknown as [string, RequestInit]
    expect([url, init.method, init.body]).toEqual(['https://worker.test/admin/users', 'POST', '{"email":"n@x.com","role":"user"}'])

    await api.removeUser('n+1@x.com')
    ;[url, init] = f.mock.calls[1] as unknown as [string, RequestInit]
    expect([url, init.method]).toEqual(['https://worker.test/admin/users?email=n%2B1%40x.com', 'DELETE'])

    await api.audit({ email: 'n@x.com', before: 40, limit: 50 })
    expect((f.mock.calls[2] as unknown as [string])[0]).toBe('https://worker.test/admin/audit?email=n%40x.com&before=40&limit=50')

    const bad = new AccountApi(W, 'tok', reply(400, { error: 'invalid email' }))
    await expect(bad.addUser('nope', 'user')).rejects.toEqual(new AccountError('invalid email', 400))
  })
})
