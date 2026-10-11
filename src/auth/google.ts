/**
 * Google sign-in with Google Identity Services (token model), loaded on demand.
 * The session (short-lived access token + who it belongs to) is kept in localStorage
 * so a reload doesn't ask again; it ends when the token expires or on sign-out.
 * The same token authorizes AI calls to the Worker (`Authorization: Bearer`).
 *
 * One sign-in for the whole suite: Skyhop and MyMaps AI share this origin (alon24.github.io) and OAuth client, read
 * this session when they have none, and write theirs here when the hub has none. So every app asks for the same
 * scopes, Drive (`drive.file`) included, for MyMaps AI's maps. Signing out here ends their copies of the token too.
 */

// drive.file: the hub keeps your trips in your own Google Drive (tripDrive.ts), so every device sees them
const SCOPE = 'openid email profile https://www.googleapis.com/auth/drive.file'
const SESSION_KEY = 'travel-hub.session'
/** Where Skyhop and MyMaps AI keep their own copy of a token: Skyhop {token}, MyMaps AI {value} */
const SUITE_KEYS: Record<string, 'token' | 'value'> = { 'skyhop.google': 'token', 'mymaps-ai.google-token': 'value' }
const GIS_SRC = 'https://accounts.google.com/gsi/client'
const USERINFO = 'https://www.googleapis.com/oauth2/v3/userinfo'

export interface Session {
  token: string
  expires: number
  email: string
  name?: string
  picture?: string
  /** Granted scopes, so the other apps know whether the token opens Drive */
  scopes?: string[]
}

interface TokenResponse {
  access_token?: string
  expires_in?: number
  scope?: string
  error?: string
}
interface TokenClient {
  callback: (r: TokenResponse) => void
  error_callback?: (e: { type: string }) => void
  requestAccessToken: (o?: { prompt?: string }) => void
}
declare global {
  interface Window {
    google?: {
      accounts: {
        oauth2: {
          initTokenClient: (cfg: { client_id: string; scope: string; callback: (r: TokenResponse) => void }) => TokenClient
          revoke: (token: string, done: () => void) => void
        }
      }
    }
  }
}

let gis: Promise<void> | null = null
function loadGis(): Promise<void> {
  gis ??= new Promise((resolve, reject) => {
    const s = document.createElement('script')
    s.src = GIS_SRC
    s.async = true
    s.onload = () => resolve()
    s.onerror = () => {
      gis = null
      reject(new Error('Could not load Google sign-in. Check your connection.'))
    }
    document.head.appendChild(s)
  })
  return gis
}

export function loadSession(now = Date.now()): Session | null {
  try {
    const s = JSON.parse(localStorage.getItem(SESSION_KEY) ?? 'null') as Session | null
    return s && typeof s.token === 'string' && typeof s.email === 'string' && s.expires > now + 60_000 ? s : null
  } catch {
    return null
  }
}

function saveSession(s: Session | null) {
  try {
    if (s) localStorage.setItem(SESSION_KEY, JSON.stringify(s))
    else localStorage.removeItem(SESSION_KEY)
  } catch {
    /* private mode: the session just won't survive a reload */
  }
}

let client: TokenClient | null = null

function requestToken(clientId: string): Promise<{ token: string; expires: number; scopes: string[] }> {
  return loadGis().then(
    () =>
      new Promise((resolve, reject) => {
        client ??= window.google!.accounts.oauth2.initTokenClient({ client_id: clientId, scope: SCOPE, callback: () => undefined })
        client.callback = (r) => {
          if (r.error || !r.access_token) reject(new Error(r.error === 'access_denied' ? 'Google sign-in was declined.' : 'Google sign-in failed.'))
          else resolve({ token: r.access_token, expires: Date.now() + (r.expires_in ?? 3600) * 1000, scopes: (r.scope ?? SCOPE).split(/\s+/) })
        }
        client.error_callback = (e) => reject(new Error(e.type === 'popup_closed' ? 'The sign-in window was closed.' : 'Google sign-in failed.'))
        client.requestAccessToken()
      }),
  )
}

/** Opens the Google popup. Call it from a click, or the browser blocks the popup. */
export async function signIn(clientId: string): Promise<Session> {
  const { token, expires, scopes } = await requestToken(clientId)
  const res = await fetch(USERINFO, { headers: { Authorization: `Bearer ${token}` } })
  if (!res.ok) throw new Error('Could not read your Google account.')
  const info = (await res.json()) as { email?: string; name?: string; picture?: string }
  if (!info.email) throw new Error('Google did not share your email address.')
  const session: Session = { token, expires, email: info.email.toLowerCase(), name: info.name, picture: info.picture, scopes }
  saveSession(session)
  return session
}

/** The other apps' copies of this (about to be revoked) token, which would otherwise look signed in. */
function dropSuiteCopies(token: string) {
  for (const [key, field] of Object.entries(SUITE_KEYS)) {
    try {
      if ((JSON.parse(localStorage.getItem(key) ?? 'null') as Record<string, unknown> | null)?.[field] === token) localStorage.removeItem(key)
    } catch {
      /* unreadable: not ours to touch */
    }
  }
}

export async function signOut(session: Session | null): Promise<void> {
  saveSession(null)
  if (session) dropSuiteCopies(session.token)
  if (session && window.google) await new Promise<void>((r) => window.google!.accounts.oauth2.revoke(session.token, r))
}
