import { z } from 'zod'
import { AIRPORTS, findAirport, findCountry } from '../data/airports.ts'
import { addDays } from '../model/plan.ts'
import { t } from '../i18n.ts'
import { askAi, type AiAuth } from './ai.ts'
import type { Env } from '../env.ts'

/**
 * "3 nights in Portugal with the guys in November" → the New trip form, filled in.
 * The AI only drafts: its JSON is validated here, cities are matched to our airport table,
 * and the user checks the form before pressing Create (AI never changes data directly).
 */
export interface TripDraft {
  title?: string
  home?: string
  places: string[]
  start?: string
  nights?: number
  /** "3 or 4 nights": nights is the fewest, this the most; Skyhop compares every length between */
  nightsMax?: number
  /** Nights in each of `places`, when the user gave them per city; they add up to `nights` */
  split?: number[]
  adults?: number
  /** Countries the user asked for as a whole ("Portugal"), so flights search all their airports */
  countries?: string[]
  /**
   * The dates aren't fixed: any `nights`-night trip leaving on or after `from` and back by `to`
   * ("3 days in December" = the whole of December). Skyhop searches every day in it for the cheapest.
   */
  window?: DateWindow
  /** Places the AI named that we have no airport for; shown so nothing is dropped silently */
  unknown: string[]
}

export interface DateWindow {
  from: string
  to: string
}

const MONTH_END = (y: number, m: number) => new Date(Date.UTC(y, m, 0)).getUTCDate()
const pad = (n: number) => String(n).padStart(2, '0')

/**
 * A month (and maybe "early" / "mid" / "late") → its dates, in the next such month that isn't over.
 * Done here, not by the AI, so "December" is always 1 to 31 December. Starts no earlier than tomorrow.
 */
export function monthWindow(month: number, part: 'early' | 'mid' | 'late' | undefined, today: string): DateWindow {
  const [ty, tm] = today.split('-').map(Number) as [number, number]
  const tomorrow = addDays(today, 1)
  const span = (y: number) => {
    const last = MONTH_END(y, month)
    const [a, b] = part === 'early' ? [1, 10] : part === 'mid' ? [11, 20] : part === 'late' ? [21, last] : [1, last]
    return { from: `${y}-${pad(month)}-${pad(a)}`, to: `${y}-${pad(month)}-${pad(b)}` }
  }
  let w = span(month < tm ? ty + 1 : ty)
  if (w.to < tomorrow) w = span(ty + 1)
  return { ...w, from: w.from < tomorrow ? tomorrow : w.from }
}

/** Nights between two dates */
const nightsBetween = (a: string, b: string) => Math.round((Date.parse(b) - Date.parse(a)) / 86_400_000)

const Reply = z.object({
  title: z.string().max(80).optional().catch(undefined),
  from: z.string().max(60).optional().catch(undefined),
  to: z.array(z.string().max(60)).max(8).catch([]),
  start: z.iso.date().optional().catch(undefined),
  nights: z.number().int().min(1).max(30).optional().catch(undefined),
  nightsMax: z.number().int().min(2).max(30).optional().catch(undefined),
  days: z.number().int().min(1).max(31).optional().catch(undefined),
  month: z.number().int().min(1).max(12).optional().catch(undefined),
  part: z.enum(['early', 'mid', 'late']).optional().catch(undefined),
  window: z.object({ from: z.iso.date(), to: z.iso.date() }).optional().catch(undefined),
  split: z.array(z.number().int().min(1).max(30)).max(8).optional().catch(undefined),
  adults: z.number().int().min(1).max(9).optional().catch(undefined),
  countries: z.array(z.string().max(60)).max(8).catch([]),
})

// The supported cities go in the prompt (~200 tokens), so the model picks codes we can use
const CITIES = AIRPORTS.map((a) => `${a.code} ${a.city}`).join(', ')

export const planSystem = (today: string) =>
  `Turn the user's trip wish into JSON only, no prose: {"title"?:string,"from"?:IATA,"to":IATA[],"start"?:"YYYY-MM-DD","nights"?:int,"nightsMax"?:int,"days"?:int,"split"?:int[],"adults"?:int,"countries"?:ISO2[],"month"?:1-12,"part"?:"early"|"mid"|"late","window"?:{"from":"YYYY-MM-DD","to":"YYYY-MM-DD"}}. ` +
  `Today is ${today}. "to" is the cities in travel order. A country means its main cities (Portugal → LIS, OPO), and its ISO code goes in "countries" ("PT") so flights search all its airports; ` +
  `not when the user named cities in it ("Lisbon, Portugal" → no "countries"). ` +
  `"start" only for an exact departure day the user named. ` +
  `A month without a day ("in December", "early March", "late May") is "month" (+ "part"), never "start": the user wants any dates in it. ` +
  `Any other loose time ("next weekend", "Christmas week", "between 5 and 20 March") is "window": earliest departure and latest return, after today; a weekend is Thursday to Sunday. ` +
  `"days" when the user counts days ("3 days"), "nights" when they count nights; "a week" is nights 7, "a weekend" is nights 2. Leave out anything the user didn't say. ` +
  `A range or list of lengths for the whole trip ("3-4 nights", "3,4 nights", "3 or 4 nights") means either: "nights" is the smaller, "nightsMax" the larger, no "split". ` +
  `"split" is nights per city in "to" order, only when each city is named with its own number ("3 in Lisbon, 4 in Porto"); a country such as Portugal is one destination, so its numbers are a range. ` +
  `Prefer these airports: ${CITIES}.`

