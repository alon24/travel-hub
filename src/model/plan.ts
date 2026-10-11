/**
 * Planning a Trip: pure functions the Trip page calls. Each takes a Trip and returns a new one.
 * Dates are YYYY-MM-DD strings compared as text; arithmetic goes through UTC midnight.
 */
import { airport } from '../data/airports.ts'
import type { FlightsHandoff } from './handoff.ts'
import { tripDates } from './trip.ts'
import { TRIP_SCHEMA_VERSION, type Destination, type FlightLeg, type IsoDate, type Stay, type Traveler, type Trip, type TripDayPlan } from './types.ts'

const DAY_MS = 86_400_000
export const addDays = (d: IsoDate, n: number): IsoDate => new Date(Date.parse(`${d}T00:00:00Z`) + n * DAY_MS).toISOString().slice(0, 10)

let seq = 0
/** Short random id; `rand` is injectable for tests. */
export const newId = (prefix: string, rand: () => number = Math.random): string =>
  `${prefix}_${Math.floor(rand() * 36 ** 6).toString(36).padStart(6, '0')}${(seq++ % 36).toString(36)}`

export const cityName = (code: string, names: Record<string, string> = {}): string => names[code] ?? airport(code)?.city ?? code

/** Splits the nights between destinations as evenly as possible; earlier stops get the extra night. */
export function splitDestinations(dests: Pick<Destination, 'id' | 'name' | 'airport' | 'country'>[], start: IsoDate, end: IsoDate): Destination[] {
  const nights = Math.max(0, Math.round((Date.parse(end) - Date.parse(start)) / DAY_MS))
  let at = start
  return dests.map((d, i) => {
    const share = Math.floor(nights / dests.length) + (i < nights % dests.length ? 1 : 0)
    const arrive = at
    at = i === dests.length - 1 ? end : addDays(at, share)
    return { ...d, arrive, depart: at }
  })
}

/** Where the traveler sleeps on a given night (the destination whose stay covers it), else the last one. */
function destinationFor(trip: Pick<Trip, 'destinations'>, date: IsoDate): Destination | undefined {
  return trip.destinations.find((d) => date >= d.arrive && date < d.depart) ?? trip.destinations.at(-1)
}

/** One day per date, titled from the plan; keeps titles and map layers the user already has for a date. */
export function buildDays(trip: Pick<Trip, 'startDate' | 'endDate' | 'destinations' | 'days' | 'home'>): TripDayPlan[] {
  const old = new Map(trip.days.map((d) => [d.date, d]))
  const dates = tripDates(trip)
  return dates.map((date, i) => {
    const dest = destinationFor(trip, date)
    const prev = i > 0 ? destinationFor(trip, dates[i - 1]) : undefined
    const auto =
      i === 0 ? `Fly to ${trip.destinations[0]?.name ?? 'the trip'}`
      : i === dates.length - 1 ? `Fly home from ${dest?.name ?? ''}`.trim()
      : prev && dest && prev.id !== dest.id ? `${prev.name} → ${dest.name}`
      : dest?.name ?? ''
    const kept = old.get(date)
    return { date, title: kept?.title ?? auto, destinationId: dest?.id, ...(kept?.mapLayerId ? { mapLayerId: kept.mapLayerId } : {}) }
  })
}

export interface NewTripInput {
  title?: string
  home: string
  destinations: { code: string; name?: string }[]
  startDate: IsoDate
  nights: number
  adults: number
  childrenAges?: number[]
}

export function makeTravelers(adults: number, childrenAges: number[] = [], keep: Traveler[] = []): Traveler[] {
  const grown = keep.filter((t) => t.kind === 'adult')
  const kids = keep.filter((t) => t.kind === 'child')
  return [
    ...Array.from({ length: adults }, (_, i) => grown[i] ?? { id: newId('p'), name: `Adult ${i + 1}`, kind: 'adult' as const }),
    ...childrenAges.map((age, i) => ({ ...(kids[i] ?? { id: newId('p'), name: `Child ${i + 1}` }), kind: 'child' as const, age })),
  ]
}

export function createTrip(input: NewTripInput, now = new Date()): Trip {
  const endDate = addDays(input.startDate, input.nights)
  const destinations = splitDestinations(
    input.destinations.map((d) => ({ id: newId('d'), name: d.name ?? cityName(d.code), airport: d.code, country: airport(d.code)?.country })),
    input.startDate,
    endDate,
  )
  const names = destinations.map((d) => d.name)
  const base: Trip = {
    schema: TRIP_SCHEMA_VERSION,
    id: newId('trip'),
    title: input.title?.trim() || names.join(' & '),
    status: 'idea',
    startDate: input.startDate,
    endDate,
    home: input.home,
    travelers: makeTravelers(input.adults, input.childrenAges),
    destinations,
    days: [],
    flights: [],
    stays: [],
    apps: {},
    notes: '',
    createdAt: now.toISOString(),
    updatedAt: now.toISOString(),
  }
  return { ...base, days: buildDays(base) }
}

