import { describe, expect, it } from 'vitest'
import example from '../data/example-trip.json'
import { createTrip } from './plan.ts'
import { requestIsStale } from './request.ts'
import { parseTrip } from './schema.ts'

const NOW = new Date('2026-10-14T12:00:00Z')
const base = { home: 'TLV', destinations: [{ code: 'LIS' }, { code: 'OPO' }], startDate: '2026-11-16', nights: 4, adults: 2 }

describe('trip request', () => {
  it('is saved from the Describe-it text, survives parseTrip, and old trips still load', () => {
    const trip = createTrip({ ...base, request: '  4 nights in Lisbon and Porto  ' }, NOW)
    expect(parseTrip(JSON.parse(JSON.stringify(trip))).request?.original).toBe('4 nights in Lisbon and Porto')
    expect(parseTrip(example).request).toBeUndefined()
    expect(createTrip(base, NOW).request).toBeUndefined()
  })

  it('goes stale when the trip changes, not before', () => {
    const trip = createTrip({ ...base, request: 'Lisbon and Porto' }, NOW)
    expect(requestIsStale(trip)).toBe(false)
    expect(requestIsStale({ ...trip, notes: 'bring a hat' })).toBe(false)
    expect(requestIsStale({ ...trip, travelers: trip.travelers.slice(1) })).toBe(true)
    expect(requestIsStale({ ...trip, destinations: trip.destinations.slice(0, 1) })).toBe(true)
  })
})
