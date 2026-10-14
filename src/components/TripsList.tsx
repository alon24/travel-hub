import { passDate, tripNights, tripRoute } from '../model/trip.ts'
import type { Trip } from '../model/types.ts'

/** The trips saved in this browser, newest first, plus a way to start one. */
export function TripsList({ trips }: { trips: Trip[] }) {
  return (
    <section id="trips" aria-labelledby="trips-title">
      <div className="section-head">
        <span className="label">Your trips</span>
        <h2 id="trips-title">{trips.length ? 'Pick up where you left off.' : 'Start with where and when.'}</h2>
      </div>
      <div className="trips">
        {trips.map((t) => {
          const r = tripRoute(t)
          return (
            <a key={t.id} className="trip-card" href={`#/trip/${t.id}`}>
              <span className="label">{t.status}</span>
              <b>{t.title}</b>
              <span className="mono">{r.from} → {r.to}{r.backFrom !== r.to ? ` · home from ${r.backFrom}` : ''}</span>
              <span className="mono muted">{t.flexible ? `${passDate(t.flexible.from)}–${passDate(t.flexible.to)}` : passDate(t.startDate)} · {tripNights(t)}N · {t.travelers.length} pax</span>
            </a>
          )
        })}
        <a className="trip-card new" href="#/new"><b>＋ Plan a trip</b><span className="muted">Cities, dates and who's coming. Skyhop and MyMaps AI do the rest.</span></a>
      </div>
    </section>
  )
}
