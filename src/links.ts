import { env } from './env.ts'

/** Where the sibling apps are deployed (GitHub Pages). VITE_SKYHOP_URL / VITE_MYMAPS_URL point a local build at local copies. */
export const SKYHOP_URL = env.VITE_SKYHOP_URL || 'https://alon24.github.io/AiTravelSearcher/'
export const MYMAPS_URL = env.VITE_MYMAPS_URL || 'https://alon24.github.io/mymaps-ai/'
export const GITHUB_URL = 'https://github.com/alon24'
/** Release pages of the Android apps (tap the .apk there; a direct download link hangs in Chrome custom tabs).
 *  Each repo rebuilds its APK in .github/workflows/android.yml. */
export const APK_URLS = {
  hub: 'https://github.com/alon24/travel-hub/releases/tag/android-latest',
  skyhop: 'https://github.com/alon24/AiTravelSearcher/releases/tag/android-latest',
  mymaps: 'https://github.com/alon24/mymaps-ai/releases/tag/android-latest',
}

/** This hub's own address, without the hash: where Skyhop sends picked flights back to. */
export const hubUrl = (): string => window.location.origin + window.location.pathname
