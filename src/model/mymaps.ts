/**
 * Trip → MyMaps AI map. The hub builds a MapDoc (MyMaps AI's own format, schema 1) and opens
 *   https://alon24.github.io/mymaps-ai/#/import/<base64url(MapDoc)>
 * MyMaps validates it, saves it locally and opens it. A map is never overwritten: importing the same id again just opens it.
 */
import { airport } from '../data/airports.ts'
import { encodePayload } from './handoff.ts'
import { newId } from './plan.ts'
import { dayLabel as shortDate } from './trip.ts'
import type { Trip } from './types.ts'

/** The subset of MyMaps AI's model the hub writes (mymaps-ai/src/model/types.ts). */
export interface MapFeature {
  type: 'Feature'
  geometry: { type: 'Point'; coordinates: [number, number] }
  properties: { id: string; name: string; description: string; color: string; icon?: string }
}
export interface MapLayer {
  id: string
  name: string
  visible: boolean
  color: string
  style: 'individual' | 'uniform' | 'numbered'
  day?: { date?: string; route: boolean }
  features: MapFeature[]
}
export interface MapDoc {
  schema: 1
  id: string
  title: string
  description: string
  layers: MapLayer[]
  updatedAt: string
}

/** MyMaps AI's own palette, so day colors look native there */
const PALETTE = ['#1f6f5c', '#d1495b', '#edae49', '#00798c', '#30638e', '#7b2d8e', '#e07a1f', '#3d9a3d', '#5c5c5c', '#c2185b']


const point = (name: string, at: [number, number], color: string, description: string, icon: string): MapFeature => ({
  type: 'Feature',
  geometry: { type: 'Point', coordinates: at },
  properties: { id: newId('f'), name, description, color, icon },
})

/** The map for a trip: flights and stays on one layer, then an empty, dated layer per day for the plan. */
export function mapDocFromTrip(trip: Trip, now = new Date()): { doc: MapDoc; trip: Trip } {
  const id = trip.apps.mymaps?.mapId ?? `trip-${trip.id}`
  const base: MapFeature[] = []
  const seen = new Set<string>()
  for (const f of trip.flights) {
    for (const code of [f.destination, f.origin]) {
      const a = airport(code)
      if (!a || code === trip.home || seen.has(code)) continue
      seen.add(code)
      base.push(point(`${a.city} airport (${code})`, a.location, '#30638e', `${f.airlines.join(' + ')} ${f.flightNumbers.join(' ')}`.trim(), '✈️'))
    }
  }
  for (const s of trip.stays) {
    if (!s.location) continue
    base.push(point(s.name, s.location, '#7b2d8e', `Stay · ${shortDate(s.checkIn)} → ${shortDate(s.checkOut)}`, '🏨'))
  }
  const dayLayers: MapLayer[] = trip.days.map((d, i) => ({
    id: d.mapLayerId ?? newId('l'),
    name: `Day ${i + 1} · ${shortDate(d.date)}${d.title ? ` · ${d.title}` : ''}`,
    visible: true,
    color: PALETTE[i % PALETTE.length],
    style: 'numbered',
    day: { date: d.date, route: true },
    features: [],
  }))
  const doc: MapDoc = {
    schema: 1,
    id,
    title: trip.title,
    description: `From Travel Hub: ${trip.home} ⇄ ${trip.destinations.map((d) => d.name).join(', ')}, ${trip.startDate} → ${trip.endDate}`,
    layers: [{ id: newId('l'), name: '✈ Flights & stays', visible: true, color: '#5c5c5c', style: 'individual', features: base }, ...dayLayers],
    updatedAt: now.toISOString(),
  }
  const linked: Trip = {
    ...trip,
    days: trip.days.map((d, i) => ({ ...d, mapLayerId: dayLayers[i].id })),
    apps: { ...trip.apps, mymaps: { ...trip.apps.mymaps, mapId: id } },
    updatedAt: now.toISOString(),
  }
  return { doc, trip: linked }
}

export const mymapsImportUrl = (mymapsUrl: string, doc: MapDoc): string => `${mymapsUrl}#/import/${encodePayload(doc)}`
