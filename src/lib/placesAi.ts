import { z } from 'zod'
import { askAi, type AiAuth } from './ai.ts'
import type { Env } from '../env.ts'

/** One AI-suggested place for a day: a name to add, plus a few words on why. */
export interface PlaceIdea {
  name: string
  note?: string
}

const Place = z.object({ name: z.string().trim().min(1).max(80), note: z.string().max(120).optional().catch(undefined) })
const Reply = z.object({ places: z.array(z.unknown()).max(8).catch([]) })

export const placesSystem = (city: string, have: string[]) =>
  `Suggest 5 places or activities worth a visit in ${city} for one day of a trip. JSON only, no prose: {"places":[{"name":string,"note"?:string}]}. ` +
  `"name" is the place's own name as Google Maps knows it, in English; "note" is under 12 words on why to go. ` +
  `Cluster them so they are walkable in one day. Skip these, already planned: ${have.join(', ') || 'none'}.`

/** The model's answer → ideas not already planned. Throws only when there is no usable JSON. */
export function readPlaceIdeas(content: string, have: string[] = []): PlaceIdea[] {
  let raw: unknown
  try {
    raw = JSON.parse(content.match(/\{[\s\S]*\}/)?.[0] ?? '')
  } catch {
    throw new Error("The AI didn't return places. Try again.")
  }
  const planned = new Set(have.map((h) => h.trim().toLowerCase()))
  const seen = new Set<string>()
  // One bad item is skipped, not the whole answer
  const items = Reply.parse(raw).places.flatMap((p) => { const r = Place.safeParse(p); return r.success ? [r.data] : [] })
  return items.filter((p) => {
    const k = p.name.toLowerCase()
    if (planned.has(k) || seen.has(k)) return false
    seen.add(k)
    return true
  })
}

export async function suggestPlaces(city: string, have: string[], auth: AiAuth, e?: Env): Promise<PlaceIdea[]> {
  const ideas = readPlaceIdeas(await askAi(placesSystem(city, have), [{ role: 'user', content: city.slice(0, 80) }], auth, e), have)
  if (!ideas.length) throw new Error('No new ideas this time. Try again.')
  return ideas
}
