import { lang, setLang, t } from './i18n.ts'
import exampleJson from './data/example-trip.json'
import exampleSource from './data/example-trip.json?raw'
import typesSource from './model/types.ts?raw'
import { CodeTabs } from './components/CodeTabs.tsx'
import { TripDiagram } from './components/TripDiagram.tsx'
import { TripPass } from './components/TripPass.tsx'
import type { Session } from './auth/google.ts'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { AdminPage } from './components/AdminPage.tsx'
import { NewTrip } from './components/NewTrip.tsx'
import { TripPage } from './components/TripPage.tsx'
import { TripShare } from './components/TripShare.tsx'
import { SharedTrip } from './components/SharedTrip.tsx'
import { pickFile } from './auth/picker.ts'
import { TripsList } from './components/TripsList.tsx'
import { GITHUB_URL, MYMAPS_URL, SKYHOP_APK_URL, SKYHOP_URL } from './links.ts'
import { AccountApi, type Role } from './lib/account.ts'
import { aiEnabled } from './lib/ai.ts'
import { draftTrip } from './lib/planAi.ts'
import { rewriteRequest } from './lib/requestAi.ts'
import { suggestPlaces } from './lib/placesAi.ts'
import { env } from './env.ts'
import { go, useRoute } from './lib/route.ts'
import { deleteTrip, forgetDeleted, getTrip, listTrips, onTripsChange, putTrips, saveTrip } from './lib/tripStore.ts'
import { useTripSync } from './lib/useTripSync.ts'
import { readHandoff } from './model/handoff.ts'
import { applyFlights } from './model/plan.ts'
import { parseTrip } from './model/schema.ts'
import type { Trip } from './model/types.ts'
import { versionLabel } from './version.ts'
import { GUIDES, markSeen, screenOf, seenScreens } from './help/guides.ts'
import { HelpGuide } from './help/HelpGuide.tsx'

const example = parseTrip(exampleJson)

const APPS = [
  {
    key: 'sky',
    gate: 'SKY',
    name: 'Skyhop',
    blurb: t('Flexible-date flight search. Give it a home airport, a few destinations and a date window, and it compares every day and trip length.'),
    points: [
      t('Open-jaw, multi-stop and mixed-airline trips'),
      t('Price-by-day chart and a destination × length matrix'),
      t("Hands you to the airline's own site to book"),
      t('Shared trip chat for planning with friends'),
    ],
    href: SKYHOP_URL,
    cta: t('Open Skyhop'),
  },
  {
    key: 'map',
    gate: 'MAP',
    name: 'MyMaps AI',
    blurb: t('Personal maps in the style of Google My Maps, with day-by-day itineraries and an AI helper. Works on phone and desktop as an installable app.'),
    points: [
      t('Layers, points, lines and areas you can draw and edit'),
      t('Trip days with numbered stops and distances'),
      t('KML, KMZ, GeoJSON, CSV and GPX import and export'),
      t('Saves and shares through Google Drive'),
    ],
    href: MYMAPS_URL,
    cta: t('Open MyMaps AI'),
  },
  {
    key: 'trip',
    gate: 'TRP',
    name: 'Trip',
    isNew: true,
    blurb: t('The object that holds a whole trip. Each app keeps doing what it does well, and the Trip remembers which flights and which map belong to which vacation.'),
    points: [t('Dates, destinations and who is going'), t('Picked flights from Skyhop, booked or not'), t("The trip's MyMaps AI map, one layer per day"), t('Stays, budget and notes')],
    href: '#trip',
    cta: t('See the model'),
  },
]

const FIELDS: [string, string][] = [
  ['startDate / endDate', t("The trip's own dates. Skyhop's depart and return dates fill them in.")],
  ['days[]', t('One per calendar day. mapLayerId points to the MyMaps AI day layer with the same date.')],
  ['flights[]', t('Legs picked in Skyhop: airports, times, flight numbers, price and the airline link.')],
  ['apps.mymaps', t("The map's id and Drive file id, so the map opens straight from the trip.")],
  ['apps.skyhop', t('The searches behind the flights, and the shared trip chat if there is one.')],
]

interface Props {
  /** The signed-in Google account; absent when there is no sign-in gate (local dev) */
  account?: Pick<Session, 'email' | 'name' | 'picture'> & { token?: string; role?: Role } | null
  onSignOut?: () => void
  /** Tests only: a stand-in for Google Drive */
  driveFetch?: typeof fetch
  /** Open each screen's guide by itself the first time it's seen (off in unit tests) */
  firstRunHelp?: boolean
}

