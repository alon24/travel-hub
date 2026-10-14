import { describe, expect, it } from 'vitest'
import fixture from '../test/fixtures/skyhop-handoff.json'
import { flightsHandoff } from './handoff.ts'
import { addStay, applyFlights, buildDays, createTrip, firstNight, removeStay, skyhopSearchUrl, stayCoverage, staySearchLinks } from './plan.ts'
import { parseTrip } from './schema.ts'

const handoff = flightsHandoff.parse(fixture)
const NOW = new Date('2026-10-10T12:00:00Z')

describe('creating a trip', () => {
  const trip = createTrip({ home: 'TLV', destinations: [{ code: 'LIS' }, { code: 'OPO' }], startDate: '2026-11-16', nights: 3, adults: 3 }, NOW)

  it('is a valid Trip with the nights split between the cities', () => {
    expect(() => parseTrip(trip)).not.toThrow()
    expect(trip.title).toBe('Lisbon & Porto')
    expect(trip.endDate).toBe('2026-11-19')
    expect(trip.destinations.map((d) => [d.name, d.arrive, d.depart])).toEqual([
      ['Lisbon', '2026-11-16', '2026-11-18'],
      ['Porto', '2026-11-18', '2026-11-19'],
    ])
    expect(trip.travelers).toHaveLength(3)
    expect(trip.days.map((d) => d.title)).toEqual(['Fly to Lisbon', 'Lisbon', 'Lisbon → Porto', 'Fly home from Porto'])
  })
})

describe('firstNight', () => {
  it('counts an after-midnight landing as the evening before', () => {
    expect(firstNight('2026-11-17T00:58:00')).toBe('2026-11-16')
    expect(firstNight('2026-11-17T14:00:00')).toBe('2026-11-17')
  })
})

describe('applyFlights (Skyhop → Trip)', () => {
  it('starts an open-jaw trip from the flights alone', () => {
    const t = applyFlights(undefined, handoff, NOW)
    expect(() => parseTrip(t)).not.toThrow()
    expect(t.status).toBe('planning')
    expect([t.startDate, t.endDate]).toEqual(['2026-11-16', '2026-11-19'])
    expect(t.destinations.map((d) => [d.name, d.airport, d.arrive, d.depart])).toEqual([
      ['Lisbon', 'LIS', '2026-11-16', '2026-11-18'],
      ['Porto', 'OPO', '2026-11-18', '2026-11-19'],
    ])
    expect(t.flights.map((f) => f.direction)).toEqual(['outbound', 'return'])
    expect(t.budget).toEqual({ currency: 'ILS', planned: 792 })
    expect(t.apps.skyhop?.searchIds).toEqual(['s_portugal'])
  })

  it('fills the trip it was searched from, keeping names and manual flights', () => {
    const base = createTrip({ title: 'Portugal with the guys', home: 'TLV', destinations: [{ code: 'LIS', name: 'Lisboa' }, { code: 'OPO' }], startDate: '2026-11-14', nights: 3, adults: 2 }, NOW)
    const withManual = { ...base, flights: [{ id: 'm', direction: 'between' as const, origin: 'LIS', destination: 'OPO', departs: '2026-11-18T10:00:00', arrives: '2026-11-18T11:00:00', airlines: ['TAP'], flightNumbers: [], stops: 0, booked: false, source: 'manual' as const }] }
    const t = applyFlights(withManual, { ...handoff, tripId: base.id }, NOW)
    expect(t.id).toBe(base.id)
    expect(t.title).toBe('Portugal with the guys')
    expect(t.destinations[0].name).toBe('Lisboa')
    expect(t.startDate).toBe('2026-11-16')
    expect(t.travelers).toHaveLength(3)
    expect(t.flights.map((f) => f.source)).toEqual(['manual', 'skyhop', 'skyhop'])
  })

  it('moves the change of city to the day a between-flight leaves', () => {
    const h = flightsHandoff.parse({
      ...fixture,
      legs: [
        { origin: 'TLV', destination: 'LIS', departs: '2026-11-16T09:00:00', arrives: '2026-11-16T14:00:00' },
        { origin: 'LIS', destination: 'FAO', departs: '2026-11-17T09:00:00', arrives: '2026-11-17T10:00:00' },
        { origin: 'FAO', destination: 'TLV', departs: '2026-11-20T09:00:00', arrives: '2026-11-20T16:00:00' },
      ],
    })
    const t = applyFlights(undefined, h, NOW)
    expect(t.destinations.map((d) => [d.airport, d.arrive, d.depart])).toEqual([
      ['LIS', '2026-11-16', '2026-11-17'],
      ['FAO', '2026-11-17', '2026-11-20'],
    ])
    expect(t.flights.map((f) => f.direction)).toEqual(['outbound', 'between', 'return'])
  })
})

describe('stays', () => {
  const trip = applyFlights(undefined, handoff, NOW)

  it('lists the open nights per city with a ready check-in/check-out', () => {
    const c = stayCoverage(trip)
    expect(c.map((x) => [x.destination.name, x.open.length, x.gap])).toEqual([
      ['Lisbon', 2, { checkIn: '2026-11-16', checkOut: '2026-11-18' }],
      ['Porto', 1, { checkIn: '2026-11-18', checkOut: '2026-11-19' }],
    ])
  })

  it('covers nights and updates the budget when a stay is added or removed', () => {
    const lisbon = trip.destinations[0]
    const t = addStay(trip, { name: 'Alfama flat', destinationId: lisbon.id, checkIn: '2026-11-16', checkOut: '2026-11-18', price: 1200, currency: 'ILS' }, NOW)
    expect(stayCoverage(t)[0].open).toEqual([])
    expect(t.budget?.planned).toBe(792 + 1200)
    expect(removeStay(t, t.stays[0].id, NOW).budget?.planned).toBe(792)
  })

  it('builds hotel searches with the city, dates and group size', () => {
    const [booking, airbnb] = staySearchLinks(trip, trip.destinations[0], '2026-11-16', '2026-11-18')
    expect(booking.url).toContain('ss=Lisbon')
    expect(booking.url).toContain('checkin=2026-11-16&checkout=2026-11-18&group_adults=3')
    expect(airbnb.url).toBe('https://www.airbnb.com/s/Lisbon/homes?checkin=2026-11-16&checkout=2026-11-18&adults=3')
  })
})

