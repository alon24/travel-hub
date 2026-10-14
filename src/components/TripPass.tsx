import { plural, t } from '../i18n.ts'
import type { Trip } from '../model/types.ts'
import { passDate, travelerSummary, tripNights, tripRoute } from '../model/trip.ts'

/** A Trip drawn as a boarding pass. Every value comes from the Trip object. */
export function TripPass({ trip, label }: { trip: Trip; label?: string }) {
  const route = tripRoute(trip)
  const mapDays = trip.days.filter((d) => d.mapLayerId).length
  return (
    <article className="pass" aria-label={t('Trip: {title}', { title: trip.title })}>
      <div className="pass-main">
        <div className="pass-top">
          <span className="label">{label ?? t('Trip')}</span>
          <span className="label">schema v{trip.schema}</span>
        </div>
        <h3 className="pass-title">{trip.title}</h3>
        <div className="route" aria-label={t('{from} to {to}, home from {back}', { from: route.from, to: route.to, back: route.backFrom })}>
          <span className="code">{route.from}</span>
          <span className="path" />
          <span className="code">{route.to}</span>
        </div>
        <dl className="fields">
          {trip.flexible ? (
            <>
              <div><dt className="label">{t('Leave from')}</dt><dd>{passDate(trip.flexible.from)}</dd></div>
              <div><dt className="label">{t('Back by')}</dt><dd>{passDate(trip.flexible.to)}</dd></div>
            </>
          ) : (
            <>
              <div><dt className="label">{t('Depart')}</dt><dd>{passDate(trip.startDate)}</dd></div>
              <div><dt className="label">{t('Return')}</dt><dd>{passDate(trip.endDate)}</dd></div>
            </>
          )}
          <div><dt className="label">{t('Nights')}</dt><dd>{tripNights(trip)}</dd></div>
          <div><dt className="label">{t('Travelers')}</dt><dd>{travelerSummary(trip)}</dd></div>
          <div><dt className="label">{t('Stays')}</dt><dd>{trip.stays.length}</dd></div>
          <div><dt className="label">{t('Back from')}</dt><dd>{route.backFrom}</dd></div>
        </dl>
        <div className="chips">
          <span className="chip"><span className="dot dot--sky" />Skyhop · {plural(trip.flights.length, 'leg')}</span>
          <span className="chip"><span className="dot dot--map" />MyMaps · {plural(mapDays, 'day layer')}</span>
        </div>
      </div>
      <div className="pass-stub" aria-hidden="true">
        <span className="status">{t(trip.status)}</span>
        <span className="barcode" />
      </div>
    </article>
  )
}
