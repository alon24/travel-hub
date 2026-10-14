import { env } from './env.ts'

/** Where the sibling apps are deployed (GitHub Pages). VITE_SKYHOP_URL / VITE_MYMAPS_URL point a local build at local copies. */
export const SKYHOP_URL = env.VITE_SKYHOP_URL || 'https://alon24.github.io/AiTravelSearcher/'
export const MYMAPS_URL = env.VITE_MYMAPS_URL || 'https://alon24.github.io/mymaps-ai/'
export const GITHUB_URL = 'https://github.com/alon24'
/** Skyhop's Android app, rebuilt on every push to its main branch (.github/workflows/android.yml) */
export const SKYHOP_APK_URL = 'https://github.com/alon24/AiTravelSearcher/releases/download/android-latest/skyhop.apk'

/** This hub's own address, without the hash: where Skyhop sends picked flights back to. */
export const hubUrl = (): string => window.location.origin + window.location.pathname
