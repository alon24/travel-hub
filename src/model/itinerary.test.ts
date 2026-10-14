import { describe, expect, it } from 'vitest'
import { addPlace, cityOn, dayDirectionsUrl, dayPlaces, mapsPlaceUrl, movePlace, removePlace, stayOn } from './itinerary.ts'
import { addStay, createTrip } from './plan.ts'
import { parseTrip } from './schema.ts'

const base = createTrip({ home: 'TLV', destinations: [{ code: 'LIS' }, { code: 'OPO' }], startDate: '2026-11-16', nights: 3, adults: 2 }, new Date('2026-10-10T12:00:00Z'))
const lis = base.destinations[0]

describe('places', () => {
  it('adds, orders and removes places on one day only, and stays a valid Trip', () => {
    let t = addPlace(base, '2026-11-17', ' Belém Tower ')
    t = addPlace(t, '2026-11-17', 'Alfama')
    t = addPlace(t, '2026-11-17', '   ')
    expect(() => parseTrip(t)).not.toThrow()
    expect(dayPlaces(t, '2026-11-17').map((p) => p.name)).toEqual(['Belém Tower', 'Alfama'])
    expect(dayPlaces(t, '2026-11-16')).toEqual([])
    const [a, b] = dayPlaces(t, '2026-11-17')
    t = movePlace(t, '2026-11-17', b.id, -1)
    expect(dayPlaces(t, '2026-11-17').map((p) => p.name)).toEqual(['Alfama', 'Belém Tower'])
    expect(dayPlaces(movePlace(t, '2026-11-17', b.id, -1), '2026-11-17')[0].name).toBe('Alfama')
    t = removePlace(t, '2026-11-17', a.id)
    expect(dayPlaces(t, '2026-11-17').map((p) => p.name)).toEqual(['Alfama'])
  })
})

describe('where the day is', () => {
  it('finds the city and the hotel', () => {
    expect(cityOn(base, '2026-11-17')?.name).toBe('Lisbon')
    const t = addStay(base, { name: 'Alfama flat', destinationId: lis.id, checkIn: '2026-11-16', checkOut: '2026-11-18', location: [-9.13, 38.71] })
    expect(stayOn(t, '2026-11-17')?.name).toBe('Alfama flat')
    expect(stayOn(t, '2026-11-18')?.name).toBe('Alfama flat')
    expect(stayOn(t, '2026-11-19')).toBeUndefined()
  })
})

describe('Google Maps links', () => {
  it('searches a place by name and city, or by position when known', () => {
    const url = new URL(mapsPlaceUrl({ name: 'Belém Tower' }, 'Lisbon'))
    expect(url.origin + url.pathname).toBe('https://www.google.com/maps/search/')
    expect(url.searchParams.get('query')).toBe('Belém Tower, Lisbon')
    expect(new URL(mapsPlaceUrl({ name: 'x', location: [-9.1, 38.7] })).searchParams.get('query')).toBe('38.7,-9.1')
    expect(new URL(mapsPlaceUrl({ name: 'Lisbon Cathedral' }, 'Lisbon')).searchParams.get('query')).toBe('Lisbon Cathedral')
  })

  it('has no directions without places', () => {
    expect(dayDirectionsUrl(base, '2026-11-17')).toBeUndefined()
  })

  it('routes through the places in order, from the hotel', () => {
    let t = addStay(base, { name: 'Alfama flat', destinationId: lis.id, checkIn: '2026-11-16', checkOut: '2026-11-18', location: [-9.13, 38.71] })
    t = addPlace(t, '2026-11-17', 'Belém Tower')
    t = addPlace(t, '2026-11-17', 'Alfama')
    t = addPlace(t, '2026-11-17', 'LX Factory')
    const url = new URL(dayDirectionsUrl(t, '2026-11-17')!)
    expect(url.pathname).toBe('/maps/dir/')
    expect(url.searchParams.get('origin')).toBe('38.71,-9.13')
    expect(url.searchParams.get('waypoints')).toBe('Belém Tower, Lisbon|Alfama, Lisbon')
    expect(url.searchParams.get('destination')).toBe('LX Factory, Lisbon')
  })

  it('goes straight to the only place when there is no hotel', () => {
    const t = addPlace(base, '2026-11-17', 'Belém Tower')
    const url = new URL(dayDirectionsUrl(t, '2026-11-17')!)
    expect(url.searchParams.get('origin')).toBeNull()
    expect(url.searchParams.get('destination')).toBe('Belém Tower, Lisbon')
  })
})
