import { describe, expect, it } from 'vitest'
import example from '../data/example-trip.json'
import { parseTrip } from './schema.ts'
import { nightsBetween, passDate, travelerSummary, tripDates, tripNights, tripRoute } from './trip.ts'

const trip = parseTrip(example)

describe('Trip schema', () => {
  it('accepts the example trip', () => {
    expect(trip.title).toBe('Rome & Florence')
    expect(trip.flights).toHaveLength(2)
  })

  it('rejects an end date before the start date', () => {
    expect(() => parseTrip({ ...example, endDate: '2027-03-01' })).toThrow(/endDate is before startDate/)
  })

  it('rejects a day outside the trip', () => {
    expect(() => parseTrip({ ...example, days: [{ date: '2027-04-01' }] })).toThrow(/outside the trip dates/)
  })

  it('rejects a lowercase airport code', () => {
    expect(() => parseTrip({ ...example, home: 'tlv' })).toThrow(/3-letter airport code/)
  })

  it('rejects an unknown schema version', () => {
    expect(() => parseTrip({ ...example, schema: 2 })).toThrow(/Invalid trip/)
  })
})

describe('Trip helpers', () => {
  it('counts nights', () => {
    expect(tripNights(trip)).toBe(7)
    expect(nightsBetween('2027-03-30', '2027-04-02')).toBe(3)
  })

  it('lists every date, across a DST change', () => {
    const dates = tripDates({ startDate: '2027-03-26', endDate: '2027-03-29' })
    expect(dates).toEqual(['2027-03-26', '2027-03-27', '2027-03-28', '2027-03-29'])
  })

  it('summarizes travelers', () => {
    expect(travelerSummary(trip)).toBe('2A · 1C')
    expect(travelerSummary({ travelers: [{ id: 'a', name: 'A', kind: 'adult' }] })).toBe('1A')
  })

  it('formats boarding-pass dates', () => {
    expect(passDate('2027-03-12')).toBe('12 MAR 27')
  })

  it('finds an open-jaw route', () => {
    expect(tripRoute(trip)).toEqual({ from: 'TLV', to: 'FCO', backFrom: 'FLR' })
  })

  it('falls back to destinations when no flights are picked yet', () => {
    expect(tripRoute({ ...trip, flights: [] })).toEqual({ from: 'TLV', to: 'FCO', backFrom: 'FLR' })
  })
})
