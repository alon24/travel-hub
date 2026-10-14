import { plural, t } from '../i18n.ts'
import { useState, type FormEvent } from 'react'
import { AIRPORTS, COUNTRIES, countryLabel, findAirport, findCountry, mainlandAirports } from '../data/airports.ts'
import { createTrip, addDays } from '../model/plan.ts'
import type { Trip } from '../model/types.ts'
import type { TripDraft } from '../lib/planAi.ts'

interface Props {
  onCreate: (trip: Trip) => void
  /** Today, for the default dates (injectable for tests) */
  today?: string
  /** Turns a sentence into a draft of this form (the AI); the box is hidden without it */
  draft?: (text: string) => Promise<TripDraft>
}

const defaultStart = (today: string) => addDays(today, 30)

/** Step one of a trip: where, when, how long and who. Everything else is filled in by the apps. */
export function NewTrip({ onCreate, draft, today = new Date().toISOString().slice(0, 10) }: Props) {
  const [from, setFrom] = useState('Tel Aviv (TLV)')
  const [places, setPlaces] = useState<string[]>([])
  const [place, setPlace] = useState('')
  const [start, setStart] = useState(defaultStart(today))
  // Any dates in a window ("3 days in December"): Skyhop then looks for the cheapest days in it
  const [flexible, setFlexible] = useState<{ from: string; to: string }>()
  const [nights, setNights] = useState(3)
  // Nights per city from the AI; dropped as soon as you change the nights or the cities
  const [split, setSplit] = useState<number[]>()
  // Countries picked as a whole: flights search all their airports. Only those you still have a city in count
  const [countries, setCountries] = useState<string[]>([])
  const wholeCountries = countries.filter((c) => places.some((p) => findAirport(p)?.country === c))
  const [adults, setAdults] = useState(2)
  const [title, setTitle] = useState('')
  const [error, setError] = useState('')
  const [wish, setWish] = useState('')
  const [drafting, setDrafting] = useState(false)
  const [note, setNote] = useState('')

  // The AI only fills the form; nothing is created until you press Create trip
  const fillIn = async () => {
    if (!draft || !wish.trim()) return
    setDrafting(true)
    setNote('')
    try {
      const d = await draft(wish)
      if (d.places.length) setPlaces(d.places)
      setCountries(d.countries ?? [])
      if (d.home) setFrom(`${findAirport(d.home)?.city} (${d.home})`)
      if (d.start) setStart(d.start)
      setFlexible(d.window)
      if (d.nights) setNights(d.nights)
      setSplit(d.split)
      if (d.adults) setAdults(d.adults)
      if (d.title) setTitle(d.title)
      setError('')
      setNote(
        (d.places.length ? t('Filled in. Check it, then create the trip.') : t("Couldn't tell where you're going. Add a city below.")) +
          (d.window ? ' ' + t('Any {n} nights between {from} and {to}: Skyhop finds the cheapest days.', { n: d.nights ?? nights, from: d.window.from, to: d.window.to }) : '') +
          (d.split ? ` ${d.places.map((c, i) => `${findAirport(c)?.city ?? c} ${plural(d.split![i]!, 'night')}`).join(', ')}.` : '') +
          (d.unknown.length ? ' ' + t('Not in our city list yet: {list}.', { list: d.unknown.join(', ') }) : ''),
      )
    } catch (e) {
      setNote(e instanceof Error ? e.message : t('The AI is not available right now.'))
    } finally {
      setDrafting(false)
    }
  }

  const addPlace = (text = place) => {
    const a = findAirport(text)
    const country = a ? undefined : findCountry(text)
    if (!a && !country) return setError(t('Pick a city or a country from the list, or type an airport code (e.g. LIS).'))
    // A country adds all its airports, so every one of them is searched; remove the ones you don't want
    const codes = a ? [a.code] : country!.airports.map((x) => x.code)
    setPlaces([...places, ...codes.filter((c) => !places.includes(c))])
    if (country && !countries.includes(country.code)) setCountries([...countries, country.code])
    setSplit(undefined)
    setPlace('')
    setError('')
  }

  const submit = (e: FormEvent) => {
    e.preventDefault()
    const home = findAirport(from)
    if (place.trim()) return addPlace()
    if (!home) return setError(t('Where do you fly from? Pick a city or airport code.'))
    if (!places.length) return setError(t('Add at least one place to go.'))
    if (flexible && addDays(flexible.from, nights) > flexible.to) return setError(t("{n} nights don't fit between {from} and {to}. Move \"Back by\" later.", { n: nights, from: flexible.from, to: flexible.to }))
    onCreate(createTrip({ title, home: home.code, destinations: places.map((code, i) => ({ code, nights: split?.[i] })), startDate: start, nights, adults, countries: wholeCountries, ...(flexible ? { flexible } : {}) }))
  }

  return (
    <>
    {draft && (
      <div className="wish" role="group" aria-label={t('Describe your trip')}>
        <label htmlFor="nt-wish">{t('Describe it')} <span className="hint">{t('· AI fills in the form')}</span></label>
        <textarea
          id="nt-wish"
          rows={2}
          maxLength={500}
          value={wish}
          placeholder={t('3 nights in Lisbon and Porto in November, 3 of us from Tel Aviv')}
          onChange={(e) => setWish(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault()
              void fillIn()
            }
          }}
        />
        <button type="button" className="btn" disabled={drafting || !wish.trim()} onClick={() => void fillIn()}>
          {drafting ? t('Filling in…') : t('Fill in the form')}
        </button>
        {note && <p className="hint" role="status">{note}</p>}
      </div>
    )}
    <form className="planner" onSubmit={submit} aria-label={t('Plan a trip')}>
      <datalist id="cities">
        {COUNTRIES.map((c) => <option key={c.code} value={countryLabel(c)} />)}
        {AIRPORTS.map((a) => <option key={a.code} value={`${a.city} (${a.code})`} />)}
      </datalist>
      <div className="field" data-help="where">
        <label htmlFor="nt-to">{t('Where to')}</label>
        <div className="places">
          {places.map((code) => (
            <span key={code} className="place-chip">
              {findAirport(code)?.city} <b className="mono">{code}</b>
              <button type="button" aria-label={t('Remove {name}', { name: code })} onClick={() => { setPlaces(places.filter((p) => p !== code)); setSplit(undefined) }}>×</button>
            </span>
          ))}
          <input
            id="nt-to"
            list="cities"
            value={place}
            placeholder={places.length ? t('Add another city or country') : t('Lisbon, Portugal…')}
            onChange={(e) => {
              setPlace(e.target.value)
              // Picking from the list adds the city (or the whole country) right away
              if (/\([A-Z]{3}\)$/.test(e.target.value) || /\((1 airport|all \d+ airports)\)$/.test(e.target.value)) addPlace(e.target.value)
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && place.trim()) {
                e.preventDefault()
                addPlace()
              }
            }}
          />
        </div>
        <span className="hint">{t('In travel order. Flying home from the last one is fine (open-jaw).')}</span>
        {wholeCountries.map((c) => (
          <span key={c} className="hint" role="note">
            ✈ {t('Flights to any airport in {country}:', { country: COUNTRIES.find((x) => x.code === c)?.name ?? c })} {[...new Set([...mainlandAirports(c), ...places.filter((p) => findAirport(p)?.country === c)])].join(', ')}
          </span>
        ))}
      </div>
      <div className="row" data-help="when">
        <div className="field">
          <label htmlFor="nt-from">{t('From')}</label>
          <input id="nt-from" list="cities" value={from} onChange={(e) => setFrom(e.target.value)} />
        </div>
        {flexible ? (
          <>
            <div className="field">
              <label htmlFor="nt-from-day">{t('Leave from')}</label>
              <input id="nt-from-day" type="date" value={flexible.from} min={today} onChange={(e) => setFlexible({ ...flexible, from: e.target.value })} required />
            </div>
            <div className="field">
              <label htmlFor="nt-to-day">{t('Back by')}</label>
              <input id="nt-to-day" type="date" value={flexible.to} min={flexible.from} onChange={(e) => setFlexible({ ...flexible, to: e.target.value })} required />
            </div>
          </>
        ) : (
          <div className="field">
            <label htmlFor="nt-start">{t('Leave around')}</label>
            <input id="nt-start" type="date" value={start} min={today} onChange={(e) => setStart(e.target.value)} required />
          </div>
        )}
      </div>
      <label className="hint flex-toggle">
        <input
          type="checkbox"
          checked={Boolean(flexible)}
          onChange={(e) => setFlexible(e.target.checked ? { from: start, to: addDays(start, Math.max(nights, 30)) } : undefined)}
        />{' '}
        {t('Flexible dates: find the cheapest {n} nights in a window', { n: nights })}
      </label>
      <div className="row">
        <Stepper id="nt-nights" label={t('Nights')} value={nights} min={1} max={30} onChange={(n) => { setNights(n); setSplit(undefined) }} />
        <Stepper id="nt-adults" label={t('Travelers')} value={adults} min={1} max={9} onChange={setAdults} />
      </div>
      <div className="field">
        <label htmlFor="nt-title">{t('Name')} <span className="hint">{t('· optional')}</span></label>
        <input id="nt-title" value={title} placeholder={t('e.g. Portugal with the guys')} onChange={(e) => setTitle(e.target.value)} />
      </div>
      {error && <p className="form-error" role="alert">{error}</p>}
      <button type="submit" className="btn solid" data-help="create">{t('Create trip →')}</button>
    </form>
    </>
  )
}

function Stepper({ id, label, value, min, max, onChange }: { id: string; label: string; value: number; min: number; max: number; onChange: (n: number) => void }) {
  const set = (n: number) => onChange(Math.min(max, Math.max(min, n)))
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      <div className="stepper">
        <button type="button" aria-label={t('Fewer {what}', { what: label.toLowerCase() })} onClick={() => set(value - 1)}>−</button>
        <input id={id} type="number" inputMode="numeric" min={min} max={max} value={value} onChange={(e) => set(Number(e.target.value) || min)} />
        <button type="button" aria-label={t('More {what}', { what: label.toLowerCase() })} onClick={() => set(value + 1)}>+</button>
      </div>
    </div>
  )
}