export default function App({ account, onSignOut, driveFetch, firstRunHelp = import.meta.env.MODE !== 'test' }: Props = {}) {
  const sync = useTripSync(account?.token, driveFetch)
  const route = useRoute()
  const [trips, setTrips] = useState<Trip[]>(listTrips)
  const [error, setError] = useState('')
  useEffect(() => onTripsChange(() => setTrips(listTrips())), [])

  // Flights sent from Skyhop: put them on their trip (or start one) and open it
  useEffect(() => {
    if (route.name !== 'handoff') return
    try {
      const h = readHandoff(window.location.hash)!
      const trip = saveTrip(applyFlights(h.tripId ? getTrip(h.tripId) : undefined, h))
      window.history.replaceState(null, '', `#/trip/${trip.id}`)
      window.dispatchEvent(new HashChangeEvent('hashchange'))
    } catch (e) {
      setError(e instanceof Error ? e.message : t('Could not read the flights from Skyhop.'))
      window.history.replaceState(null, '', '#/')
      window.dispatchEvent(new HashChangeEvent('hashchange'))
    }
  }, [route])

  const trip = route.name === 'trip' ? trips.find((t) => t.id === route.id) : undefined
  // A trip id that isn't loaded yet has nothing to explain
  const screen = route.name === 'trip' && !trip ? null : screenOf(route)
  const [help, setHelp] = useState<typeof screen>(null)
  const closeHelp = useCallback(() => setHelp(null), [])
  useEffect(() => {
    setHelp(null)
    if (!firstRunHelp || !screen || seenScreens().includes(screen)) return
    markSeen(screen)
    setHelp(screen)
  }, [screen, firstRunHelp])

  const isAdmin = account?.role === 'admin' && Boolean(account.token) && Boolean(env.VITE_WORKER_URL)
  const token = account?.token
  const adminApi = useMemo(() => (isAdmin && token ? new AccountApi(env.VITE_WORKER_URL, token) : null), [isAdmin, token])
  const drive = useMemo(() => (token ? { token, fetch: driveFetch } : null), [token, driveFetch])
  const pick = token && env.VITE_GOOGLE_API_KEY ? (id: string) => pickFile(id, token, env.VITE_GOOGLE_API_KEY, env.VITE_GOOGLE_CLIENT_ID) : undefined
  return (
    <div className="wrap">
      <header className="bar">
        <a className="brand" href="#/"><i />Travel Hub AI</a>
        <nav className="nav">
          <a href="#/">{t('My trips')}</a>
          <a href="#apps">{t('Apps')}</a>
          <a href="#trip">{t('Trip')}</a>
          <a href={GITHUB_URL}>GitHub</a>
          {isAdmin && <a href="#/admin">{t('Admin')}</a>}
        </nav>
        <button type="button" className="btn small lang-btn" aria-label={t('Language')} onClick={() => setLang(lang === 'he' ? 'en' : 'he')}>{lang === 'he' ? 'EN' : 'עב'}</button>
        {screen && (
          <button type="button" className="btn small help-btn" data-help="help" aria-label={t('Help: how this screen works')} aria-expanded={help === screen} onClick={() => setHelp(help ? null : screen)}>
            {t('? Help')}
          </button>
        )}
        {account && (
          <div className="account">
            {account.picture && <img src={account.picture} alt="" width={28} height={28} referrerPolicy="no-referrer" />}
            <span className="account-email" title={account.email}>{account.name ?? account.email}</span>
            {sync.kind !== 'off' && (
              <span className={`sync sync--${sync.kind}`} role="status" title={sync.kind === 'error' ? sync.message : t('Your trips are kept in your Google Drive, on every device you sign in on')}>
                {sync.kind === 'syncing' ? t('Syncing…') : sync.kind === 'synced' ? t('☁ In Drive') : t('⚠ Drive')}
              </span>
            )}
            <button type="button" className="btn small" onClick={onSignOut}>{t('Log out')}</button>
          </div>
        )}
      </header>

      <main className="main">
        {error && <p className="banner" role="alert">{error} <button type="button" className="btn small" onClick={() => setError('')}>OK</button></p>}
        {route.name === 'new' ? (
          <section className="page">
            <div className="section-head">
              <span className="label">{t('New trip')}</span>
              <h2>{t('Where are you going?')}</h2>
            </div>
            <NewTrip
              onCreate={(t) => go(`#/trip/${saveTrip(t).id}`)}
              draft={token && aiEnabled() ? (text) => draftTrip(text, new Date().toISOString().slice(0, 10), { googleToken: token }) : undefined}
            />
          </section>
        ) : route.name === 'trip' && trip ? (
          <TripPage
            trip={trip}
            onChange={saveTrip}
            rewrite={token && aiEnabled() ? (text, t) => rewriteRequest(text, t, { googleToken: token }) : undefined}
            suggest={token && aiEnabled() ? (city, have) => suggestPlaces(city, have, { googleToken: token }) : undefined}
            onDelete={() => { deleteTrip(trip.id); go('#/') }}
            share={drive && account ? (
              <TripShare ctx={drive} tripId={trip.id} title={trip.title} from={account.name ?? account.email} synced={sync.kind === 'synced'} addUser={adminApi ? (email) => adminApi.addUser(email, 'user') : undefined} />
            ) : undefined}
          />
        ) : route.name === 'trip' ? (
          <section className="page"><h2>{sync.kind === 'syncing' ? t('Getting your trips from Google Drive…') : t("That trip isn't saved here.")}</h2><a className="btn" href="#/">{t('See your trips')}</a></section>
        ) : route.name === 'shared' ? (
          drive ? (
            <SharedTrip ctx={drive} fileId={route.fileId} pick={pick} onOpen={(t) => { forgetDeleted([t.id]); putTrips([t]); go(`#/trip/${t.id}`) }} />
          ) : <section className="page"><h2>{t('Sign in to open the trip a friend shared.')}</h2></section>
        ) : route.name === 'admin' ? (
          adminApi ? <AdminPage api={adminApi} self={account!.email} /> : <section className="page"><h2>{t('This page is for admins.')}</h2><a className="btn" href="#/">{t('See your trips')}</a></section>
        ) : route.name === 'handoff' ? (
          <section className="page"><p className="muted">{t('Adding the flights to your trip…')}</p></section>
        ) : (
          <Landing trips={trips} />
        )}
      </main>
      {help && <HelpGuide key={help} guide={GUIDES[help]} onClose={closeHelp} />}

      <footer>
        <span>Travel Hub AI · Skyhop + MyMaps AI + Trip · <a href={`${import.meta.env.BASE_URL}privacy.html`}>{t('Privacy')}</a> · <a href={`${import.meta.env.BASE_URL}terms.html`}>{t('Terms')}</a></span>
        <span className="mono">v{versionLabel()} · TRIP_SCHEMA_VERSION = {example.schema}</span>
      </footer>
    </div>
  )
}

