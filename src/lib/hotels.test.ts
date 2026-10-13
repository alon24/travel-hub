import { beforeEach, describe, expect, it, vi } from 'vitest'
import { clearHotelCache, distanceKm, findHotels, hotelQuery, parseHotels } from './hotels.ts'

const center: [number, number] = [-9.1393, 38.7223]   // Lisbon
const osm = {
  elements: [
    { type: 'node', id: 1, lat: 38.7105, lon: -9.1366, tags: { tourism: 'hotel', name: 'Hotel Baixa', stars: '4', website: 'https://baixa.example' } },
    { type: 'way', id: 2, center: { lat: 38.7223, lon: -9.1393 }, tags: { tourism: 'guest_house', name: 'Casa Central' } },
    { type: 'node', id: 3, lat: 38.74, lon: -9.15, tags: { tourism: 'hostel', name: 'Hostel Up', stars: 'yes' } },
    { type: 'node', id: 4, lat: 38.71, lon: -9.13, tags: { tourism: 'hotel', name: 'hotel baixa ' } },        // same place twice
    { type: 'node', id: 5, lat: 38.71, lon: -9.13, tags: { tourism: 'hotel' } },                              // no name
    { type: 'node', id: 6, lat: 38.71, lon: -9.13, tags: { tourism: 'museum', name: 'MUDE' } },              // not a bed
    { type: 'node', id: 7, lat: 38.72, lon: -9.14, tags: { tourism: 'apartment', name: 'Flat 7', website: 'javascript:alert(1)' } },
  ],
}

describe('parseHotels', () => {
  it('keeps named places to sleep, nearest first, once each, with stars and a safe website', () => {
    const h = parseHotels(osm, center)
    expect(h.map((x) => x.name)).toEqual(['Casa Central', 'Flat 7', 'Hotel Baixa', 'Hostel Up'])
    expect(h[0]).toMatchObject({ id: 'way/2', kind: 'guest_house', km: 0, location: [-9.1393, 38.7223] })
    expect(h.find((x) => x.name === 'Hotel Baixa')).toMatchObject({ stars: 4, website: 'https://baixa.example', km: 1.3 })
    expect(h.find((x) => x.name === 'Hostel Up')!.stars).toBeUndefined()
    expect(h.find((x) => x.name === 'Flat 7')!.website).toBeUndefined()
  })

  it('handles an empty or odd answer', () => {
    expect(parseHotels({}, center)).toEqual([])
  })
})

describe('findHotels', () => {
  beforeEach(() => clearHotelCache())

  it('finds the city center, asks Overpass once, and remembers the answer', async () => {
    const fetch = vi.fn(async (url: string | URL | Request) =>
      String(url).includes('nominatim')
        ? new Response(JSON.stringify([{ lat: '38.7223', lon: '-9.1393' }]))
        : new Response(JSON.stringify(osm)),
    )
    const h = await findHotels('Lisbon', [-9.13, 38.77], fetch as typeof globalThis.fetch)
    expect(h).toHaveLength(4)
    await findHotels('Lisbon', [-9.13, 38.77], fetch as typeof globalThis.fetch)
    expect(fetch).toHaveBeenCalledTimes(2)
    const body = new URLSearchParams(String(fetch.mock.calls[1]![1]!.body))
    expect(body.get('data')).toBe(hotelQuery(center, 2500))
  })

  it('says when OpenStreetMap is busy, and lets you try again', async () => {
    const busy = vi.fn(async (url: string | URL | Request) =>
      String(url).includes('nominatim') ? new Response(JSON.stringify([{ lat: '38.7', lon: '-9.1' }])) : new Response('', { status: 429 }),
    )
    await expect(findHotels('Lisbon', undefined, busy as typeof fetch)).rejects.toThrow(/busy/)
    const ok = vi.fn(async () => new Response(JSON.stringify(osm)))
    await expect(findHotels('Lisbon', center, ok as unknown as typeof fetch)).resolves.toHaveLength(4)
  })
})

it('measures distance in km', () => {
  expect(distanceKm([-9.1393, 38.7223], [-8.6291, 41.1579])).toBeCloseTo(274, 0)   // Lisbon → Porto
})
