import type { DayPlace, Destination, IsoDate, Stay, Trip } from './types.ts'

const MAPS = 'https://www.google.com/maps'

/** The city the traveler is in on `date` (arrival day counts, departure day too). */
export function cityOn(trip: Pick<Trip, 'days' | 'destinations'>, date: IsoDate): Destination | undefined {
  const id = trip.days.find((d) => d.date === date)?.destinationId
  return (id && trip.destinations.find((d) => d.id === id)) || trip.destinations.find((d) => d.arrive <= date && date <= d.depart)
}

/** Where they sleep that night; on the check-out morning, the stay they are leaving. */
export function stayOn(trip: Pick<Trip, 'stays'>, date: IsoDate): Stay | undefined {
  return trip.stays.find((s) => s.checkIn <= date && date < s.checkOut) ?? trip.stays.find((s) => s.checkOut === date)
}

export const dayPlaces = (trip: Pick<Trip, 'days'>, date: IsoDate): DayPlace[] => trip.days.find((d) => d.date === date)?.places ?? []

const stop = (name: string, location: [number, number] | undefined, city?: string): string =>
  location ? `${location[1]},${location[0]}` : city && !name.toLowerCase().includes(city.toLowerCase()) ? `${name}, ${city}` : name

/** One tap to see a place in Google Maps. */
export function mapsPlaceUrl(place: Pick<DayPlace, 'name' | 'location'>, city?: string): string {
  return `${MAPS}/search/?${new URLSearchParams({ api: '1', query: stop(place.name, place.location, city) })}`
}

/**
 * Google Maps directions through the day's places in order, starting at the hotel when known.
 * Undefined with nothing to route to.
 */
export function dayDirectionsUrl(trip: Trip, date: IsoDate, mode: 'walking' | 'driving' | 'transit' = 'walking'): string | undefined {
  const city = cityOn(trip, date)?.name
  const places = dayPlaces(trip, date)
  if (!places.length) return undefined
  const stay = stayOn(trip, date)
  const stops = [...(stay ? [stop(stay.name, stay.location, city)] : []), ...places.map((p) => stop(p.name, p.location, city))]
  if (stops.length === 1) return `${MAPS}/dir/?${new URLSearchParams({ api: '1', destination: stops[0], travelmode: mode })}`
  const params = new URLSearchParams({ api: '1', origin: stops[0], destination: stops.at(-1)!, travelmode: mode })
  if (stops.length > 2) params.set('waypoints', stops.slice(1, -1).join('|'))
  return `${MAPS}/dir/?${params}`
}

const id = () => Math.random().toString(36).slice(2, 10)

export function addPlace(trip: Trip, date: IsoDate, name: string): Trip {
  const clean = name.trim()
  if (!clean) return trip
  return {
    ...trip,
    days: trip.days.map((d) => (d.date === date ? { ...d, places: [...(d.places ?? []), { id: id(), name: clean }] } : d)),
  }
}

export function removePlace(trip: Trip, date: IsoDate, placeId: string): Trip {
  return { ...trip, days: trip.days.map((d) => (d.date === date ? { ...d, places: (d.places ?? []).filter((p) => p.id !== placeId) } : d)) }
}

/** Moves a place one slot up (-1) or down (1) within its day. */
export function movePlace(trip: Trip, date: IsoDate, placeId: string, by: -1 | 1): Trip {
  return {
    ...trip,
    days: trip.days.map((d) => {
      const list = [...(d.places ?? [])]
      const from = list.findIndex((p) => p.id === placeId)
      const to = from + by
      if (d.date !== date || from < 0 || to < 0 || to >= list.length) return d
      ;[list[from], list[to]] = [list[to], list[from]]
      return { ...d, places: list }
    }),
  }
}
