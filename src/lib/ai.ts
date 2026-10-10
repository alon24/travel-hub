import { env as defaultEnv, type Env } from '../env.ts'

/**
 * AI client. The browser never talks to OpenRouter and never holds its key:
 * it calls the Cloudflare Worker (`POST /ai`, same contract as MyMaps AI's Worker),
 * and the Worker adds OPENROUTER_API_KEY from its own secrets.
 */

export interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
}

export class AiError extends Error {
  status: number
  constructor(message: string, status: number) {
    super(message)
    this.status = status
  }
}

export interface AiAuth {
  /** Google access token (the Worker verifies it) */
  googleToken?: string
  /** Admin key (APP_TOKEN on the Worker) */
  appToken?: string
}

export const aiEnabled = (e: Env = defaultEnv): boolean => e.VITE_WORKER_URL !== ''

export async function askAi(
  system: string,
  messages: ChatMessage[],
  auth: AiAuth = {},
  e: Env = defaultEnv,
): Promise<string> {
  if (!aiEnabled(e)) throw new AiError('AI is not set up: VITE_WORKER_URL is empty', 0)
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (auth.appToken) headers['X-App-Token'] = auth.appToken
  else if (auth.googleToken) headers.Authorization = `Bearer ${auth.googleToken}`

  let res: Response
  try {
    res = await fetch(`${e.VITE_WORKER_URL.replace(/\/$/, '')}/ai`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ system, messages }),
    })
  } catch {
    throw new AiError('Could not reach the AI Worker', 0)
  }
  if (res.status === 401) throw new AiError('Not allowed to use the AI. Sign in again.', 401)
  if (!res.ok) {
    let msg = `AI error ${res.status}`
    try {
      const body = (await res.json()) as { error?: string }
      if (body.error) msg += `: ${body.error}`
    } catch {
      /* not JSON */
    }
    throw new AiError(msg, res.status)
  }
  const data = (await res.json()) as { choices?: { message?: { content?: unknown } }[] }
  const content = data?.choices?.[0]?.message?.content
  if (typeof content !== 'string') throw new AiError('Unexpected response from the AI', 502)
  return content
}
