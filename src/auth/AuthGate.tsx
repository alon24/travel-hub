import { useEffect, useState, type ReactNode } from 'react'
import { isAllowed } from './allowlist.ts'
import { loadSession, signIn, signOut, type Session } from './google.ts'

type State =
  | { kind: 'checking'; session: Session }
  | { kind: 'signed-out'; error?: string }
  | { kind: 'denied'; session: Session }
  | { kind: 'signed-in'; session: Session }

interface Props {
  /** Empty = no gate (local dev without a Google client) */
  clientId: string
  allowlist: string[]
  children: (session: Session | null, signOut: () => void) => ReactNode
}

/** Shows the app only to allowed Google accounts. */
export function AuthGate({ clientId, allowlist, children }: Props) {
  const [state, setState] = useState<State>(() => {
    const s = clientId ? loadSession() : null
    return s ? { kind: 'checking', session: s } : { kind: 'signed-out' }
  })
  const [busy, setBusy] = useState(false)

  // Check a restored or fresh session against the allowlist
  const session = state.kind === 'checking' ? state.session : null
  useEffect(() => {
    if (!session) return
    let live = true
    void isAllowed(session.email, allowlist).then((ok) => {
      if (live) setState({ kind: ok ? 'signed-in' : 'denied', session })
    })
    return () => {
      live = false
    }
  }, [session, allowlist])

  // The Google token is short-lived: go back to the sign-in screen when it runs out
  const expires = state.kind === 'signed-in' ? state.session.expires : 0
  useEffect(() => {
    if (!expires) return
    const t = setTimeout(() => setState({ kind: 'signed-out', error: 'Your session ended. Sign in again.' }), Math.max(0, expires - Date.now()))
    return () => clearTimeout(t)
  }, [expires])

  if (!clientId) return <>{children(null, () => undefined)}</>

  const logOut = () => {
    const s = 'session' in state ? state.session : null
    setState({ kind: 'signed-out' })
    void signOut(s)
  }

  const start = async () => {
    setBusy(true)
    try {
      setState({ kind: 'checking', session: await signIn(clientId) })
    } catch (e) {
      setState({ kind: 'signed-out', error: e instanceof Error ? e.message : 'Google sign-in failed.' })
    } finally {
      setBusy(false)
    }
  }

  if (state.kind === 'signed-in') return <>{children(state.session, logOut)}</>

  return (
    <main className="gate-screen">
      <div className="gate-card">
        <div className="brand"><i />Travel Hub AI</div>
        {state.kind === 'checking' && <p className="muted" role="status">Checking your account…</p>}
        {state.kind === 'signed-out' && (
          <>
            <h1>Sign in to plan your trips.</h1>
            {state.error && <p className="gate-error" role="alert">{state.error}</p>}
            <button type="button" className="btn solid" onClick={() => void start()} disabled={busy}>
              {busy ? 'Signing in…' : 'Sign in with Google'}
            </button>
          </>
        )}
        {state.kind === 'denied' && (
          <>
            <h1>No access yet.</h1>
            <p className="muted">
              <b>{state.session.email}</b> isn't on the list for Travel Hub AI. Ask the owner to add it, or use another account.
            </p>
            <button type="button" className="btn" onClick={logOut}>Log out</button>
          </>
        )}
      </div>
    </main>
  )
}