/** The night a traveler first needs a bed: an arrival after midnight still counts as the evening before. */
export function firstNight(arrives: string): IsoDate {
  const date = arrives.slice(0, 10)
  const hour = Number(arrives.slice(11, 13))
  return hour < 6 ? addDays(date, -1) : date
}

function legsToFlights(h: FlightsHandoff): FlightLeg[] {
  const home = h.legs[0].origin
  return h.legs.map((l, i) => ({
    id: newId('f'),
    direction: i === 0 ? 'outbound' : i === h.legs.length - 1 && l.destination === home ? 'return' : 'between',
    origin: l.origin,
    destination: l.destination,
    departs: l.departs,
    arrives: l.arrives,
    airlines: l.airlines,
    flightNumbers: l.flightNumbers,
    stops: l.stops,
    ...(l.price != null ? { price: l.price, currency: h.currency } : {}),
    ...(l.bookingUrl ? { bookingUrl: l.bookingUrl } : {}),
    booked: false,
    source: 'skyhop',
  }))
}

/** Airports the traveler stays at, in order: every arrival but home, plus an open-jaw departure airport. */
function visitedAirports(h: FlightsHandoff): string[] {
  const home = h.legs[0].origin
  const out: string[] = []
  for (const l of h.legs) {
    if (l.origin !== home && out.at(-1) !== l.origin) out.push(l.origin)
    if (l.destination !== home && out.at(-1) !== l.destination) out.push(l.destination)
  }
  return out
}

export const flightTotal = (t: Pick<Trip, 'flights'>): number => t.flights.reduce((n, f) => n + (f.price ?? 0), 0)
export const stayTotal = (t: Pick<Trip, 'stays'>): number => t.stays.reduce((n, s) => n + (s.price ?? 0), 0)

function withBudget(t: Trip): Trip {
  const currency = t.flights.find((f) => f.currency)?.currency ?? t.stays.find((s) => s.currency)?.currency ?? t.budget?.currency
  if (!currency) return t
  return { ...t, budget: { ...t.budget, currency, planned: flightTotal(t) + stayTotal(t) } }
}

/**
 * Puts the flights picked in Skyhop on a trip (or starts a new trip from them).
 * The trip's dates follow the flights; destinations keep their names when the airports match.
 */
export function applyFlights(trip: Trip | undefined, h: FlightsHandoff, now = new Date()): Trip {
  const flights = legsToFlights(h)
  const first = h.legs[0]
  const last = h.legs.at(-1)!
  const roundTrip = h.legs.length > 1 && last.destination === first.origin
  const startDate = first.departs.slice(0, 10)
  const endDate = roundTrip ? last.departs.slice(0, 10) : last.arrives.slice(0, 10)
  const codes = visitedAirports(h)

  const known = trip?.destinations ?? []
  const sameStops = known.length === codes.length && known.every((d, i) => d.airport === codes[i])
  const stops = sameStops ? known : codes.map((c) => ({ id: newId('d'), name: cityName(c, h.names), airport: c, country: airport(c)?.country }))

  // The first stay starts on the night of arrival, the last ends the day the flight home leaves
  const arriveNight = firstNight(first.arrives)
  let destinations = splitDestinations(stops, arriveNight, endDate)
  // Between-legs pin the change of city to the day that flight leaves
  const between = h.legs.slice(1, roundTrip ? -1 : undefined)
  if (between.length === destinations.length - 1)
    destinations = destinations.map((d, i) => ({
      ...d,
      ...(i > 0 ? { arrive: firstNight(between[i - 1].arrives) } : {}),
      ...(i < between.length ? { depart: between[i].departs.slice(0, 10) } : {}),
    }))

  const base: Trip = trip ?? {
    schema: TRIP_SCHEMA_VERSION,
    id: newId('trip'),
    title: destinations.map((d) => d.name).join(' & '),
    status: 'planning',
    startDate,
    endDate,
    home: first.origin,
    travelers: [],
    destinations: [],
    days: [],
    flights: [],
    stays: [],
    apps: {},
    notes: '',
    createdAt: now.toISOString(),
    updatedAt: now.toISOString(),
  }
  const searchIds = [...new Set([...(base.apps.skyhop?.searchIds ?? []), ...(h.searchId ? [h.searchId] : [])])]
  const next: Trip = {
    ...base,
    status: base.status === 'idea' ? 'planning' : base.status,
    startDate,
    endDate,
    home: first.origin,
    travelers: makeTravelers(h.adults, h.childrenAges, base.travelers),
    destinations,
    flights: [...base.flights.filter((f) => f.source === 'manual'), ...flights],
    apps: { ...base.apps, skyhop: { ...base.apps.skyhop, searchIds } },
    updatedAt: now.toISOString(),
  }
  return withBudget({ ...next, days: buildDays(next) })
}