/** The model's answer → a draft for the form. Throws only when there's no usable JSON at all. */
export function readPlanReply(content: string, today: string): TripDraft {
  const json = content.match(/\{[\s\S]*\}/)?.[0]
  let raw: unknown
  try {
    raw = JSON.parse(json ?? '')
  } catch {
    throw new Error(t("The AI didn't return a plan. Try saying it differently."))
  }
  const r = Reply.parse(raw)
  const places: string[] = []
  const unknown: string[] = []
  for (const t of r.to) {
    const a = findAirport(t)
    if (!a) unknown.push(t)
    else if (!places.includes(a.code)) places.push(a.code)
  }
  // A split counts only when it lines up one-to-one with the cities we kept
  const split = r.split && r.split.length === r.to.length && r.split.length === places.length ? r.split : undefined
  const home = r.from ? findAirport(r.from)?.code : undefined
  // "PT" or "Portugal" → a country we know airports in; dropped when none of the trip's cities are in it
  const countries = [...new Set(r.countries.map((c) => (/^[a-z]{2}$/i.test(c.trim()) ? c.trim().toUpperCase() : findCountry(c)?.code)))]
    .filter((c): c is string => Boolean(c) && places.some((p) => findAirport(p)?.country === c))
  // "3 days" is a 2-night trip (leave on day 1, fly home on day 3)
  const nights = split ? split.reduce((a, b) => a + b, 0) : (r.nights ?? (r.days ? Math.max(1, r.days - 1) : undefined))
  const nightsMax = !split && nights && r.nightsMax && r.nightsMax > nights ? r.nightsMax : undefined
  // A date in the past would be refused by the form; keep the form's own default instead
  const tomorrow = addDays(today, 1)
  const exact = r.start && r.start >= tomorrow ? r.start : undefined
  let window: DateWindow | undefined
  if (!exact && r.month) window = monthWindow(r.month, r.part, today)
  else if (!exact && r.window && r.window.to > tomorrow && r.window.to >= r.window.from)
    window = { from: r.window.from < tomorrow ? tomorrow : r.window.from, to: r.window.to }
  // The window must fit the trip; a short one ("next weekend", 4 nights) stretches its end
  const longest = nightsMax ?? nights
  if (window && longest && nightsBetween(window.from, window.to) < longest) window = { ...window, to: addDays(window.from, longest) }
  const start = exact ?? window?.from
  return { title: r.title?.trim() || undefined, home, places, start, nights, adults: r.adults, countries, unknown, split, ...(nightsMax ? { nightsMax } : {}), ...(window ? { window } : {}) }
}

/**
 * "3,4 nights", "3-4 nights", "3 or 4 nights" (also Hebrew ימים / לילות) → 3 and 4. Read here, not by the AI,
 * because a bare list is a range for the whole trip, never nights per city. Days count one more than nights.
 */
export function nightsRange(text: string): { min: number; max: number } | undefined {
  const m = text.match(/(\d{1,2})\s*(?:-|–|—|,|\/|to|or|עד|או)\s*(\d{1,2})\s*(nights?|days?|לילות|לילה|ימים|יום)/i)
  if (!m) return undefined
  const off = /day|ימים|יום/i.test(m[3]!) ? 1 : 0
  const [a, b] = [Number(m[1]) - off, Number(m[2]) - off].sort((x, y) => x - y) as [number, number]
  return a >= 1 && b > a && b <= 30 ? { min: a, max: b } : undefined
}

export async function draftTrip(text: string, today: string, auth: AiAuth, e?: Env): Promise<TripDraft> {
  const d = readPlanReply(await askAi(planSystem(today), [{ role: 'user', content: text.slice(0, 500) }], auth, e), today)
  const range = nightsRange(text)
  if (!range) return d
  // The window may have been sized for a different length, so rebuild it from the longest
  const window = d.window && nightsBetween(d.window.from, d.window.to) < range.max ? { ...d.window, to: addDays(d.window.from, range.max) } : d.window
  return { ...d, split: undefined, nights: range.min, nightsMax: range.max, ...(window ? { window } : {}) }
}
