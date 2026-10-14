import { plural, t } from '../i18n.ts'
import { useEffect, useState, type ComponentProps, type FormEvent, type ReactNode } from 'react'
import { airport } from '../data/airports.ts'
import { geocode } from '../lib/geocode.ts'
import { findHotels, type Hotel, type HotelKind } from '../lib/hotels.ts'
import { hubUrl, MYMAPS_URL, SKYHOP_URL } from '../links.ts'
import { mapDocFromTrip, mymapsImportUrl } from '../model/mymaps.ts'
import { addStay, adultsOf, bookingUrl, flightTotal, removeStay, setStayDates, skyhopSearchUrl, stayCoverage, stayDatesError, staySearchLinks, stayTotal, type Coverage } from '../model/plan.ts'
import { dayLabel, tripNights } from '../model/trip.ts'
import type { FlightLeg, Trip } from '../model/types.ts'
import { DayTabs } from './DayTabs.tsx'
import { TripPass } from './TripPass.tsx'

interface Props {
  trip: Trip
  onChange: (trip: Trip) => void
  onDelete: () => void
  /** Leaves the page (Skyhop, MyMaps). Injectable for tests. */
  navigate?: (url: string) => void
  geocoder?: typeof geocode
  /** Places to sleep near each city's center (OpenStreetMap); injectable for tests */
  hotelFinder?: typeof findHotels
  /** Planning it with friends (TripShare); only when signed in to Drive */
  share?: ReactNode
  /** AI ideas for a day's city (DayTabs); only when the AI is available */
  suggest?: ComponentProps<typeof DayTabs>['suggest']
}

const fmtDay = dayLabel
const fmtTime = (t: string) => t.slice(11, 16)
const money = (n: number, currency = 'ILS') => new Intl.NumberFormat('en-GB', { style: 'currency', currency, maximumFractionDigits: 0 }).format(n)

/** Everything about one trip, with the next step always one tap away. */
export function TripPage({ trip, onChange, onDelete, navigate = (u) => window.location.assign(u), geocoder = geocode, hotelFinder = findHotels, share, suggest }: Props) {
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
        <a href="#/" className="back">{t('← All trips')}</a>
        <Steps step={step} />
      </div>
      <div className="trip-grid">
        <div className="trip-side">
          <TripPass trip={trip} label="Trip" />
          <section className="card budget" aria-label={t('Budget')}>
            <div><span className="label">{t('Planned')}</span><b className="mono">{money(total, currency)}</b></div>
            <div><span className="label">{t('Per person')}</span><b className="mono">{money(total / people, currency)}</b></div>
            <p className="hint">{t('Flights {a} · stays {b} · {who}', { a: money(flightTotal(trip), currency), b: money(stayTotal(trip), currency), who: plural(people, 'traveler') })}</p>
          </section>
          {share}
          <button type="button" className="btn small danger" onClick={() => confirm(t('Delete "{title}"?', { title: trip.title })) && onDelete()}>{t('Delete trip')}</button>
        </div>

        <div className="trip-main">
          <section className={`card sec ${step === 'flights' ? 'next' : ''}`} aria-labelledby="sec-flights">
            <h2 id="sec-flights"><span className="num">1</span>{t('Flights')} <span className="chip src"><span className="dot dot--sky" />Skyhop</span></h2>
            {trip.flights.length ? (
              <>
                <ul className="legs">{trip.flights.map((f) => <Leg key={f.id} f={f} />)}</ul>
                <a className="link" href={skyhopSearchUrl(trip, SKYHOP_URL, hubUrl())}>{t('Change flights in Skyhop')}</a>
              </>
            ) : (
              <div className="empty">
                <p>
                  {trip.flexible
                    ? t('Skyhop will check every day from {from} to {to} for the cheapest {nights}, {adults}', { from: fmtDay(trip.flexible.from), to: fmtDay(trip.flexible.to), nights: plural(tripNights(trip), 'night'), adults: plural(adultsOf(trip), 'adult') })
                    : t('Skyhop will check every day from {from} ± 3 days for {nights}, {adults}', { from: fmtDay(trip.startDate), nights: plural(tripNights(trip), 'night'), adults: plural(adultsOf(trip), 'adult') })}
                  {trip.destinations.length > 1 ? t(', flying home from {city}', { city: trip.destinations.at(-1)!.name }) : ''}.
                </p>
                <button type="button" className="btn solid" onClick={() => navigate(skyhopSearchUrl(trip, SKYHOP_URL, hubUrl()))}>{t('Find flights in Skyhop →')}</button>
              </div>
            )}
          </section>

          <section className={`card sec ${step === 'stays' ? 'next' : ''}`} aria-labelledby="sec-stays">
            <h2 id="sec-stays"><span className="num">2</span>{t('Where you sleep')}
              <span className={`chip src ${openNights ? '' : 'ok'}`}>{openNights ? t('{nights} open', { nights: plural(openNights, 'night') }) : t('Every night covered')}</span>
            </h2>
            {coverage.map((c) => (
              <StayRow key={c.destination.id} trip={trip} c={c} geocoder={geocoder} hotelFinder={hotelFinder} onChange={onChange} />
            ))}
          </section>

          <section className={`card sec ${step === 'map' ? 'next' : ''}`} aria-labelledby="sec-days">
            <h2 id="sec-days"><span className="num">3</span>{t('Day by day')} <span className="chip src"><span className="dot dot--map" />MyMaps AI</span></h2>
            <DayTabs trip={trip} onChange={onChange} suggest={suggest} />
            <div className="sec-actions">
              <button type="button" className={`btn ${step === 'map' ? 'solid' : ''}`} onClick={openMap}>
                {trip.apps.mymaps ? t('Open the map in MyMaps AI →') : t('Plan the days on a map →')}
              </button>
              <span className="hint">{t('A layer per day, with your hotels and airports already on it. Ask MyMaps AI to fill in the places.')}</span>
            </div>
          </section>
        </div>
      </div>
    </div>
  )
}

