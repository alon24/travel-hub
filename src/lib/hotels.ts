import { t } from '../i18n.ts'
import { geocode } from './geocode.ts'

/**
 * Places to sleep in a city, from OpenStreetMap: free, no key, the same data MyMaps AI's place search uses.
 * OSM knows names, stars, kind and position, not prices or availability: each result links to a
 * Booking.com search for that hotel with your dates, and "Use" saves it as the stay with its position.
 * Center: the city geocoded with Nominatim. Hotels: one Overpass query. Both cached for the session.
 */
const OVERPASS = 'https://overpass-api.de/api/interpreter'

export type HotelKind = 'hotel' | 'guest_house' | 'hostel' | 'apartment'

export interface Hotel {
  id: string
  name: string
  kind: HotelKind
  stars?: number
  website?: string
  /** [lng, lat] */
  location: [number, number]
  /** From the city center */
  km: number
}

interface OsmElement {
  type: string
  id: number
  lat?: number
  lon?: number
  center?: { lat: number; lon: number }
  tags?: Record<string, string>
}

const KINDS: HotelKind[] = ['hotel', 'guest_house', 'hostel', 'apartment']

export function distanceKm([lng1, lat1]: [number, number], [lng2, lat2]: [number, number]): number {
  const r = (d: number) => (d * Math.PI) / 180
  const a = Math.sin(r(lat2 - lat1) / 2) ** 2 + Math.cos(r(lat1)) * Math.cos(r(lat2)) * Math.sin(r(lng2 - lng1) / 2) ** 2
  return 6371 * 2 * Math.asin(Math.sqrt(a))
}

export const hotelQuery = ([lng, lat]: [number, number], radius: number) =>
  `[out:json][timeout:20];nwr(around:${radius},${lat},${lng})["tourism"~"^(${KINDS.join('|')})$"]["name"];out center 150;`

/** Overpass JSON → named places to sleep, nearest first, one per name. */
export function parseHotels(json: { elements?: OsmElement[] }, center: [number, number], limit = 30): Hotel[] {
  const seen = new Set<string>()
  const out: Hotel[] = []
  for (const e of json.elements ?? []) {
    const t = e.tags ?? {}
    const lat = e.lat ?? e.center?.lat
    const lon = e.lon ?? e.center?.lon
    const kind = t.tourism as HotelKind
    if (!t.name || lat == null || lon == null || !KINDS.includes(kind)) continue
    const key = t.name.trim().toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    const stars = Number.parseFloat(t.stars ?? '')
    const website = t.website ?? t['contact:website']
    out.push({
      id: `${e.type}/${e.id}`,
      name: t.name.trim(),
      kind,
      ...(stars > 0 && stars <= 7 ? { stars } : {}),
      ...(website && /^https?:\/\//.test(website) ? { website } : {}),
      location: [lon, lat],
      km: Math.round(distanceKm(center, [lon, lat]) * 10) / 10,
    })
  }
  return out.sort((a, b) => a.km - b.km).slice(0, limit)
}

const cache = new Map<string, Promise<Hotel[]>>()

/** Places to sleep within `radius` meters of the city's center. Throws when OpenStreetMap can't be reached. */
export function findHotels(city: string, near?: [number, number], fetcher: typeof fetch = fetch, radius = 2500): Promise<Hotel[]> {
  const key = `${city}|${radius}`
  const hit = cache.get(key)
  if (hit) return hit
  const run = (async () => {
    const center = (await geocode(city, near, fetcher)) ?? near
    if (!center) throw new Error(t("Couldn't find {city} on the map.", { city }))
    let res: Response
    try {
      res = await fetcher(OVERPASS, { method: 'POST', body: new URLSearchParams({ data: hotelQuery(center, radius) }) })
    } catch {
      throw new Error(t("Can't reach OpenStreetMap right now."))
    }
    if (!res.ok) throw new Error(res.status === 429 ? t('OpenStreetMap is busy. Try again in a minute.') : t('OpenStreetMap error {status}.', { status: res.status }))
    return parseHotels(await res.json(), center)
  })()
  cache.set(key, run)
  run.catch(() => cache.delete(key))   // a failure can be retried
  return run
}

export const clearHotelCache = () => cache.clear()
