import { parseTrip } from '../model/schema.ts'
import type { Trip } from '../model/types.ts'

/**
 * Trips saved in this browser (localStorage). Every read goes through parseTrip, so a damaged
 * or outdated entry is dropped instead of crashing the page. tripSync.ts mirrors them to Google Drive.
 */
const KEY = 'travel-hub.trips'
/** Ids of trips deleted here, so a sync trashes their Drive copy instead of bringing them back */
const DELETED = 'travel-hub.deleted'

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
  localStorage.setItem(DELETED, JSON.stringify([...new Set([...deletedTrips(), id])]))
  writeAll(readAll().filter((t) => t.id !== id))
}

/** Trips that came from another device: each replaces the copy here, in one write. */
export function putTrips(trips: Trip[]): void {
  if (!trips.length) return
  const ids = new Set(trips.map((t) => t.id))
  writeAll([...readAll().filter((t) => !ids.has(t.id)), ...trips])
}

export function deletedTrips(): string[] {
  try {
    const v = JSON.parse(localStorage.getItem(DELETED) ?? '[]')
    return Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : []
  } catch {
    return []
  }
}

export function forgetDeleted(ids: string[]): void {
  localStorage.setItem(DELETED, JSON.stringify(deletedTrips().filter((id) => !ids.includes(id))))
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