export interface Coverage {
  destination: Destination
  nights: IsoDate[]
  /** Nights with no stay yet */
  open: IsoDate[]
  /** The first gap as a check-in/check-out pair, ready for a hotel search */
  gap?: { checkIn: IsoDate; checkOut: IsoDate }
}

/** For each destination: which nights already have a bed. */
export function stayCoverage(trip: Pick<Trip, 'destinations' | 'stays'>): Coverage[] {
  return trip.destinations.map((destination) => {
    const nights: IsoDate[] = []
    for (let d = destination.arrive; d < destination.depart; d = addDays(d, 1)) nights.push(d)
    const open = nights.filter((n) => !trip.stays.some((s) => n >= s.checkIn && n < s.checkOut))
    let gap: Coverage['gap']
    if (open.length) {
      let end = open[0]
      while (open.includes(addDays(end, 1))) end = addDays(end, 1)
      gap = { checkIn: open[0], checkOut: addDays(end, 1) }
    }
    return { destination, nights, open, gap }
  })
}

export function addStay(trip: Trip, stay: Omit<Stay, 'id'>, now = new Date()): Trip {
  return withBudget({ ...trip, stays: [...trip.stays, { id: newId('s'), ...stay }].sort((a, b) => a.checkIn.localeCompare(b.checkIn)), updatedAt: now.toISOString() })
}

export function removeStay(trip: Trip, id: string, now = new Date()): Trip {
  return withBudget({ ...trip, stays: trip.stays.filter((s) => s.id !== id), updatedAt: now.toISOString() })
}

export const adultsOf = (t: Pick<Trip, 'travelers'>): number => t.travelers.filter((p) => p.kind === 'adult').length
export const childAges = (t: Pick<Trip, 'travelers'>): number[] => t.travelers.filter((p) => p.kind === 'child').map((p) => p.age ?? 8)

/** Hotel and apartment searches with the city, dates and group size already filled in. */
export function staySearchLinks(trip: Pick<Trip, 'travelers'>, d: Pick<Destination, 'name'>, checkIn: IsoDate, checkOut: IsoDate): { name: string; url: string }[] {
  const adults = adultsOf(trip)
  const kids = childAges(trip)
  const booking = new URLSearchParams({ ss: d.name, checkin: checkIn, checkout: checkOut, group_adults: String(adults), group_children: String(kids.length), no_rooms: '1' })
  kids.forEach((a) => booking.append('age', String(a)))
  const airbnb = new URLSearchParams({ checkin: checkIn, checkout: checkOut, adults: String(adults), ...(kids.length ? { children: String(kids.length) } : {}) })
  return [
    { name: 'Booking.com', url: `https://www.booking.com/searchresults.html?${booking}` },
    { name: 'Airbnb', url: `https://www.airbnb.com/s/${encodeURIComponent(d.name)}/homes?${airbnb}` },
  ]
}

/**
 * Opens Skyhop with the search filled in from the trip: a window of `flex` days around the dates,
 * the trip's length, and open-jaw when the trip ends somewhere else. `hub` is where Skyhop sends the flights back.
 */
export function skyhopSearchUrl(trip: Trip, skyhopUrl: string, hub: string, flex = 3): string {
  const airports = trip.destinations.map((d) => d.airport).filter((a): a is string => Boolean(a))
  const nights = Math.round((Date.parse(trip.endDate) - Date.parse(trip.startDate)) / DAY_MS)
  const q = new URLSearchParams({
    from: trip.home,
    to: airports[0] ?? '',
    ...(airports.length > 1 && airports.at(-1) !== airports[0] ? { back: airports.at(-1)! } : {}),
    start: addDays(trip.startDate, -flex),
    end: addDays(trip.endDate, flex),
    nights: String(nights),
    adults: String(adultsOf(trip)),
    ...(childAges(trip).length ? { children: childAges(trip).join(',') } : {}),
    trip: trip.id,
    hub,
  })
  return `${skyhopUrl}?${q}`
}
