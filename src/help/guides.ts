import { t } from '../i18n.ts'
import type { Route } from '../lib/route.ts'

/** One stop of a guide. `target` is a CSS selector to point at; steps whose target isn't on screen are skipped. */
export interface HelpStep {
  title: string
  text: string
  target?: string
}

export type HelpScreen = 'home' | 'new' | 'trip' | 'shared' | 'admin'

export interface Guide {
  title: string
  steps: HelpStep[]
}

/** How each screen works, short enough to read on a phone. */
export const GUIDES: Record<HelpScreen, Guide> = {
  home: {
    title: t('Welcome to Travel Hub'),
    steps: [
      {
        title: t('One place for the whole vacation'),
        text: t('Each vacation is one Trip: the flights you pick in Skyhop, where you sleep, and a day-by-day map in MyMaps AI. This hub keeps them together.'),
      },
      { title: t('Start a trip'), text: t('Plan a trip asks where, when and who. You can also just describe it in a sentence and let the AI fill it in.'), target: '[data-help="plan"]' },
      { title: t('Your trips'), text: t('Every trip you plan shows up here. Tap one to continue where you left off.'), target: '#trips' },
      { title: t('On every device'), text: t('Your trips are saved in your Google Drive, so they are the same on your phone and your computer.'), target: '.sync' },
      { title: t('Help on every screen'), text: t('Tap ? Help at the top of any screen to see how it works again.'), target: '[data-help="help"]' },
    ],
  },
  new: {
    title: t('Planning a new trip'),
    steps: [
      {
        title: t('Describe it'),
        text: t('Write the trip in your own words, like "4 nights in Lisbon and Porto in May, 2 of us from Tel Aviv", and press Fill in the form. The AI only fills the form; nothing is saved yet.'),
        target: '.wish',
      },
      { title: t('Where to'), text: t('Pick cities, or a whole country, in the order you travel. Flying home from the last city is fine.'), target: '[data-help="where"]' },
      { title: t('When and how long'), text: t('The day you would like to leave, how many nights and how many travelers. Skyhop checks a few days around that date for cheaper flights.'), target: '[data-help="when"]' },
      { title: t('Create the trip'), text: t('Create trip opens the trip page with the next step ready: finding flights.'), target: '[data-help="create"]' },
    ],
  },
  trip: {
    title: t('Your trip page'),
    steps: [
      { title: t('Four steps'), text: t('Flights, stays, days, ready. The highlighted card is always the next thing to do.'), target: '.steps' },
      {
        title: t('1 · Flights'),
        text: t('Find flights in Skyhop checks every day around your dates. Pick a flight there and it comes back to this trip by itself.'),
        target: '#sec-flights',
      },
      { title: t('2 · Where you sleep'), text: t('Each city shows the nights that still need a bed. Add the place you booked, or look for one.'), target: '#sec-stays' },
      {
        title: t('Find a hotel'),
        text: t('Hotels in the city lists places near the center. Prices opens Booking.com for your dates; Use puts the hotel in your trip and on the map.'),
        target: '[data-help="hotels"]',
      },
      {
        title: t('3 · Day by day'),
        text: t('Tap a day to see its places. Add what you want to see, open each in Google Maps, or get walking directions for the whole day from your hotel. Plan the days on a map opens MyMaps AI with a layer for each day and your hotels and airports already on it. Ask its AI to suggest places.'),
        target: '#sec-days',
      },
      { title: t('Budget'), text: t('Flights and stays add up here, in total and per person.'), target: '.budget' },
      {
        title: t('Plan it together'),
        text: t("Add a friend's email, then send them the invite link (WhatsApp, share or copy). They open it, approve once, and you both edit the same trip."),
        target: '.share',
      },
    ],
  },
  shared: {
    title: t('A trip a friend shared'),
    steps: [
      {
        title: t('Open the shared trip'),
        text: t('Tap Open the shared trip and pick it once in the Google window. After that it is in your trips, and changes reach both of you.'),
      },
    ],
  },
  admin: {
    title: t('The Admin page'),
    steps: [
      { title: t('Users'), text: t('Who can sign in to all the travel apps. Add a Google account to let someone in; Remove takes them out of every app.'), target: '[aria-labelledby="users-h"]' },
      { title: t('AI usage'), text: t('How much AI each person used, per app, for the period you pick.'), target: '[aria-labelledby="usage-h"]' },
      { title: t('Activity log'), text: t('Sign-ins, added users and other changes. Filter by account to see one person.'), target: '[aria-labelledby="audit-h"]' },
    ],
  },
}

/** The guide for a route; the Skyhop handoff is a blink with nothing to explain. */
export function screenOf(route: Route): HelpScreen | null {
  return route.name === 'handoff' ? null : route.name
}

const SEEN_KEY = 'travel-hub.help.seen'

/** Screens whose guide already opened once by itself on this device. */
export function seenScreens(): HelpScreen[] {
  try {
    const v: unknown = JSON.parse(localStorage.getItem(SEEN_KEY) ?? '[]')
    return Array.isArray(v) ? (v as HelpScreen[]) : []
  } catch {
    return []
  }
}

/** "Don't show again": no guide opens by itself any more; ? Help still works. */
export function stopFirstRunHelp(): void {
  try {
    localStorage.setItem(SEEN_KEY, JSON.stringify(Object.keys(GUIDES)))
  } catch {
    /* private mode */
  }
}

export function markSeen(screen: HelpScreen): void {
  try {
    const seen = seenScreens()
    if (!seen.includes(screen)) localStorage.setItem(SEEN_KEY, JSON.stringify([...seen, screen]))
  } catch {
    /* private mode: the guide may show again, that's fine */
  }
}