describe('skyhopSearchUrl', () => {
  it('asks for a window around the dates, the length, open-jaw and where to send the flights', () => {
    const t = createTrip({ home: 'TLV', destinations: [{ code: 'LIS' }, { code: 'OPO' }], startDate: '2026-11-16', nights: 3, adults: 3 }, NOW)
    const url = new URL(skyhopSearchUrl(t, 'https://x.test/sky/', 'https://x.test/hub/'))
    expect(Object.fromEntries(url.searchParams)).toEqual({
      from: 'TLV', to: 'LIS,OPO', start: '2026-11-13', end: '2026-11-22', nights: '3', adults: '3', trip: t.id, hub: 'https://x.test/hub/',
    })
  })
})

describe('skyhopSearchUrl: which airports', () => {
  const params = (input: Partial<Parameters<typeof createTrip>[0]>) =>
    Object.fromEntries(new URL(skyhopSearchUrl(createTrip({ home: 'TLV', destinations: [{ code: 'LIS' }], startDate: '2026-11-16', nights: 4, adults: 2, ...input }, NOW), 'https://x.test/sky/', 'https://x.test/hub/')).searchParams)

  it('flies to any mainland airport of a country asked for as a whole, and home from any of them', () => {
    const q = params({ destinations: [{ code: 'LIS' }, { code: 'OPO' }], countries: ['PT'] })
    expect(q.to).toBe('LIS,OPO,FAO')
    expect(q).not.toHaveProperty('back')
    expect(params({ destinations: [{ code: 'FNC' }, { code: 'LIS' }], countries: ['PT'] }).to).toBe('FNC,LIS,OPO,FAO')   // an island the trip goes to is kept
  })

  it('flies home from the last country when the trip ends in another one', () => {
    const q = params({ destinations: [{ code: 'LIS' }, { code: 'MAD' }, { code: 'BCN' }], countries: ['PT'] })
    expect(q).toMatchObject({ to: 'LIS,OPO,FAO', back: 'BCN,MAD' })   // the last city first
  })

})

describe('flexible dates ("3 days in December")', () => {
  const flex = createTrip({ home: 'TLV', destinations: [{ code: 'LIS' }], startDate: '2026-11-16', nights: 2, adults: 2, flexible: { from: '2026-12-01', to: '2026-12-31' } }, NOW)

  it('keeps the window and puts the placeholder dates at its start', () => {
    expect(flex).toMatchObject({ flexible: { from: '2026-12-01', to: '2026-12-31' }, startDate: '2026-12-01', endDate: '2026-12-03' })
    expect(parseTrip(JSON.parse(JSON.stringify(flex))).flexible).toEqual({ from: '2026-12-01', to: '2026-12-31' })
  })

  it('asks Skyhop for the whole window with the trip length, not ± 3 days around a made-up date', () => {
    const q = new URL(skyhopSearchUrl(flex, 'https://x.test/sky/', 'https://x.test/hub/')).searchParams
    expect([q.get('start'), q.get('end'), q.get('nights')]).toEqual(['2026-12-01', '2026-12-31', '2'])
  })

  it('stops being flexible once flights are picked', () => {
    const t = applyFlights(flex, { ...handoff, tripId: flex.id }, NOW)
    expect(t.flexible).toBeUndefined()
    expect(t.startDate).toBe(handoff.legs[0].departs.slice(0, 10))
  })
})

describe('buildDays', () => {
  it('keeps a day the user already titled or mapped', () => {
    const t = createTrip({ home: 'TLV', destinations: [{ code: 'LIS' }], startDate: '2026-11-16', nights: 2, adults: 1 }, NOW)
    const days = buildDays({ ...t, days: [{ date: '2026-11-17', title: 'Sintra', mapLayerId: 'L2' }] })
    expect(days[1]).toMatchObject({ title: 'Sintra', mapLayerId: 'L2' })
    expect(days[0].title).toBe('Fly to Lisbon')
  })
})

describe('createTrip with nights per city', () => {
  it('uses them when they add up to the trip, else splits evenly', () => {
    const t = createTrip({ home: 'TLV', destinations: [{ code: 'LIS', nights: 3 }, { code: 'OPO', nights: 4 }], startDate: '2026-11-18', nights: 7, adults: 2 })
    expect(t.destinations.map((d) => [d.arrive, d.depart])).toEqual([['2026-11-18', '2026-11-21'], ['2026-11-21', '2026-11-25']])
    expect(t.endDate).toBe('2026-11-25')
    const odd = createTrip({ home: 'TLV', destinations: [{ code: 'LIS', nights: 3 }, { code: 'OPO', nights: 4 }], startDate: '2026-11-18', nights: 6, adults: 2 })
    expect(odd.destinations.map((d) => d.depart)).toEqual(['2026-11-21', '2026-11-24'])
  })
})
