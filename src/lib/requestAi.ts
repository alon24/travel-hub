import { lang } from '../i18n.ts'
import { askAi, type AiAuth } from './ai.ts'
import { tripFacts } from '../model/request.ts'
import type { Trip } from '../model/types.ts'
import type { Env } from '../env.ts'

export const requestSystem = () =>
  `You rewrite a traveler's trip request so it matches the trip as it is now. Reply with the new request text only, no quotes, no prose around it. ` +
  `Keep the user's own wording, tone and language${lang === 'he' ? ' (Hebrew)' : ''}; change only what no longer matches the facts, and keep things the facts don't cover. One or two sentences, under 300 characters.`

/** A suggested new request text for the trip as it is now. It is only a suggestion: the user edits and saves it. */
export async function rewriteRequest(text: string, trip: Trip, auth: AiAuth, e?: Env): Promise<string> {
  const reply = await askAi(requestSystem(), [{ role: 'user', content: `Request: ${text.slice(0, 500)}\nTrip now: ${tripFacts(trip)}` }], auth, e)
  return reply.trim().replace(/^["“]|["”]$/g, '').slice(0, 500)
}
