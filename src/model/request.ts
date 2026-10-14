import { nightsBetween } from './trip.ts'
import type { Trip } from './types.ts'

/**
 * The text a trip was created from ("Describe it"), kept with the trip so you can see what you asked for.
 * `original` never changes. `current` is the version rewritten after you changed the trip (cities, nights,
 * dates, travelers) and `sig` is what the trip looked like when the text was last in step with it.
 */
export interface TripRequest {
  original: string
  current?: string
  sig: string
}

/** The parts of a trip the request talks about. Changes to anything else don't make the text stale. */
export function requestSig(t: Pick<Trip, 'home' | 'destinations' | 'startDate' | 'endDate' | 'flexible' | 'nightsMax' | 'travelers'>): string {
  const when = t.flexible ? `${t.flexible.from}..${t.flexible.to}/${nightsBetween(t.startDate, t.endDate)}` : `${t.startDate}..${t.endDate}`
  const stops = t.destinations.map((d) => `${d.airport ?? d.name}:${nightsBetween(d.arrive, d.depart)}`).join(',')
  return `${t.home}|${stops}|${when}${t.nightsMax ? `-${t.nightsMax}` : ''}|${t.travelers.length}`
}

/** True when the trip was edited since the request text last matched it. */
export const requestIsStale = (t: Trip): boolean => Boolean(t.request) && t.request!.sig !== requestSig(t)

/** What the trip is now, in words the AI can rewrite the request from. */
export function tripFacts(t: Trip): string {
  const nights = nightsBetween(t.startDate, t.endDate)
  const stops = t.destinations.map((d) => `${d.name} ${nightsBetween(d.arrive, d.depart)} nights`).join(', ')
  const length = t.nightsMax ? `${nights} to ${t.nightsMax}` : String(nights)
  const when = t.flexible ? `any ${length} nights between ${t.flexible.from} and ${t.flexible.to}` : `${t.startDate} to ${t.endDate}`
  return `From ${t.home}. Stops in order: ${stops}. Dates: ${when}. Travelers: ${t.travelers.length}.`
}
