import { t } from '../i18n.ts'
import { passDate, tripNights, tripRoute } from '../model/trip.ts'
import type { Trip } from '../model/types.ts'

/** The trips saved in this browser, newest first, plus a way to start one. */
export function TripsList({ trips }: { trips: Trip[] }) {
  return (
    <section id="trips" aria-labelledby="trips-title">
      <div className="section-head">
        <span className="label">{t('Your trips')}</span>
        <h2 id="trips-title">{trips.length ? t('Pick up where you left off.') : t('Start with where and when.')}</h2>
      </div>
      <div className="trips">
        {trips.map((trip) => {
          const r = tripRoute(trip)
          return (
            <a key={trip.id} className="trip-card" href={`#/trip/${trip.id}`}>
              <span className="label">{t(trip.status)}</span>
              <b>{trip.title}</b>
              <span className="mono">{r.from} → {r.to}{r.backFrom !== r.to ? t(' · home from {code}', { code: r.backFrom }) : ''}</span>
              <span className="mono muted">{trip.flexible ? `${passDate(trip.flexible.from)}–${passDate(trip.flexible.to)}` : passDate(trip.startDate)} · {tripNights(trip)}N · {trip.travelers.length} pax</span>
            </a>
          )
        })}
        <a className="trip-card new" href="#/new"><b>{t('＋ Plan a trip')}</b><span className="muted">{t("Cities, dates and who's coming. Skyhop and MyMaps AI do the rest.")}</span></a>
      </div>
    </section>
  )
}
