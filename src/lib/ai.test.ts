import { afterEach, describe, expect, it, vi } from 'vitest'
import { aiEnabled, askAi } from './ai.ts'

const env = { VITE_WORKER_URL: 'https://worker.example.dev/' }
const ok = (content: unknown) => new Response(JSON.stringify({ choices: [{ message: { content } }] }), { status: 200 })

afterEach(() => vi.unstubAllGlobals())

describe('askAi', () => {
  it('is off without a Worker URL', async () => {
    expect(aiEnabled({ VITE_WORKER_URL: '' })).toBe(false)
    await expect(askAi('s', [], {}, { VITE_WORKER_URL: '' })).rejects.toThrow(/not set up/)
  })

  it('posts to the Worker, never to OpenRouter, and returns the answer', async () => {
    const fetch = vi.fn().mockResolvedValue(ok('Rome in March is mild.'))
    vi.stubGlobal('fetch', fetch)
    const answer = await askAi('You plan trips', [{ role: 'user', content: 'Weather?' }], { googleToken: 'g' }, env)
    expect(answer).toBe('Rome in March is mild.')
    const [url, init] = fetch.mock.calls[0]
    expect(url).toBe('https://worker.example.dev/ai')
    expect(init.headers.Authorization).toBe('Bearer g')
    expect(JSON.parse(init.body)).toEqual({ system: 'You plan trips', messages: [{ role: 'user', content: 'Weather?' }] })
  })

  it('prefers the admin key over Google sign-in', async () => {
    const fetch = vi.fn().mockResolvedValue(ok('x'))
    vi.stubGlobal('fetch', fetch)
    await askAi('s', [], { appToken: 'admin', googleToken: 'g' }, env)
    expect(fetch.mock.calls[0][1].headers).toMatchObject({ 'X-App-Token': 'admin' })
    expect(fetch.mock.calls[0][1].headers.Authorization).toBeUndefined()
  })

  it('explains 401 and upstream errors', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('', { status: 401 })))
    await expect(askAi('s', [], {}, env)).rejects.toMatchObject({ status: 401 })
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ error: 'openrouter returned 500' }), { status: 502 })))
    await expect(askAi('s', [], {}, env)).rejects.toThrow('AI error 502: openrouter returned 500')
  })

  it('rejects a malformed answer', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(ok(42)))
    await expect(askAi('s', [], {}, env)).rejects.toMatchObject({ status: 502 })
  })
})
