import { useState, type FormEvent, type ReactNode } from 'react'
import { airport } from '../data/airports.ts'
import { geocode } from '../lib/geocode.ts'
import { hubUrl, MYMAPS_URL, SKYHOP_URL } from '../links.ts'
import { mapDocFromTrip, mymapsImportUrl } from '../model/mymaps.ts'
import { addStay, adultsOf, flightTotal, removeStay, skyhopSearchUrl, stayCoverage, staySearchLinks, stayTotal, type Coverage } from '../model/plan.ts'
import { dayLabel, tripNights } from '../model/trip.ts'
import type { FlightLeg, Trip } from '../model/types.ts'
import { TripPass } from './TripPass.tsx'

interface Props {
  trip: Trip
  onChange: (trip: Trip) => void
  onDelete: () => void
  /** Leaves the page (Skyhop, MyMaps). Injectable for tests. */
  navigate?: (url: string) => void
  geocoder?: typeof geocode
  /** Planning it with friends (TripShare); only when signed in to Drive */
  share?: ReactNode
}

const fmtDay = dayLabel
const fmtTime = (t: string) => t.slice(11, 16)
const money = (n: number, currency = 'ILS') => new Intl.NumberFormat('en-GB', { style: 'currency', currency, maximumFractionDigits: 0 }).format(n)
const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`

/** Everything about one trip, with the next step always one tap away. */
export function TripPage({ trip, onChange, onDelete, navigate = (u) => window.location.assign(u), geocoder = geocode, share }: Props) {
  const coverage = stayCoverage(trip)
  const openNights = coverage.reduce((n, c) => n + c.open.length, 0)
  const currency = trip.budget?.currency ?? 'ILS'
  const people = trip.travelers.length || 1
  const total = flightTotal(trip) + stayTotal(trip)
  const step = !trip.flights.length ? 'flights' : openNights ? 'stays' : !trip.apps.mymaps ? 'map' : 'done'

  const openMap = () => {
    const { doc, trip: linked } = mapDocFromTrip(trip)
    onChange(linked)
    navigate(mymapsImportUrl(MYMAPS_URL, doc))
  }

  return (
    <div className="trip-page">
      <div className="trip-head">
        <a href="#/" className="back">← All trips</a>
        <Steps step={step} />
      </div>
      <div className="trip-grid">
        <div className="trip-side">
          <TripPass trip={trip} label="Trip" />
          <section className="card budget" aria-label="Budget">
            <div><span className="label">Planned</span><b className="mono">{money(total, currency)}</b></div>
            <div><span className="label">Per person</span><b className="mono">{money(total / people, currency)}</b></div>
            <p className="hint">Flights {money(flightTotal(trip), currency)} · stays {money(stayTotal(trip), currency)} · {plural(people, 'traveler')}</p>
          </section>
          {share}
          <button type="button" className="btn small danger" onClick={() => confirm(`Delete "${trip.title}"?`) && onDelete()}>Delete trip</button>
        </div>

        <div className="trip-main">
          <section className={`card sec ${step === 'flights' ? 'next' : ''}`} aria-labelledby="sec-flights">
            <h2 id="sec-flights"><span className="num">1</span>Flights <span className="chip src"><span className="dot dot--sky" />Skyhop</span></h2>
            {trip.flights.length ? (
              <>
                <ul className="legs">{trip.flights.map((f) => <Leg key={f.id} f={f} />)}</ul>
                <a className="link" href={skyhopSearchUrl(trip, SKYHOP_URL, hubUrl())}>Change flights in Skyhop</a>
              </>
            ) : (
              <div className="empty">
                <p>
                  Skyhop will check every day from {fmtDay(trip.startDate)} ± 3 days for {plural(tripNights(trip), 'night')}, {plural(adultsOf(trip), 'adult')}
                  {trip.destinations.length > 1 ? `, flying home from ${trip.destinations.at(-1)!.name}` : ''}.
                </p>
                <button type="button" className="btn solid" onClick={() => navigate(skyhopSearchUrl(trip, SKYHOP_URL, hubUrl()))}>Find flights in Skyhop →</button>
              </div>
            )}
          </section>

          <section className={`card sec ${step === 'stays' ? 'next' : ''}`} aria-labelledby="sec-stays">
            <h2 id="sec-stays"><span className="num">2</span>Where you sleep
              <span className={`chip src ${openNights ? '' : 'ok'}`}>{openNights ? `${plural(openNights, 'night')} open` : 'Every night covered'}</span>
            </h2>
            {coverage.map((c) => (
              <StayRow key={c.destination.id} trip={trip} c={c} geocoder={geocoder} onChange={onChange} />
            ))}
          </section>

          <section className={`card sec ${step === 'map' ? 'next' : ''}`} aria-labelledby="sec-days">
            <h2 id="sec-days"><span className="num">3</span>Day by day <span className="chip src"><span className="dot dot--map" />MyMaps AI</span></h2>
            <ol className="days">
              {trip.days.map((d, i) => (
                <li key={d.date}>
                  <span className="mono day-n">D{i + 1}</span>
                  <span className="mono">{fmtDay(d.date)}</span>
                  <span>{d.title}</span>
                </li>
              ))}
            </ol>
            <div className="sec-actions">
              <button type="button" className={`btn ${step === 'map' ? 'solid' : ''}`} onClick={openMap}>
                {trip.apps.mymaps ? 'Open the map in MyMaps AI →' : 'Plan the days on a map →'}
              </button>
              <span className="hint">A layer per day, with your hotels and airports already on it. Ask MyMaps AI to fill in the places.</span>
            </div>
          </section>
        </div>
      </div>
    </div>
  )
}

function Steps({ step }: { step: string }) {
  const items = [['flights', 'Flights'], ['stays', 'Stays'], ['map', 'Days'], ['done', 'Ready']]
  const at = items.findIndex(([k]) => k === step)
  return (
    <ol className="steps" aria-label="Progress">
      {items.map(([k, label], i) => (
        <li key={k} className={i < at ? 'done' : i === at ? 'now' : ''} aria-current={i === at ? 'step' : undefined}>{label}</li>
      ))}
    </ol>
  )
}

function Leg({ f }: { f: FlightLeg }) {
  const dir = f.direction === 'outbound' ? 'OUT' : f.direction === 'return' ? 'HOME' : 'NEXT'
  const nextDay = f.arrives.slice(0, 10) > f.departs.slice(0, 10) ? '+1' : ''
  return (
    <li className="leg">
      <span className="label">{dir}</span>
      <span>
        <b className="mono">{fmtDay(f.departs.slice(0, 10))} · {fmtTime(f.departs)} {f.origin} → {fmtTime(f.arrives)}{nextDay} {f.destination}</b>
        <span className="hint"> {f.airlines.join(' + ')} · {f.stops ? plural(f.stops, 'stop') : 'direct'}</span>
      </span>
      <span className="mono">{f.price != null ? money(f.price, f.currency) : ''}</span>
    </li>
  )
}

function StayRow({ trip, c, onChange, geocoder }: { trip: Trip; c: Coverage; onChange: (t: Trip) => void; geocoder: typeof geocode }) {
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const [price, setPrice] = useState('')
  const [url, setUrl] = useState('')
  const [busy, setBusy] = useState(false)
  const stays = trip.stays.filter((s) => s.destinationId === c.destination.id)
  const span = c.nights.length ? `${fmtDay(c.nights[0])} → ${fmtDay(c.destination.depart)}` : ''

  const save = async (e: FormEvent) => {
    e.preventDefault()
    if (!c.gap || !name.trim()) return
    setBusy(true)
    const near = c.destination.airport ? airport(c.destination.airport)?.location : undefined
    const location = await geocoder(`${name.trim()}, ${c.destination.name}`, near)
    const link = /^https?:\/\//.test(url.trim()) ? url.trim() : undefined
    onChange(
      addStay(trip, {
        name: name.trim(),
        destinationId: c.destination.id,
        checkIn: c.gap.checkIn,
        checkOut: c.gap.checkOut,
        ...(Number(price) > 0 ? { price: Number(price), currency: trip.budget?.currency ?? 'ILS' } : {}),
        ...(link ? { url: link } : {}),
        ...(location ? { location } : {}),
      }),
    )
    setBusy(false)
    setOpen(false)
    setName('')
    setPrice('')
    setUrl('')
  }

  return (
    <div className="stay-row">
      <div className="stay-head">
        <b>{c.destination.name}</b>
        <span className="hint mono">{span} · {plural(c.nights.length, 'night')}</span>
      </div>
      {stays.map((s) => (
        <div key={s.id} className="stay">
          <span>🏨 <b>{s.name}</b> <span className="hint">{fmtDay(s.checkIn)} → {fmtDay(s.checkOut)}{s.location ? ' · on the map' : ''}</span></span>
          <span className="mono">{s.price != null ? money(s.price, s.currency) : ''}</span>
          <button type="button" className="x" aria-label={`Remove ${s.name}`} onClick={() => onChange(removeStay(trip, s.id))}>×</button>
        </div>
      ))}
      {c.gap && (
        <div className="stay-gap">
          <span className="hint">Need a bed {fmtDay(c.gap.checkIn)} → {fmtDay(c.gap.checkOut)} for {plural(adultsOf(trip), 'adult')}:</span>
          {staySearchLinks(trip, c.destination, c.gap.checkIn, c.gap.checkOut).map((l) => (
            <a key={l.name} className="btn small" href={l.url} target="_blank" rel="noopener">{l.name} ↗</a>
          ))}
          {!open && <button type="button" className="btn small solid" onClick={() => setOpen(true)}>＋ Add the place you booked</button>}
        </div>
      )}
      {open && c.gap && (
        <form className="stay-form" onSubmit={save} aria-label={`Stay in ${c.destination.name}`}>
          <input aria-label="Hotel or apartment name" placeholder="Hotel or apartment name" value={name} onChange={(e) => setName(e.target.value)} required autoFocus />
          <input aria-label="Total price" placeholder="Total price" inputMode="numeric" value={price} onChange={(e) => setPrice(e.target.value.replace(/[^\d.]/g, ''))} />
          <input aria-label="Link (optional)" placeholder="Link (optional)" value={url} onChange={(e) => setUrl(e.target.value)} />
          <button type="submit" className="btn small solid" disabled={busy}>{busy ? 'Saving…' : 'Save stay'}</button>
          <button type="button" className="btn small" onClick={() => setOpen(false)}>Cancel</button>
        </form>
      )}
    </div>
  )
}
