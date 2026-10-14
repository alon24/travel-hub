import type { Trip } from '../model/types.ts'
import { passDate, travelerSummary, tripNights, tripRoute } from '../model/trip.ts'

/** A Trip drawn as a boarding pass. Every value comes from the Trip object. */
export function TripPass({ trip, label }: { trip: Trip; label?: string }) {
  const route = tripRoute(trip)
  const mapDays = trip.days.filter((d) => d.mapLayerId).length
  return (
    <article className="pass" aria-label={`Trip: ${trip.title}`}>
      <div className="pass-main">
        <div className="pass-top">
          <span className="label">{label ?? 'Trip'}</span>
          <span className="label">schema v{trip.schema}</span>
        </div>
        <h3 className="pass-title">{trip.title}</h3>
        <div className="route" aria-label={`${route.from} to ${route.to}, home from ${route.backFrom}`}>
          <span className="code">{route.from}</span>
          <span className="path" />
          <span className="code">{route.to}</span>
        </div>
        <dl className="fields">
          {trip.flexible ? (
            <>
              <div><dt className="label">Leave from</dt><dd>{passDate(trip.flexible.from)}</dd></div>
              <div><dt className="label">Back by</dt><dd>{passDate(trip.flexible.to)}</dd></div>
            </>
          ) : (
            <>
              <div><dt className="label">Depart</dt><dd>{passDate(trip.startDate)}</dd></div>
              <div><dt className="label">Return</dt><dd>{passDate(trip.endDate)}</dd></div>
            </>
          )}
          <div><dt className="label">Nights</dt><dd>{tripNights(trip)}</dd></div>
          <div><dt className="label">Travelers</dt><dd>{travelerSummary(trip)}</dd></div>
          <div><dt className="label">Stays</dt><dd>{trip.stays.length}</dd></div>
          <div><dt className="label">Back from</dt><dd>{route.backFrom}</dd></div>
        </dl>
        <div className="chips">
          <span className="chip"><span className="dot dot--sky" />Skyhop · {trip.flights.length} legs</span>
          <span className="chip"><span className="dot dot--map" />MyMaps · {mapDays} day layers</span>
        </div>
      </div>
      <div className="pass-stub" aria-hidden="true">
        <span className="status">{trip.status}</span>
        <span className="barcode" />
      </div>
    </article>
  )
}
