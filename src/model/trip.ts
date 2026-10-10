import type { IsoDate, Trip } from './types.ts'

const DAY_MS = 24 * 60 * 60 * 1000
const toUtc = (d: IsoDate): number => Date.parse(`${d}T00:00:00Z`)

/** Nights between two dates (12 → 19 March = 7). */
export const nightsBetween = (start: IsoDate, end: IsoDate): number => Math.round((toUtc(end) - toUtc(start)) / DAY_MS)

export const tripNights = (t: Pick<Trip, 'startDate' | 'endDate'>): number => nightsBetween(t.startDate, t.endDate)

/** Every calendar date of the trip, first and last day included. */
export function tripDates(t: Pick<Trip, 'startDate' | 'endDate'>): IsoDate[] {
  const out: IsoDate[] = []
  for (let ms = toUtc(t.startDate); ms <= toUtc(t.endDate); ms += DAY_MS) out.push(new Date(ms).toISOString().slice(0, 10))
  return out
}

/** "2A · 1C", the way Skyhop counts passengers. */
export function travelerSummary(t: Pick<Trip, 'travelers'>): string {
  const adults = t.travelers.filter((p) => p.kind === 'adult').length
  const children = t.travelers.length - adults
  return children ? `${adults}A · ${children}C` : `${adults}A`
}

/** Boarding-pass date: "12 MAR 27". */
export function passDate(d: IsoDate): string {
  const [y, m, day] = d.split('-')
  const month = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'][Number(m) - 1]
  return `${day} ${month} ${y.slice(2)}`
}

/** Airport the trip flies into first, and the one it flies home from (open-jaw aware). */
export function tripRoute(t: Pick<Trip, 'home' | 'flights' | 'destinations'>): { from: string; to: string; backFrom: string } {
  const out = t.flights.find((f) => f.direction === 'outbound')
  const back = t.flights.find((f) => f.direction === 'return')
  const firstAirport = t.destinations[0]?.airport
  const lastAirport = t.destinations.at(-1)?.airport
  const to = out?.destination ?? firstAirport ?? '—'
  return { from: out?.origin ?? t.home, to, backFrom: back?.origin ?? lastAirport ?? to }
}

/** "Wed 18 Nov": the same in every browser and locale. */
export function dayLabel(d: IsoDate): string {
  const date = new Date(`${d}T00:00:00Z`)
  const wd = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][date.getUTCDay()]
  const mon = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][date.getUTCMonth()]
  return `${wd} ${date.getUTCDate()} ${mon}`
}
