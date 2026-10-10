/**
 * Finds a place's position with OpenStreetMap Nominatim (the same service MyMaps AI uses).
 * One request per saved stay, well inside the usage policy: https://operations.osmfoundation.org/policies/nominatim/
 */
const ENDPOINT = 'https://nominatim.openstreetmap.org/search'

export async function geocode(query: string, near?: [number, number], fetcher: typeof fetch = fetch): Promise<[number, number] | null> {
  const params = new URLSearchParams({ q: query, format: 'jsonv2', limit: '1' })
  if (near) {
    const [lng, lat] = near
    params.set('viewbox', `${lng - 1},${lat + 1},${lng + 1},${lat - 1}`)
  }
  try {
    const res = await fetcher(`${ENDPOINT}?${params}`, { headers: { Accept: 'application/json' } })
    if (!res.ok) return null
    const [hit] = (await res.json()) as { lat: string; lon: string }[]
    return hit ? [Number(hit.lon), Number(hit.lat)] : null
  } catch {
    return null
  }
}
