/**
 * Trip: one object that holds everything about a single trip.
 *
 * MyMaps AI and Skyhop each keep their own data (a MapDoc in Google Drive, saved
 * flight searches). A Trip ties them together by reference and adds what neither
 * app owns: the trip's dates, who is going, where they sleep and the budget.
 *
 * Like Skyhop, a Trip never stores payment or passport details.
 */

export const TRIP_SCHEMA_VERSION = 1

/** YYYY-MM-DD */
export type IsoDate = string
/** ISO 8601 timestamp, e.g. 2027-03-12T07:40:00+02:00 */
export type IsoDateTime = string
/** 3-letter IATA code, e.g. "TLV" */
export type Iata = string

export type TripStatus = 'idea' | 'planning' | 'booked' | 'travelling' | 'done'

export interface Trip {
  schema: typeof TRIP_SCHEMA_VERSION
  id: string
  title: string
  status: TripStatus

  startDate: IsoDate
  endDate: IsoDate
  /** Home airport, where the trip starts and ends */
  home: Iata

  travelers: Traveler[]
  /** In travel order */
  destinations: Destination[]
  /** One entry per calendar day from startDate to endDate */
  days: TripDayPlan[]
  flights: FlightLeg[]
  stays: Stay[]

  /** Links into the other apps */
  apps: TripApps

  budget?: Budget
  notes: string
  createdAt: IsoDateTime
  updatedAt: IsoDateTime
}

export interface Traveler {
  id: string
  name: string
  kind: 'adult' | 'child'
  /** Children only: Skyhop prices by age */
  age?: number
}

export interface Destination {
  id: string
  name: string
  country?: string
  /** Nearest airport, used for Skyhop searches */
  airport?: Iata
  arrive: IsoDate
  depart: IsoDate
}

export interface TripDayPlan {
  date: IsoDate
  title?: string
  destinationId?: string
  /** Id of the matching day layer in the MyMaps AI map (Layer.day.date === date) */
  mapLayerId?: string
}

export interface FlightLeg {
  id: string
  direction: 'outbound' | 'between' | 'return'
  origin: Iata
  destination: Iata
  departs: IsoDateTime
  arrives: IsoDateTime
  airlines: string[]
  /** e.g. ["LY387"] or ["W62331", "W64412"] */
  flightNumbers: string[]
  stops: number
  price?: number
  currency?: string
  /** Airline site link, from Skyhop's deep_links */
  bookingUrl?: string
  /** Airline confirmation code once booked (no payment data) */
  bookingRef?: string
  booked: boolean
  source: 'skyhop' | 'manual'
}

export interface Stay {
  id: string
  name: string
  destinationId?: string
  checkIn: IsoDate
  checkOut: IsoDate
  address?: string
  /** [lng, lat], same order as GeoJSON in MyMaps AI */
  location?: [number, number]
  url?: string
  bookingRef?: string
}

export interface TripApps {
  mymaps?: {
    /** MapDoc.id */
    mapId: string
    /** MapDoc.driveFileId, so the map opens from Google Drive */
    driveFileId?: string
  }
  skyhop?: {
    /** Saved searches that produced the flights on this trip */
    searchIds: string[]
    /** Shared Skyhop trip (group chat) link, if friends are planning too */
    sharedTripUrl?: string
  }
}

export interface Budget {
  currency: string
  planned?: number
  spent?: number
}
