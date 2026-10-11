import { z } from 'zod'

/**
 * Handoff: how another app sends data to the hub. The sender opens
 *   https://alon24.github.io/travel-hub/#/handoff/<base64url(JSON)>
 * and the hub validates the payload with zod before it touches a Trip.
 *
 * v1 has one kind: Skyhop sends the flights the user picked (Trip builder or a result card).
 * The same JSON is pinned by tests in both repos, so a change here is a contract change.
 */
export const HANDOFF_VERSION = 1

const iata = z.string().regex(/^[A-Z]{3}$/)
/** Local airport time, as airlines print it: 2026-11-16T09:30:00 (an offset is allowed too) */
const time = z.iso.datetime({ local: true, offset: true })

export const handoffLeg = z.object({
  origin: iata,
  destination: iata,
  departs: time,
  arrives: time,
  airlines: z.array(z.string()).default([]),
  flightNumbers: z.array(z.string()).default([]),
  stops: z.number().int().min(0).default(0),
  /** Total for all travelers, in the handoff's currency */
  price: z.number().min(0).optional(),
  bookingUrl: z.url().optional(),
})

export const flightsHandoff = z.object({
  v: z.literal(HANDOFF_VERSION),
  kind: z.literal('flights'),
  source: z.literal('skyhop'),
  /** The hub trip the search was started from, if any */
  tripId: z.string().min(1).optional(),
  searchId: z.string().min(1).optional(),
  currency: z.string().length(3),
  adults: z.number().int().min(1).max(9),
  childrenAges: z.array(z.number().int().min(0).max(17)).default([]),
  /** City names by airport code, e.g. { LIS: "Lisbon" } */
  names: z.record(z.string(), z.string()).default({}),
  legs: z.array(handoffLeg).min(1).max(8),
})

export type FlightsHandoff = z.infer<typeof flightsHandoff>
export type HandoffLeg = z.infer<typeof handoffLeg>

/** UTF-8 safe base64url, so names like "Zürich" survive the URL. */
export function encodePayload(value: unknown): string {
  const bytes = new TextEncoder().encode(JSON.stringify(value))
  let bin = ''
  for (const b of bytes) bin += String.fromCharCode(b)
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

export function decodePayload(text: string): unknown {
  const b64 = text.replace(/-/g, '+').replace(/_/g, '/')
  const bin = atob(b64 + '='.repeat((4 - (b64.length % 4)) % 4))
  return JSON.parse(new TextDecoder().decode(Uint8Array.from(bin, (c) => c.charCodeAt(0))))
}

/** Reads a handoff from a location hash. Returns null when the hash isn't a handoff; throws when it is one but is invalid. */
export function readHandoff(hash: string): FlightsHandoff | null {
  const m = hash.match(/^#\/handoff\/([A-Za-z0-9_-]+)$/)
  if (!m) return null
  let raw: unknown
  try {
    raw = decodePayload(m[1])
  } catch {
    throw new Error('This link is damaged: the trip data could not be read.')
  }
  const result = flightsHandoff.safeParse(raw)
  if (!result.success) throw new Error(`This link has trip data the hub doesn't understand: ${z.prettifyError(result.error)}`)
  return result.data
}