function Steps({ step }: { step: string }) {
  const items = [['flights', t('Flights')], ['stays', t('Stays')], ['map', t('Days')], ['done', t('Ready')]]
  const at = items.findIndex(([k]) => k === step)
  return (
    <ol className="steps" aria-label={t('Progress')}>
      {items.map(([k, label], i) => (
        <li key={k} className={i < at ? 'done' : i === at ? 'now' : ''} aria-current={i === at ? 'step' : undefined}>{label}</li>
      ))}
    </ol>
  )
}

function Leg({ f }: { f: FlightLeg }) {
  const dir = f.direction === 'outbound' ? t('OUT') : f.direction === 'return' ? t('HOME') : t('NEXT')
  const nextDay = f.arrives.slice(0, 10) > f.departs.slice(0, 10) ? '+1' : ''
  return (
    <li className="leg">
      <span className="label">{dir}</span>
      <span>
        <b className="mono">{fmtDay(f.departs.slice(0, 10))} · {fmtTime(f.departs)} {f.origin} → {fmtTime(f.arrives)}{nextDay} {f.destination}</b>
        <span className="hint"> {f.airlines.join(' + ')} · {f.stops ? plural(f.stops, 'stop') : t('direct')}</span>
      </span>
      <span className="mono">{f.price != null ? money(f.price, f.currency) : ''}</span>
    </li>
  )
}

