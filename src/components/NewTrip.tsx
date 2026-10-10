import { useState, type FormEvent } from 'react'
import { AIRPORTS, findAirport } from '../data/airports.ts'
import { createTrip, addDays } from '../model/plan.ts'
import type { Trip } from '../model/types.ts'

interface Props {
  onCreate: (trip: Trip) => void
  /** Today, for the default dates (injectable for tests) */
  today?: string
}

const defaultStart = (today: string) => addDays(today, 30)

/** Step one of a trip: where, when, how long and who. Everything else is filled in by the apps. */
export function NewTrip({ onCreate, today = new Date().toISOString().slice(0, 10) }: Props) {
  const [from, setFrom] = useState('Tel Aviv (TLV)')
  const [places, setPlaces] = useState<string[]>([])
  const [place, setPlace] = useState('')
  const [start, setStart] = useState(defaultStart(today))
  const [nights, setNights] = useState(3)
  const [adults, setAdults] = useState(2)
  const [title, setTitle] = useState('')
  const [error, setError] = useState('')

  const addPlace = (text = place) => {
    const a = findAirport(text)
    if (!a) return setError(`Pick a city from the list, or type its airport code (e.g. LIS).`)
    if (!places.includes(a.code)) setPlaces([...places, a.code])
    setPlace('')
    setError('')
  }

  const submit = (e: FormEvent) => {
    e.preventDefault()
    const home = findAirport(from)
    if (place.trim()) return addPlace()
    if (!home) return setError('Where do you fly from? Pick a city or airport code.')
    if (!places.length) return setError('Add at least one place to go.')
    onCreate(createTrip({ title, home: home.code, destinations: places.map((code) => ({ code })), startDate: start, nights, adults }))
  }

  return (
    <form className="planner" onSubmit={submit} aria-label="Plan a trip">
      <datalist id="cities">
        {AIRPORTS.map((a) => <option key={a.code} value={`${a.city} (${a.code})`} />)}
      </datalist>
      <div className="field">
        <label htmlFor="nt-to">Where to</label>
        <div className="places">
          {places.map((code) => (
            <span key={code} className="place-chip">
              {findAirport(code)?.city} <b className="mono">{code}</b>
              <button type="button" aria-label={`Remove ${code}`} onClick={() => setPlaces(places.filter((p) => p !== code))}>×</button>
            </span>
          ))}
          <input
            id="nt-to"
            list="cities"
            value={place}
            placeholder={places.length ? 'Add another city' : 'Lisbon, Porto…'}
            onChange={(e) => {
              setPlace(e.target.value)
              // Picking from the list adds the city right away
              if (/\([A-Z]{3}\)$/.test(e.target.value)) addPlace(e.target.value)
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && place.trim()) {
                e.preventDefault()
                addPlace()
              }
            }}
          />
        </div>
        <span className="hint">In travel order. Flying home from the last one is fine (open-jaw).</span>
      </div>
      <div className="row">
        <div className="field">
          <label htmlFor="nt-from">From</label>
          <input id="nt-from" list="cities" value={from} onChange={(e) => setFrom(e.target.value)} />
        </div>
        <div className="field">
          <label htmlFor="nt-start">Leave around</label>
          <input id="nt-start" type="date" value={start} min={today} onChange={(e) => setStart(e.target.value)} required />
        </div>
      </div>
      <div className="row">
        <Stepper id="nt-nights" label="Nights" value={nights} min={1} max={30} onChange={setNights} />
        <Stepper id="nt-adults" label="Travelers" value={adults} min={1} max={9} onChange={setAdults} />
      </div>
      <div className="field">
        <label htmlFor="nt-title">Name <span className="hint">· optional</span></label>
        <input id="nt-title" value={title} placeholder="e.g. Portugal with the guys" onChange={(e) => setTitle(e.target.value)} />
      </div>
      {error && <p className="form-error" role="alert">{error}</p>}
      <button type="submit" className="btn solid">Create trip →</button>
    </form>
  )
}

function Stepper({ id, label, value, min, max, onChange }: { id: string; label: string; value: number; min: number; max: number; onChange: (n: number) => void }) {
  const set = (n: number) => onChange(Math.min(max, Math.max(min, n)))
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      <div className="stepper">
        <button type="button" aria-label={`Fewer ${label.toLowerCase()}`} onClick={() => set(value - 1)}>−</button>
        <input id={id} type="number" inputMode="numeric" min={min} max={max} value={value} onChange={(e) => set(Number(e.target.value) || min)} />
        <button type="button" aria-label={`More ${label.toLowerCase()}`} onClick={() => set(value + 1)}>+</button>
      </div>
    </div>
  )
}
