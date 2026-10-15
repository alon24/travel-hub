import { env } from './env.ts'

/** Where the sibling apps are deployed (GitHub Pages). VITE_SKYHOP_URL / VITE_MYMAPS_URL point a local build at local copies. */
export const SKYHOP_URL = env.VITE_SKYHOP_URL || 'https://alon24.github.io/AiTravelSearcher/'
export const MYMAPS_URL = env.VITE_MYMAPS_URL || 'https://alon24.github.io/mymaps-ai/'
export const GITHUB_URL = 'https://github.com/alon24'
/** The suite's one Android app: this hub as a Trusted Web Activity, so Skyhop and MyMaps AI (same origin) open inside it.
 *  Release page, because a direct download link hangs in Chrome custom tabs. Built by .github/workflows/android.yml. */
export const APK_URL = 'https://github.com/alon24/travel-hub/releases/tag/android-latest'

/** This hub's own address, without the hash: where Skyhop sends picked flights back to. */
export const hubUrl = (): string => window.location.origin + window.location.pathname
