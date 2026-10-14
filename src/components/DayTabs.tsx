import { t } from '../i18n.ts'
import { useState, type FormEvent } from 'react'
import type { PlaceIdea } from '../lib/placesAi.ts'
import { addPlace, cityOn, dayDirectionsUrl, dayPlaces, mapsPlaceUrl, movePlace, removePlace, stayOn } from '../model/itinerary.ts'
import { dayLabel } from '../model/trip.ts'
import type { Trip } from '../model/types.ts'

const fmtTime = (t: string) => t.slice(11, 16)

/** The itinerary: one tab per trip day, each with its places, a Maps link per place and directions for the day. */
export function DayTabs({ trip, onChange, suggest }: { trip: Trip; onChange: (trip: Trip) => void; /** AI ideas for a city; absent when the AI isn't available */ suggest?: (city: string, have: string[]) => Promise<PlaceIdea[]> }) {
  const [date, setDate] = useState(trip.days[0]?.date ?? '')
  const [name, setName] = useState('')
  const [ideas, setIdeas] = useState<PlaceIdea[]>([])
  const [busy, setBusy] = useState(false)
  const [ideaError, setIdeaError] = useState('')
  const dayIndex = Math.max(0, trip.days.findIndex((d) => d.date === date))
  const day = trip.days[dayIndex]
  if (!day) return null
  const city = cityOn(trip, day.date)?.name
  const places = dayPlaces(trip, day.date)
  const stay = stayOn(trip, day.date)
  const flights = trip.flights.filter((f) => f.departs.slice(0, 10) === day.date || f.arrives.slice(0, 10) === day.date)
  const directions = dayDirectionsUrl(trip, day.date)

  const pick = (d: string) => { setDate(d); setIdeas([]); setIdeaError('') }
  const ask = async () => {
    if (!suggest || !city) return
    setBusy(true); setIdeaError('')
    try { setIdeas(await suggest(city, places.map((p) => p.name))) } catch (err) { setIdeaError(err instanceof Error ? err.message : t('Could not get ideas')) } finally { setBusy(false) }
  }
  const take = (idea: PlaceIdea) => {
    onChange(addPlace(trip, day.date, idea.name))
    setIdeas((all) => all.filter((i) => i !== idea))
  }

  const add = (e: FormEvent) => {
    e.preventDefault()
    if (!name.trim()) return
    onChange(addPlace(trip, day.date, name))
    setName('')
  }

  return (
    <div className="day-tabs" data-help="itinerary">
      <div role="tablist" aria-label={t('Trip days')} className="tabs">
        {trip.days.map((d, i) => (
          <button key={d.date} type="button" role="tab" id={`tab-${d.date}`} aria-selected={d.date === day.date} aria-controls="day-panel"
            className={`tab ${d.date === day.date ? 'on' : ''}`} onClick={() => pick(d.date)}>
            <span className="mono">D{i + 1}</span>
            <span className="hint">{dayLabel(d.date)}</span>
          </button>
        ))}
      </div>
      <div role="tabpanel" id="day-panel" aria-labelledby={`tab-${day.date}`} className="day-panel">
        <h3>{dayLabel(day.date)}{day.title ? ` · ${day.title}` : ''}</h3>
        {flights.map((f) => (
          <p key={f.id} className="day-fixed">✈️ <span className="mono">{f.departs.slice(0, 10) === day.date ? `${fmtTime(f.departs)} ${f.origin} → ${f.destination}` : t('Lands {time} {to}', { time: fmtTime(f.arrives), to: f.destination })}</span></p>
        ))}
        {stay && <p className="day-fixed">🏨 {stay.name} <span className="hint">{stay.checkOut === day.date ? t('check-out') : stay.checkIn === day.date ? t('check-in') : ''}</span></p>}
        {places.length ? (
          <ol className="places" aria-label={t('Places')}>
            {places.map((p, i) => (
              <li key={p.id}>
                <span className="mono">{i + 1}</span>
                <b>{p.name}</b>
                <span className="h-actions">
                  <a className="btn small" href={mapsPlaceUrl(p, city)} target="_blank" rel="noopener" aria-label={t('Open {name} in Google Maps', { name: p.name })}>{t('Open in Google Maps ↗')}</a>
                  <button type="button" className="x" aria-label={t('Move {name} up', { name: p.name })} disabled={i === 0} onClick={() => onChange(movePlace(trip, day.date, p.id, -1))}>↑</button>
                  <button type="button" className="x" aria-label={t('Move {name} down', { name: p.name })} disabled={i === places.length - 1} onClick={() => onChange(movePlace(trip, day.date, p.id, 1))}>↓</button>
                  <button type="button" className="x" aria-label={t('Remove {name}', { name: p.name })} onClick={() => onChange(removePlace(trip, day.date, p.id))}>×</button>
                </span>
              </li>
            ))}
          </ol>
        ) : (
          <p className="hint">{city ? t('Nothing planned for this day yet. Add a place you want to see in {city}.', { city }) : t('Nothing planned for this day yet. Add a place you want to see.')}</p>
        )}
        <form className="place-form" onSubmit={add} aria-label={t('Add a place')}>
          <input aria-label={t('Place name')} placeholder={city ? t('Add a place in {city}', { city }) : t('Add a place')} value={name} onChange={(e) => setName(e.target.value)} />
          <button type="submit" className="btn small solid">{t('＋ Add')}</button>
        </form>
        {suggest && city && (
          <div className="ideas">
            <button type="button" className="btn small" disabled={busy} onClick={ask}>{busy ? t('Thinking…') : t('✨ Suggest places in {city}', { city })}</button>
            {ideaError && <p className="hint" role="alert">{ideaError}</p>}
            {ideas.length > 0 && (
              <ul aria-label={t('Suggested places')}>
                {ideas.map((i) => (
                  <li key={i.name}>
                    <span><b>{i.name}</b>{i.note && <span className="hint"> · {i.note}</span>}</span>
                    <button type="button" className="btn small solid" aria-label={t('Add {name}', { name: i.name })} onClick={() => take(i)}>{t('＋ Add')}</button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
        {directions && (
          <a className="btn solid" href={directions} target="_blank" rel="noopener">{t('🧭 Directions in Google Maps ↗')}</a>
        )}
      </div>
    </div>
  )
}