function Landing({ trips }: { trips: Trip[] }) {
  return (
    <>
        <section className="hero">
          <div className="hero-copy">
            <span className="label">{t('One place to plan a vacation')}</span>
            <h1>{t('Every trip, from first idea to the flight home.')}</h1>
            <p className="lead">
              {t('Find the flights with Skyhop, plan the days on a MyMaps AI map, and keep it all together in one Trip: dates, travelers, flights, stays and the map.')}
            </p>
            <div className="ctas">
              <a className="btn solid" href="#/new" data-help="plan">{t('Plan a trip')}</a>
              <a className="btn" href={SKYHOP_URL}>{t('Search flights')}</a>
              <a className="btn" href={MYMAPS_URL}>{t('Open a map')}</a>
            </div>
          </div>
          <TripPass trip={example} label={t('Trip · example')} />
        </section>

        <TripsList trips={trips} />

        <section id="apps">
          <div className="section-head">
            <span className="label">{t('The apps')}</span>
            <h2>{t('Two apps today, joined by a third piece.')}</h2>
          </div>
          <div className="board">
            {APPS.map((app) => (
              <div key={app.key} className={`app ${app.key}`}>
                <div className="gate" aria-hidden="true">{app.gate}</div>
                <div>
                  <h3>
                    {app.name}
                    {app.isNew && <span className="tag">{t('New')}</span>}
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
          <p className="apk">
            <a className="btn" href={SKYHOP_APK_URL} download>{t('Skyhop for Android (APK)')}</a>
            <span className="muted">{t('Open the file on your phone and allow installs from this source. Download it again when there is a newer version.')}</span>
          </p>
        </section>

        <section id="trip">
          <div className="section-head">
            <span className="label">{t('Introducing Trip')}</span>
            <h2>{t('One record per vacation.')}</h2>
            <p className="lead">
              {t("A Trip doesn't copy what the apps already store. It points to them. The map stays in Google Drive and the searches stay in Skyhop; the Trip keeps their ids, plus everything that belongs to the trip itself.")}
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
                <p className="muted">{t("Like Skyhop, a Trip never holds card or passport details. A booking is kept as the airline's confirmation code only.")}</p>
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
    </>
  )
}
