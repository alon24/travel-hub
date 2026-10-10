import exampleJson from './data/example-trip.json'
import exampleSource from './data/example-trip.json?raw'
import typesSource from './model/types.ts?raw'
import { CodeTabs } from './components/CodeTabs.tsx'
import { TripDiagram } from './components/TripDiagram.tsx'
import { TripPass } from './components/TripPass.tsx'
import { GITHUB_URL, MYMAPS_URL, SKYHOP_URL } from './links.ts'
import { parseTrip } from './model/schema.ts'
import { versionLabel } from './version.ts'

const example = parseTrip(exampleJson)

const APPS = [
  {
    key: 'sky',
    gate: 'SKY',
    name: 'Skyhop',
    blurb: 'Flexible-date flight search. Give it a home airport, a few destinations and a date window, and it compares every day and trip length.',
    points: [
      'Open-jaw, multi-stop and mixed-airline trips',
      'Price-by-day chart and a destination × length matrix',
      "Hands you to the airline's own site to book",
      'Shared trip chat for planning with friends',
    ],
    href: SKYHOP_URL,
    cta: 'Open Skyhop',
  },
  {
    key: 'map',
    gate: 'MAP',
    name: 'MyMaps AI',
    blurb: 'Personal maps in the style of Google My Maps, with day-by-day itineraries and an AI helper. Works on phone and desktop as an installable app.',
    points: [
      'Layers, points, lines and areas you can draw and edit',
      'Trip days with numbered stops and distances',
      'KML, KMZ, GeoJSON, CSV and GPX import and export',
      'Saves and shares through Google Drive',
    ],
    href: MYMAPS_URL,
    cta: 'Open MyMaps AI',
  },
  {
    key: 'trip',
    gate: 'TRP',
    name: 'Trip',
    isNew: true,
    blurb: 'The object that holds a whole trip. Each app keeps doing what it does well, and the Trip remembers which flights and which map belong to which vacation.',
    points: ['Dates, destinations and who is going', 'Picked flights from Skyhop, booked or not', "The trip's MyMaps AI map, one layer per day", 'Stays, budget and notes'],
    href: '#trip',
    cta: 'See the model',
  },
]

const FIELDS: [string, string][] = [
  ['startDate / endDate', "The trip's own dates. Skyhop's depart and return dates fill them in."],
  ['days[]', 'One per calendar day. mapLayerId points to the MyMaps AI day layer with the same date.'],
  ['flights[]', 'Legs picked in Skyhop: airports, times, flight numbers, price and the airline link.'],
  ['apps.mymaps', "The map's id and Drive file id, so the map opens straight from the trip."],
  ['apps.skyhop', 'The searches behind the flights, and the shared trip chat if there is one.'],
]

export default function App() {
  return (
    <div className="wrap">
      <header className="bar">
        <div className="brand"><i />Travel Hub AI</div>
        <nav className="nav">
          <a href="#apps">Apps</a>
          <a href="#trip">Trip</a>
          <a href={GITHUB_URL}>GitHub</a>
        </nav>
      </header>

      <main className="main">
        <section className="hero">
          <div className="hero-copy">
            <span className="label">One place to plan a vacation</span>
            <h1>Every trip, from first idea to the flight home.</h1>
            <p className="lead">
              Find the flights with Skyhop, plan the days on a MyMaps AI map, and keep it all together in one Trip: dates, travelers, flights, stays
              and the map.
            </p>
            <div className="ctas">
              <a className="btn solid" href={SKYHOP_URL}>Search flights</a>
              <a className="btn" href={MYMAPS_URL}>Open a map</a>
            </div>
          </div>
          <TripPass trip={example} label="Trip · example" />
        </section>

        <section id="apps">
          <div className="section-head">
            <span className="label">The apps</span>
            <h2>Two apps today, joined by a third piece.</h2>
          </div>
          <div className="board">
            {APPS.map((app) => (
              <div key={app.key} className={`app ${app.key}`}>
                <div className="gate" aria-hidden="true">{app.gate}</div>
                <div>
                  <h3>
                    {app.name}
                    {app.isNew && <span className="tag">New</span>}
                  </h3>
                  <p className="muted">{app.blurb}</p>
                </div>
                <ul>
                  {app.points.map((p) => <li key={p}>{p}</li>)}
                </ul>
                <a className="go" href={app.href}>{app.cta}</a>
              </div>
            ))}
          </div>
        </section>

        <section id="trip">
          <div className="section-head">
            <span className="label">Introducing Trip</span>
            <h2>One record per vacation.</h2>
            <p className="lead">
              A Trip doesn't copy what the apps already store. It points to them. The map stays in Google Drive and the searches stay in Skyhop; the
              Trip keeps their ids, plus everything that belongs to the trip itself.
            </p>
          </div>
          <div className="model">
            <div>
              <TripDiagram />
              <dl className="fieldlist">
                {FIELDS.map(([name, text]) => (
                  <div key={name}><dt><code>{name}</code></dt><dd>{text}</dd></div>
                ))}
              </dl>
              <div className="privacy">
                <b>!</b>
                <p className="muted">Like Skyhop, a Trip never holds card or passport details. A booking is kept as the airline's confirmation code only.</p>
              </div>
            </div>
            <CodeTabs
              files={[
                { name: 'trip.ts', source: typesSource, language: 'ts' },
                { name: 'example.json', source: exampleSource, language: 'json' },
              ]}
            />
          </div>
        </section>
      </main>

      <footer>
        <span>Travel Hub AI · Skyhop + MyMaps AI + Trip</span>
        <span className="mono">v{versionLabel()} · TRIP_SCHEMA_VERSION = {example.schema}</span>
      </footer>
    </div>
  )
}
