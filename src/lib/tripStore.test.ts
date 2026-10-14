import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createTrip } from '../model/plan.ts'
import { deleteTrip, getTrip, listTrips, onTripsChange, saveTrip } from './tripStore.ts'

const make = (title: string, updatedAt: string) => ({
  ...createTrip({ title, home: 'TLV', destinations: [{ code: 'LIS' }], startDate: '2026-11-16', nights: 3, adults: 2 }),
  updatedAt,
})

describe('tripStore', () => {
  beforeEach(() => localStorage.clear())

  it('saves, lists newest first, updates and deletes', () => {
    const a = saveTrip(make('A', '2026-10-01T00:00:00Z'))
    const b = saveTrip(make('B', '2026-10-02T00:00:00Z'))
    expect(listTrips().map((t) => t.title)).toEqual(['B', 'A'])
    saveTrip({ ...a, title: 'A2', updatedAt: '2026-10-03T00:00:00Z' })
    expect(listTrips().map((t) => t.title)).toEqual(['A2', 'B'])
    deleteTrip(b.id)
    expect(getTrip(b.id)).toBeUndefined()
  })

  it('drops damaged entries instead of failing', () => {
    const ok = make('OK', '2026-10-01T00:00:00Z')
    localStorage.setItem('travel-hub.trips', JSON.stringify([{ id: 'broken' }, ok]))
    expect(listTrips().map((t) => t.title)).toEqual(['OK'])
    localStorage.setItem('travel-hub.trips', '{not json')
    expect(listTrips()).toEqual([])
  })

  it('refuses to save an invalid trip', () => {
    expect(() => saveTrip({ ...make('X', '2026-10-01T00:00:00Z'), home: 'nowhere' })).toThrow(/Invalid trip/)
  })

})
