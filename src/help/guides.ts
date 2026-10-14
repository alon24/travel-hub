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
    title: 'Welcome to Travel Hub',
    steps: [
      {
        title: 'One place for the whole vacation',
        text: 'Each vacation is one Trip: the flights you pick in Skyhop, where you sleep, and a day-by-day map in MyMaps AI. This hub keeps them together.',
      },
      { title: 'Start a trip', text: 'Plan a trip asks where, when and who. You can also just describe it in a sentence and let the AI fill it in.', target: '[data-help="plan"]' },
      { title: 'Your trips', text: 'Every trip you plan shows up here. Tap one to continue where you left off.', target: '#trips' },
      { title: 'On every device', text: 'Your trips are saved in your Google Drive, so they are the same on your phone and your computer.', target: '.sync' },
      { title: 'Help on every screen', text: 'Tap ? Help at the top of any screen to see how it works again.', target: '[data-help="help"]' },
    ],
  },
  new: {
    title: 'Planning a new trip',
    steps: [
      {
        title: 'Describe it',
        text: 'Write the trip in your own words, like "4 nights in Lisbon and Porto in May, 2 of us from Tel Aviv", and press Fill in the form. The AI only fills the form; nothing is saved yet.',
        target: '.wish',
      },
      { title: 'Where to', text: 'Pick cities, or a whole country, in the order you travel. Flying home from the last city is fine.', target: '[data-help="where"]' },
      { title: 'When and how long', text: 'The day you would like to leave, how many nights and how many travelers. Skyhop checks a few days around that date for cheaper flights.', target: '[data-help="when"]' },
      { title: 'Create the trip', text: 'Create trip opens the trip page with the next step ready: finding flights.', target: '[data-help="create"]' },
    ],
  },
  trip: {
    title: 'Your trip page',
    steps: [
      { title: 'Four steps', text: 'Flights, stays, days, ready. The highlighted card is always the next thing to do.', target: '.steps' },
      {
        title: '1 · Flights',
        text: 'Find flights in Skyhop checks every day around your dates. Pick a flight there and it comes back to this trip by itself.',
        target: '#sec-flights',
      },
      { title: '2 · Where you sleep', text: 'Each city shows the nights that still need a bed. Add the place you booked, or look for one.', target: '#sec-stays' },
      {
        title: 'Find a hotel',
        text: 'Hotels in the city lists places near the center. Prices opens Booking.com for your dates; Use puts the hotel in your trip and on the map.',
        target: '[data-help="hotels"]',
      },
      {
        title: '3 · Day by day',
        text: 'Tap a day to see its places. Add what you want to see, open each in Google Maps, or get walking directions for the whole day from your hotel. Plan the days on a map opens MyMaps AI with a layer for each day and your hotels and airports already on it. Ask its AI to suggest places.',
        target: '#sec-days',
      },
      { title: 'Budget', text: 'Flights and stays add up here, in total and per person.', target: '.budget' },
      {
        title: 'Plan it together',
        text: "Add a friend's email, then send them the invite link (WhatsApp, share or copy). They open it, approve once, and you both edit the same trip.",
        target: '.share',
      },
    ],
  },
  shared: {
    title: 'A trip a friend shared',
    steps: [
      {
        title: 'Open the shared trip',
        text: 'Tap Open the shared trip and pick it once in the Google window. After that it is in your trips, and changes reach both of you.',
      },
    ],
  },
  admin: {
    title: 'The Admin page',
    steps: [
      { title: 'Users', text: 'Who can sign in to all the travel apps. Add a Google account to let someone in; Remove takes them out of every app.', target: '[aria-labelledby="users-h"]' },
      { title: 'AI usage', text: 'How much AI each person used, per app, for the period you pick.', target: '[aria-labelledby="usage-h"]' },
      { title: 'Activity log', text: 'Sign-ins, added users and other changes. Filter by account to see one person.', target: '[aria-labelledby="audit-h"]' },
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