function StayRow({ trip, c, onChange, geocoder, hotelFinder }: { trip: Trip; c: Coverage; onChange: (t: Trip) => void; geocoder: typeof geocode; hotelFinder: typeof findHotels }) {
  const [open, setOpen] = useState(false)
  const [browsing, setBrowsing] = useState(false)
  /** The hotel picked from the list: its OSM position is used as is, no geocoding */
  const [picked, setPicked] = useState<Hotel | null>(null)
  const [name, setName] = useState('')
  const [price, setPrice] = useState('')
  const [url, setUrl] = useState('')
  /** Check-in and check-out of the stay being added, starting from the open gap */
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [error, setError] = useState<string | null>(null)
  /** The stay whose dates are being changed, and its dates while editing */
  const [editing, setEditing] = useState<{ id: string; from: string; to: string; error: string | null } | null>(null)
  const [busy, setBusy] = useState(false)
  const stays = trip.stays.filter((s) => s.destinationId === c.destination.id)
  const span = c.nights.length ? `${fmtDay(c.nights[0])} → ${fmtDay(c.destination.depart)}` : ''
  const dates = { min: c.destination.arrive, max: c.destination.depart }

  const openForm = () => {
    if (!c.gap) return
    setFrom(c.gap.checkIn)
    setTo(c.gap.checkOut)
    setError(null)
    setOpen(true)
  }

  const save = async (e: FormEvent) => {
    e.preventDefault()
    if (!name.trim()) return
    const problem = stayDatesError(trip, { destinationId: c.destination.id, checkIn: from, checkOut: to })
    if (problem) return setError(problem)
    setBusy(true)
    const near = c.destination.airport ? airport(c.destination.airport)?.location : undefined
    const location = picked && picked.name === name.trim() ? picked.location : await geocoder(`${name.trim()}, ${c.destination.name}`, near)
    const link = /^https?:\/\//.test(url.trim()) ? url.trim() : undefined
    onChange(
      addStay(trip, {
        name: name.trim(),
        destinationId: c.destination.id,
        checkIn: from,
        checkOut: to,
        ...(Number(price) > 0 ? { price: Number(price), currency: trip.budget?.currency ?? 'ILS' } : {}),
        ...(link ? { url: link } : {}),
        ...(location ? { location } : {}),
      }),
    )
    setBusy(false)
    setOpen(false)
    setPicked(null)
    setName('')
    setPrice('')
    setUrl('')
    setError(null)
  }

  const saveDates = (e: FormEvent) => {
    e.preventDefault()
    if (!editing) return
    const problem = stayDatesError(trip, { destinationId: c.destination.id, checkIn: editing.from, checkOut: editing.to }, editing.id)
    if (problem) return setEditing({ ...editing, error: problem })
    onChange(setStayDates(trip, editing.id, editing.from, editing.to))
    setEditing(null)
  }

  return (
    <div className="stay-row">
      <div className="stay-head">
        <b>{c.destination.name}</b>
        <span className="hint mono">{span} · {plural(c.nights.length, 'night')}</span>
      </div>
      {stays.map((s) => (
        <div key={s.id} className="stay">
          <span>🏨 <b>{s.name}</b> <span className="hint">{fmtDay(s.checkIn)} → {fmtDay(s.checkOut)}{s.location ? t(' · on the map') : ''}</span></span>
          <span className="mono">{s.price != null ? money(s.price, s.currency) : ''}</span>
          <button type="button" className="btn small" aria-label={t('Change dates of {name}', { name: s.name })} onClick={() => setEditing({ id: s.id, from: s.checkIn, to: s.checkOut, error: null })}>{t('Dates')}</button>
          <button type="button" className="x" aria-label={t('Remove {name}', { name: s.name })} onClick={() => onChange(removeStay(trip, s.id))}>×</button>
          {editing?.id === s.id && (
            <form className="stay-form stay-dates" onSubmit={saveDates} aria-label={t('Dates of {name}', { name: s.name })}>
              <input type="date" aria-label={t('Check-in')} min={dates.min} max={dates.max} value={editing.from} onChange={(e) => setEditing({ ...editing, from: e.target.value, error: null })} required />
              <input type="date" aria-label={t('Check-out')} min={dates.min} max={dates.max} value={editing.to} onChange={(e) => setEditing({ ...editing, to: e.target.value, error: null })} required />
              <button type="submit" className="btn small solid">{t('Save dates')}</button>
              <button type="button" className="btn small" onClick={() => setEditing(null)}>{t('Cancel')}</button>
              {editing.error && <p className="hint error" role="alert">{editing.error}</p>}
            </form>
          )}
        </div>
      ))}
      {c.gap && (
        <div className="stay-gap">
          <span className="hint">{t('Need a bed {from} → {to} for {who}:', { from: fmtDay(c.gap.checkIn), to: fmtDay(c.gap.checkOut), who: plural(adultsOf(trip), 'adult') })}</span>
          {staySearchLinks(trip, c.destination, c.gap.checkIn, c.gap.checkOut).map((l) => (
            <a key={l.name} className="btn small" href={l.url} target="_blank" rel="noopener">{l.name} ↗</a>
          ))}
          <button type="button" className="btn small" data-help="hotels" aria-expanded={browsing} onClick={() => setBrowsing(!browsing)}>🔎 {t('Hotels in {city}', { city: c.destination.name })}</button>
          {!open && <button type="button" className="btn small solid" onClick={openForm}>{t('＋ Add the place you booked')}</button>}
        </div>
      )}
      {browsing && c.gap && (
        <HotelList
          city={c.destination.name}
          near={c.destination.airport ? airport(c.destination.airport)?.location : undefined}
          finder={hotelFinder}
          priceUrl={(h) => bookingUrl(trip, `${h.name}, ${c.destination.name}`, c.gap!.checkIn, c.gap!.checkOut)}
          onUse={(h) => {
            setPicked(h)
            setName(h.name)
            setUrl(h.website ?? bookingUrl(trip, `${h.name}, ${c.destination.name}`, c.gap!.checkIn, c.gap!.checkOut))
            setBrowsing(false)
            openForm()
          }}
        />
      )}
      {open && c.gap && (
        <form className="stay-form" onSubmit={save} aria-label={t('Stay in {city}', { city: c.destination.name })}>
          <input aria-label={t('Hotel or apartment name')} placeholder={t('Hotel or apartment name')} value={name} onChange={(e) => setName(e.target.value)} required autoFocus />
          <input aria-label={t('Total price')} placeholder={t('Total price')} inputMode="numeric" value={price} onChange={(e) => setPrice(e.target.value.replace(/[^\d.]/g, ''))} />
          <input aria-label={t('Link (optional)')} placeholder={t('Link (optional)')} value={url} onChange={(e) => setUrl(e.target.value)} />
          <input type="date" aria-label={t('Check-in')} min={dates.min} max={dates.max} value={from} onChange={(e) => { setFrom(e.target.value); setError(null) }} required />
          <input type="date" aria-label={t('Check-out')} min={dates.min} max={dates.max} value={to} onChange={(e) => { setTo(e.target.value); setError(null) }} required />
          <button type="submit" className="btn small solid" disabled={busy}>{busy ? t('Saving…') : t('Save stay')}</button>
          <button type="button" className="btn small" onClick={() => setOpen(false)}>{t('Cancel')}</button>
          {error && <p className="hint error" role="alert">{error}</p>}
        </form>
      )}
    </div>
  )
}

