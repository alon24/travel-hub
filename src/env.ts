import { z } from 'zod'

/**
 * Typesafe build-time config. All values are public (they ship in the bundle).
 * A missing value simply turns the related feature off.
 */
const schema = z.object({
  VITE_WORKER_URL: z.union([z.literal(''), z.url()]).default(''),
  /** Google OAuth client (same one as MyMaps AI). Empty = no sign-in gate (local dev only; CI refuses to build without it). */
  VITE_GOOGLE_CLIENT_ID: z.string().default(''),
  /** Sibling apps; empty = their GitHub Pages addresses (src/links.ts) */
  VITE_SKYHOP_URL: z.union([z.literal(''), z.url()]).default(''),
  VITE_MYMAPS_URL: z.union([z.literal(''), z.url()]).default(''),
})

export type Env = z.infer<typeof schema>

export function parseEnv(raw: Record<string, unknown>): Env {
  const result = schema.safeParse(raw)
  if (!result.success) throw new Error(`Invalid environment config: ${z.prettifyError(result.error)}`)
  return result.data
}

export const env: Env = parseEnv(import.meta.env)
