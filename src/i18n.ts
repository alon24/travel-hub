import { HE, HE_PLURAL } from './i18n/he.ts'

export type Lang = 'en' | 'he'

const KEY = 'travel-hub.lang'

function detect(): Lang {
  try {
    const saved = localStorage.getItem(KEY)
    if (saved === 'he' || saved === 'en') return saved
  } catch {
    /* private mode */
  }
  return typeof navigator !== 'undefined' && navigator.language?.toLowerCase().startsWith('he') ? 'he' : 'en'
}

/** The page language. Fixed per page load: switching saves it and reloads. */
export const lang: Lang = detect()
export const isRtl = lang === 'he'

if (typeof document !== 'undefined') {
  document.documentElement.lang = lang
  document.documentElement.dir = isRtl ? 'rtl' : 'ltr'
}

export function setLang(next: Lang): void {
  try {
    localStorage.setItem(KEY, next)
  } catch {
    /* private mode: the browser language decides */
  }
  window.location.reload()
}

type Vars = Record<string, string | number>

/** The text in the page language. The English text is the key; `{name}` is filled from `vars`. */
export function t(en: string, vars?: Vars): string {
  const s = (lang === 'he' && HE[en]) || en
  return vars ? s.replace(/\{(\w+)\}/g, (_, k: string) => String(vars[k] ?? '')) : s
}

/** "1 night" / "3 nights" (Hebrew: "לילה אחד" / "3 לילות"). */
export function plural(n: number, word: string): string {
  const he = lang === 'he' ? HE_PLURAL[word] : undefined
  if (he) return n === 1 ? he[0] : he[1].replace('{n}', String(n))
  return `${n} ${word}${n === 1 ? '' : 's'}`
}

const WEEKDAYS_HE = ['א׳', 'ב׳', 'ג׳', 'ד׳', 'ה׳', 'ו׳', 'ש׳']
const MONTHS_HE = ['ינו׳', 'פבר׳', 'מרץ', 'אפר׳', 'מאי', 'יוני', 'יולי', 'אוג׳', 'ספט׳', 'אוק׳', 'נוב׳', 'דצמ׳']

/** Weekday and month names for dates ("Wed 18 Nov" / "ד׳ 18 נוב׳"). */
export const dateNames = (weekday: number, month: number): [string, string] | null =>
  lang === 'he' ? [WEEKDAYS_HE[weekday]!, MONTHS_HE[month]!] : null