const KIND_LABEL: Record<HotelKind, string> = { hotel: t('Hotel'), guest_house: t('Guest house'), hostel: t('Hostel'), apartment: t('Apartment') }
const KIND_PLURAL: Record<HotelKind, string> = { hotel: t('Hotels'), guest_house: t('Guest houses'), hostel: t('Hostels'), apartment: t('Apartments') }

/** Places to sleep near the center, from OpenStreetMap. Prices live on Booking.com, one tap away per hotel. */
function HotelList({ city, near, finder, priceUrl, onUse }: {
  city: string
  near?: [number, number]
  finder: typeof findHotels
  priceUrl: (h: Hotel) => string
  onUse: (h: Hotel) => void
}) {
  const [hotels, setHotels] = useState<Hotel[] | null>(null)
  const [error, setError] = useState('')
  const [kind, setKind] = useState<HotelKind | 'all'>('all')
  const [tries, setTries] = useState(0)
  useEffect(() => {
    let alive = true
    setError('')
    finder(city, near).then(
      (h) => alive && setHotels(h),
      (e: unknown) => alive && setError(e instanceof Error ? e.message : t("Couldn't load hotels.")),
    )
    return () => { alive = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [city, tries])

  const kinds = hotels ? (Object.keys(KIND_LABEL) as HotelKind[]).filter((k) => hotels.some((h) => h.kind === k)) : []
  const shown = (hotels ?? []).filter((h) => kind === 'all' || h.kind === kind)
  return (
    <div className="hotels" role="region" aria-label={t('Hotels in {city}', { city })}>
      {error ? (
        <p className="hint" role="alert">{error} <button type="button" className="btn small" onClick={() => setTries(tries + 1)}>{t('Try again')}</button></p>
      ) : !hotels ? (
        <p className="hint" role="status">{t('Finding places to sleep near the center of {city}…', { city })}</p>
      ) : !hotels.length ? (
        <p className="hint">{t('OpenStreetMap has no hotels listed near the center of {city}. Try Booking.com above.', { city })}</p>
      ) : (
        <>
          {kinds.length > 1 && (
            <div className="kinds" role="group" aria-label={t('Kind of place')}>
              {(['all', ...kinds] as const).map((k) => (
                <button key={k} type="button" className={`chip ${kind === k ? 'on' : ''}`} aria-pressed={kind === k} onClick={() => setKind(k)}>
                  {k === 'all' ? t('All') : KIND_PLURAL[k]}
                </button>
              ))}
            </div>
          )}
          <ul aria-label={t('Places to sleep in {city}', { city })}>
            {shown.map((h) => (
              <li key={h.id}>
                <span className="h-name">
                  <b>{h.name}</b>
                  <span className="hint">{KIND_LABEL[h.kind]}{h.stars ? ` · ${'★'.repeat(Math.round(h.stars))}` : ''} · <span className="mono">{h.km} km</span> {t('from the center')}</span>
                </span>
                <span className="h-actions">
                  <a className="btn small" href={priceUrl(h)} target="_blank" rel="noopener" aria-label={t('Prices for {name}', { name: h.name })}>{t('Prices ↗')}</a>
                  <button type="button" className="btn small solid" aria-label={t('Use {name}', { name: h.name })} onClick={() => onUse(h)}>{t('Use')}</button>
                </span>
              </li>
            ))}
          </ul>
          <p className="hint small">{t('Hotels from © OpenStreetMap contributors. Prices and rooms on Booking.com.')}</p>
        </>
      )}
    </div>
  )
}
