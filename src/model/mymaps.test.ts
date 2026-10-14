import { describe, expect, it } from 'vitest'
import fixture from '../test/fixtures/skyhop-handoff.json'
import { decodePayload, flightsHandoff } from './handoff.ts'
import { mapDocFromTrip, mymapsImportUrl } from './mymaps.ts'
import { addStay, applyFlights } from './plan.ts'

const trip = (() => {
  const t = applyFlights(undefined, flightsHandoff.parse(fixture), new Date('2026-10-10T12:00:00Z'))
  return addStay(t, { name: 'Alfama flat', destinationId: t.destinations[0].id, checkIn: '2026-11-16', checkOut: '2026-11-18', location: [-9.13, 38.71] })
})()

describe('mapDocFromTrip', () => {
  const { doc, trip: linked } = mapDocFromTrip(trip)

  it('puts airports and stays on one layer and a dated, empty layer per day', () => {
    expect(doc.schema).toBe(1)
    const [base, ...days] = doc.layers
    expect(base.features.map((f) => f.properties.name)).toEqual(['Lisbon airport (LIS)', 'Porto airport (OPO)', 'Alfama flat'])
    expect(base.features[2].geometry.coordinates).toEqual([-9.13, 38.71])
    expect(days.map((l) => l.day?.date)).toEqual(['2026-11-16', '2026-11-17', '2026-11-18', '2026-11-19'])
    expect(days[2].name).toBe('Day 3 · Wed 18 Nov · Lisbon → Porto')
    expect(days.every((l) => l.style === 'numbered' && l.features.length === 0)).toBe(true)
  })

  it('links the trip to the map and its day layers, reusing the ids next time', () => {
    expect(linked.apps.mymaps?.mapId).toBe(doc.id)
    expect(linked.days.map((d) => d.mapLayerId)).toEqual(doc.layers.slice(1).map((l) => l.id))

    // and reuses the same map id and layer ids next time
    const again = mapDocFromTrip(linked).doc
    expect(again.id).toBe(doc.id)
    expect(again.layers.slice(1).map((l) => l.id)).toEqual(doc.layers.slice(1).map((l) => l.id))
  })

  it('opens MyMaps AI with the map in the link', () => {
    const url = mymapsImportUrl('https://x.test/mymaps/', doc)
    expect(url.startsWith('https://x.test/mymaps/#/import/')).toBe(true)
    expect(decodePayload(url.split('/import/')[1])).toEqual(doc)
  })
})
