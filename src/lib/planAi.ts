import { z } from 'zod'
import { AIRPORTS, findAirport } from '../data/airports.ts'
import { addDays } from '../model/plan.ts'
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
  adults?: number
  /** Places the AI named that we have no airport for; shown so nothing is dropped silently */
  unknown: string[]
}

const Reply = z.object({
  title: z.string().max(80).optional().catch(undefined),
  from: z.string().max(60).optional().catch(undefined),
  to: z.array(z.string().max(60)).max(8).catch([]),
  start: z.iso.date().optional().catch(undefined),
  nights: z.number().int().min(1).max(30).optional().catch(undefined),
  adults: z.number().int().min(1).max(9).optional().catch(undefined),
})

// The supported cities go in the prompt (~200 tokens), so the model picks codes we can use
const CITIES = AIRPORTS.map((a) => `${a.code} ${a.city}`).join(', ')

export const planSystem = (today: string) =>
  `Turn the user's trip wish into JSON only, no prose: {"title"?:string,"from"?:IATA,"to":IATA[],"start"?:"YYYY-MM-DD","nights"?:int,"adults"?:int}. ` +
  `Today is ${today}. "to" is the cities in travel order. A country means its main cities (Portugal → LIS, OPO). ` +
  `A month without a day means a date in that month, after today. Leave out anything the user didn't say. ` +
  `Prefer these airports: ${CITIES}.`

/** The model's answer → a draft for the form. Throws only when there's no usable JSON at all. */
export function readPlanReply(content: string, today: string): TripDraft {
  const json = content.match(/\{[\s\S]*\}/)?.[0]
  let raw: unknown
  try {
    raw = JSON.parse(json ?? '')
  } catch {
    throw new Error("The AI didn't return a plan. Try saying it differently.")
  }
  const r = Reply.parse(raw)
  const places: string[] = []
  const unknown: string[] = []
  for (const t of r.to) {
    const a = findAirport(t)
    if (!a) unknown.push(t)
    else if (!places.includes(a.code)) places.push(a.code)
  }
  const home = r.from ? findAirport(r.from)?.code : undefined
  // A date in the past would be refused by the form; keep the form's own default instead
  const start = r.start && r.start >= addDays(today, 1) ? r.start : undefined
  return { title: r.title?.trim() || undefined, home, places, start, nights: r.nights, adults: r.adults, unknown }
}

export async function draftTrip(text: string, today: string, auth: AiAuth, e?: Env): Promise<TripDraft> {
  return readPlanReply(await askAi(planSystem(today), [{ role: 'user', content: text.slice(0, 500) }], auth, e), today)
}
