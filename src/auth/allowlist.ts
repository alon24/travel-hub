/**
 * Who may use the hub. Entries are addresses or `sha256:<hex of the lowercased address>`,
 * so the public repo and the GitHub variable don't have to hold real addresses.
 * Same format as the Worker's ALLOWED_EMAILS. An empty list lets any Google account in.
 */

export async function sha256Hex(text: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text))
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

export function parseAllowlist(raw: string): string[] {
  return raw
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean)
}

export async function isAllowed(email: string, allowlist: string[]): Promise<boolean> {
  if (allowlist.length === 0) return true
  const e = email.trim().toLowerCase()
  if (!e) return false
  return allowlist.includes(e) || allowlist.includes(`sha256:${await sha256Hex(e)}`)
}
