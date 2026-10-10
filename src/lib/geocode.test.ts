import { describe, expect, it, vi } from 'vitest'
import { geocode } from './geocode.ts'

const ok = (body: unknown) => Promise.resolve(new Response(JSON.stringify(body), { status: 200 }))

describe('geocode', () => {
  it('returns [lng, lat] of the first hit, searching near the city', async () => {
    const f = vi.fn(() => ok([{ lat: '38.71', lon: '-9.13' }]))
    expect(await geocode('Alfama flat, Lisbon', [-9.13, 38.77], f as unknown as typeof fetch)).toEqual([-9.13, 38.71])
    const url = new URL(f.mock.calls[0][0] as unknown as string)
    expect(url.searchParams.get('q')).toBe('Alfama flat, Lisbon')
    expect(url.searchParams.get('viewbox')).toBe('-10.13,39.77,-8.13,37.77')
  })

  it('returns null when nothing is found or the network fails', async () => {
    expect(await geocode('x', undefined, (() => ok([])) as unknown as typeof fetch)).toBeNull()
    expect(await geocode('x', undefined, (() => Promise.reject(new Error('offline'))) as unknown as typeof fetch)).toBeNull()
  })
})
