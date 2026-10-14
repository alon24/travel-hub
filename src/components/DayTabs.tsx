import { useState, type FormEvent } from 'react'
import { addPlace, cityOn, dayDirectionsUrl, dayPlaces, mapsPlaceUrl, movePlace, removePlace, stayOn } from '../model/itinerary.ts'
import { dayLabel } from '../model/trip.ts'
import type { Trip } from '../model/types.ts'

const fmtTime = (t: string) => t.slice(11, 16)

/** The itinerary: one tab per trip day, each with its places, a Maps link per place and directions for the day. */
export function DayTabs({ trip, onChange }: { trip: Trip; onChange: (trip: Trip) => void }) {
  const [date, setDate] = useState(trip.days[0]?.date ?? '')
  const [name, setName] = useState('')
  const dayIndex = Math.max(0, trip.days.findIndex((d) => d.date === date))
  const day = trip.days[dayIndex]
  if (!day) return null
  const city = cityOn(trip, day.date)?.name
  const places = dayPlaces(trip, day.date)
  const stay = stayOn(trip, day.date)
  const flights = trip.flights.filter((f) => f.departs.slice(0, 10) === day.date || f.arrives.slice(0, 10) === day.date)
  const directions = dayDirectionsUrl(trip, day.date)

  const add = (e: FormEvent) => {
    e.preventDefault()
    if (!name.trim()) return
    onChange(addPlace(trip, day.date, name))
    setName('')
  }

  return (
    <div className="day-tabs" data-help="itinerary">
      <div role="tablist" aria-label="Trip days" className="tabs">
        {trip.days.map((d, i) => (
          <button key={d.date} type="button" role="tab" id={`tab-${d.date}`} aria-selected={d.date === day.date} aria-controls="day-panel"
            className={`tab ${d.date === day.date ? 'on' : ''}`} onClick={() => setDate(d.date)}>
            <span className="mono">D{i + 1}</span>
            <span className="hint">{dayLabel(d.date)}</span>
          </button>
        ))}
      </div>
      <div role="tabpanel" id="day-panel" aria-labelledby={`tab-${day.date}`} className="day-panel">
        <h3>{dayLabel(day.date)}{day.title ? ` · ${day.title}` : ''}</h3>
        {flights.map((f) => (
          <p key={f.id} className="day-fixed">✈️ <span className="mono">{f.departs.slice(0, 10) === day.date ? `${fmtTime(f.departs)} ${f.origin} → ${f.destination}` : `Lands ${fmtTime(f.arrives)} ${f.destination}`}</span></p>
        ))}
        {stay && <p className="day-fixed">🏨 {stay.name} <span className="hint">{stay.checkOut === day.date ? 'check-out' : stay.checkIn === day.date ? 'check-in' : ''}</span></p>}
        {places.length ? (
          <ol className="places" aria-label="Places">
            {places.map((p, i) => (
              <li key={p.id}>
                <span className="mono">{i + 1}</span>
                <b>{p.name}</b>
                <span className="h-actions">
                  <a className="btn small" href={mapsPlaceUrl(p, city)} target="_blank" rel="noopener" aria-label={`Open ${p.name} in Google Maps`}>Open in Google Maps ↗</a>
                  <button type="button" className="x" aria-label={`Move ${p.name} up`} disabled={i === 0} onClick={() => onChange(movePlace(trip, day.date, p.id, -1))}>↑</button>
                  <button type="button" className="x" aria-label={`Move ${p.name} down`} disabled={i === places.length - 1} onClick={() => onChange(movePlace(trip, day.date, p.id, 1))}>↓</button>
                  <button type="button" className="x" aria-label={`Remove ${p.name}`} onClick={() => onChange(removePlace(trip, day.date, p.id))}>×</button>
                </span>
              </li>
            ))}
          </ol>
        ) : (
          <p className="hint">Nothing planned for this day yet. Add a place you want to see{city ? ` in ${city}` : ''}.</p>
        )}
        <form className="place-form" onSubmit={add} aria-label="Add a place">
          <input aria-label="Place name" placeholder={`Add a place${city ? ` in ${city}` : ''}`} value={name} onChange={(e) => setName(e.target.value)} />
          <button type="submit" className="btn small solid">＋ Add</button>
        </form>
        {directions && (
          <a className="btn solid" href={directions} target="_blank" rel="noopener">🧭 Directions in Google Maps ↗</a>
        )}
      </div>
    </div>
  )
}
