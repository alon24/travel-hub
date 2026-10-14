import { describe, expect, it } from 'vitest'
import example from '../data/example-trip.json'
import { parseTrip } from './schema.ts'
import { nightsBetween, tripDates, tripNights, tripRoute } from './trip.ts'

const trip = parseTrip(example)

describe('Trip schema', () => {
  it('accepts the example trip', () => {
    expect(trip.title).toBe('Rome & Florence')
  })

  it.each([
    ['an end date before the start date', { endDate: '2027-03-01' }, /endDate is before startDate/],
    ['a day outside the trip', { days: [{ date: '2027-04-01' }] }, /outside the trip dates/],
    ['a lowercase airport code', { home: 'tlv' }, /3-letter airport code/],
    ['an unknown schema version', { schema: 2 }, /Invalid trip/],
  ])('rejects %s', (_, patch, message) => {
    expect(() => parseTrip({ ...example, ...patch })).toThrow(message)
  })
})

describe('Trip helpers', () => {
  it('counts nights and lists every date, across a DST change', () => {
    expect(tripNights(trip)).toBe(7)
    expect(nightsBetween('2027-03-30', '2027-04-02')).toBe(3)
    expect(tripDates({ startDate: '2027-03-26', endDate: '2027-03-29' })).toEqual(['2027-03-26', '2027-03-27', '2027-03-28', '2027-03-29'])
  })

  it('finds an open-jaw route, from the flights or else from the destinations', () => {
    const route = { from: 'TLV', to: 'FCO', backFrom: 'FLR' }
    expect(tripRoute(trip)).toEqual(route)
    expect(tripRoute({ ...trip, flights: [] })).toEqual(route)
  })
})
