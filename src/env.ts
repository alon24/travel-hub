import { z } from 'zod'

/**
 * Typesafe build-time config. All values are public (they ship in the bundle).
 * A missing value simply turns the related feature off.
 */
const schema = z.object({
  VITE_WORKER_URL: z.union([z.literal(''), z.url()]).default(''),
})

export type Env = z.infer<typeof schema>

export function parseEnv(raw: Record<string, unknown>): Env {
  const result = schema.safeParse(raw)
  if (!result.success) throw new Error(`Invalid environment config: ${z.prettifyError(result.error)}`)
  return result.data
}

export const env: Env = parseEnv(import.meta.env)
