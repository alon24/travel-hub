/**
 * Google sign-in with Google Identity Services (token model), loaded on demand.
 * The session (short-lived access token + who it belongs to) is kept in localStorage
 * so a reload doesn't ask again; it ends when the token expires or on sign-out.
 * The same token authorizes AI calls to the Worker (`Authorization: Bearer`).
 */

// drive.file: the hub keeps your trips in your own Google Drive (tripDrive.ts), so every device sees them
const SCOPE = 'openid email profile https://www.googleapis.com/auth/drive.file'
const SESSION_KEY = 'travel-hub.session'
const GIS_SRC = 'https://accounts.google.com/gsi/client'
const USERINFO = 'https://www.googleapis.com/oauth2/v3/userinfo'

export interface Session {
  token: string
  expires: number
  email: string
  name?: string
  picture?: string
}

interface TokenResponse {
  access_token?: string
  expires_in?: number
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

function requestToken(clientId: string): Promise<{ token: string; expires: number }> {
  return loadGis().then(
    () =>
      new Promise((resolve, reject) => {
        client ??= window.google!.accounts.oauth2.initTokenClient({ client_id: clientId, scope: SCOPE, callback: () => undefined })
        client.callback = (r) => {
          if (r.error || !r.access_token) reject(new Error(r.error === 'access_denied' ? 'Google sign-in was declined.' : 'Google sign-in failed.'))
          else resolve({ token: r.access_token, expires: Date.now() + (r.expires_in ?? 3600) * 1000 })
        }
        client.error_callback = (e) => reject(new Error(e.type === 'popup_closed' ? 'The sign-in window was closed.' : 'Google sign-in failed.'))
        client.requestAccessToken()
      }),
  )
}

/** Opens the Google popup. Call it from a click, or the browser blocks the popup. */
export async function signIn(clientId: string): Promise<Session> {
  const { token, expires } = await requestToken(clientId)
  const res = await fetch(USERINFO, { headers: { Authorization: `Bearer ${token}` } })
  if (!res.ok) throw new Error('Could not read your Google account.')
  const info = (await res.json()) as { email?: string; name?: string; picture?: string }
  if (!info.email) throw new Error('Google did not share your email address.')
  const session: Session = { token, expires, email: info.email.toLowerCase(), name: info.name, picture: info.picture }
  saveSession(session)
  return session
}

export async function signOut(session: Session | null): Promise<void> {
  saveSession(null)
  if (session && window.google) await new Promise<void>((r) => window.google!.accounts.oauth2.revoke(session.token, r))
}
