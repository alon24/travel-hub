import { parseTrip } from '../model/schema.ts'
import type { Trip } from '../model/types.ts'

/**
 * Trips saved in this browser (localStorage). Every read goes through parseTrip, so a damaged
 * or outdated entry is dropped instead of crashing the page. Drive sync can sit on top later, as in MyMaps AI.
 */
const KEY = 'travel-hub.trips'

function readAll(): Trip[] {
  let raw: unknown
  try {
    raw = JSON.parse(localStorage.getItem(KEY) ?? '[]')
  } catch {
    return []
  }
  if (!Array.isArray(raw)) return []
  return raw.flatMap((t) => {
    try {
      return [parseTrip(t)]
    } catch {
      return []
    }
  })
}

function writeAll(trips: Trip[]): void {
  localStorage.setItem(KEY, JSON.stringify(trips))
  window.dispatchEvent(new Event('travel-hub:trips'))
}

/** Newest change first */
export const listTrips = (): Trip[] => readAll().sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
export const getTrip = (id: string): Trip | undefined => readAll().find((t) => t.id === id)

export function saveTrip(trip: Trip): Trip {
  const valid = parseTrip(trip)
  writeAll([...readAll().filter((t) => t.id !== valid.id), valid])
  return valid
}

export function deleteTrip(id: string): void {
  writeAll(readAll().filter((t) => t.id !== id))
}

/** Calls back when trips change in this tab or another one. Returns the unsubscribe function. */
export function onTripsChange(cb: () => void): () => void {
  const onStorage = (e: StorageEvent) => e.key === KEY && cb()
  window.addEventListener('travel-hub:trips', cb)
  window.addEventListener('storage', onStorage)
  return () => {
    window.removeEventListener('travel-hub:trips', cb)
    window.removeEventListener('storage', onStorage)
  }
}
