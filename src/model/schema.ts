import { z } from 'zod'
import { TRIP_SCHEMA_VERSION, type Trip } from './types.ts'

const isoDate = z.iso.date()
const isoDateTime = z.iso.datetime({ offset: true })
/** Airline times are local to the airport; an offset is optional */
const flightTime = z.iso.datetime({ offset: true, local: true })
const iata = z.string().regex(/^[A-Z]{3}$/, 'Expected a 3-letter airport code, e.g. TLV')

const traveler = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  kind: z.enum(['adult', 'child']),
  age: z.number().int().min(0).max(17).optional(),
})

const destination = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  country: z.string().optional(),
  airport: iata.optional(),
  arrive: isoDate,
  depart: isoDate,
})

const place = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  note: z.string().optional(),
  location: z.tuple([z.number().min(-180).max(180), z.number().min(-90).max(90)]).optional(),
})

const day = z.object({
  date: isoDate,
  title: z.string().optional(),
  destinationId: z.string().optional(),
  mapLayerId: z.string().optional(),
  places: z.array(place).optional(),
})

const flight = z.object({
  id: z.string().min(1),
  direction: z.enum(['outbound', 'between', 'return']),
  origin: iata,
  destination: iata,
  departs: flightTime,
  arrives: flightTime,
  airlines: z.array(z.string()),
  flightNumbers: z.array(z.string()),
  stops: z.number().int().min(0),
  price: z.number().min(0).optional(),
  currency: z.string().length(3).optional(),
  bookingUrl: z.url().optional(),
  bookingRef: z.string().optional(),
  booked: z.boolean(),
  source: z.enum(['skyhop', 'manual']),
})

const stay = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  destinationId: z.string().optional(),
  checkIn: isoDate,
  checkOut: isoDate,
  price: z.number().min(0).optional(),
  currency: z.string().length(3).optional(),
  address: z.string().optional(),
  location: z.tuple([z.number().min(-180).max(180), z.number().min(-90).max(90)]).optional(),
  url: z.url().optional(),
  bookingRef: z.string().optional(),
})

export const tripSchema = z
  .object({
    schema: z.literal(TRIP_SCHEMA_VERSION),
    id: z.string().min(1),
    title: z.string().min(1),
    status: z.enum(['idea', 'planning', 'booked', 'travelling', 'done']),
    startDate: isoDate,
    endDate: isoDate,
    flexible: z.object({ from: isoDate, to: isoDate }).optional(),
    nightsMax: z.number().int().min(2).max(60).optional(),
    home: iata,
    travelers: z.array(traveler),
    destinations: z.array(destination),
    countries: z.array(z.string().regex(/^[A-Z]{2}$/)).optional(),
    days: z.array(day),
    flights: z.array(flight),
    stays: z.array(stay),
    apps: z.object({
      mymaps: z.object({ mapId: z.string().min(1), driveFileId: z.string().optional() }).optional(),
      skyhop: z.object({ searchIds: z.array(z.string()), sharedTripUrl: z.url().optional() }).optional(),
    }),
    budget: z
      .object({ currency: z.string().length(3), planned: z.number().min(0).optional(), spent: z.number().min(0).optional() })
      .optional(),
    request: z.object({ original: z.string().min(1), current: z.string().optional(), sig: z.string() }).optional(),
    notes: z.string(),
    createdAt: isoDateTime,
    updatedAt: isoDateTime,
  })
  .refine((t) => t.endDate >= t.startDate, { message: 'endDate is before startDate', path: ['endDate'] })
  .refine((t) => t.days.every((d) => d.date >= t.startDate && d.date <= t.endDate), {
    message: 'A day falls outside the trip dates',
    path: ['days'],
  })

/** Validates unknown JSON (a file, Drive, another app) as a Trip. Throws with readable messages. */
export function parseTrip(raw: unknown): Trip {
  const result = tripSchema.safeParse(raw)
  if (!result.success) throw new Error(`Invalid trip: ${z.prettifyError(result.error)}`)
  return result.data
}
