import { t } from '../i18n.ts'
import { useEffect, useState, type ReactNode } from 'react'
import type { Role } from '../lib/account.ts'
import { loadSession, signIn, signOut, type Session } from './google.ts'

export type Account = Session & { role: Role }

type State =
  | { kind: 'checking'; session: Session }
  | { kind: 'signed-out'; error?: string }
  | { kind: 'denied'; session: Session }
  | { kind: 'signed-in'; session: Account }

interface Props {
  /** Empty = no gate (local dev without a Google client) */
  clientId: string
  /** Asks who may come in (the Worker's shared user list): a role, or null for "not on the list" */
  check: (session: Session) => Promise<Role | null>
  children: (account: Account | null, signOut: () => void) => ReactNode
}

/** Shows the app only to Google accounts on the shared user list. */
export function AuthGate({ clientId, check, children }: Props) {
  const [state, setState] = useState<State>(() => {
    const s = clientId ? loadSession() : null
    return s ? { kind: 'checking', session: s } : { kind: 'signed-out' }
  })
  const [busy, setBusy] = useState(false)

  // Check a restored or fresh session against the user list
  const session = state.kind === 'checking' ? state.session : null
  useEffect(() => {
    if (!session) return
    let live = true
    check(session).then(
      (role) => {
        if (live) setState(role ? { kind: 'signed-in', session: { ...session, role } } : { kind: 'denied', session })
      },
      (e: unknown) => {
        if (live) setState({ kind: 'signed-out', error: e instanceof Error ? e.message : t('Could not check your account.') })
      },
    )
    return () => {
      live = false
    }
  }, [session, check])

  // The Google token is short-lived: go back to the sign-in screen when it runs out
  const expires = state.kind === 'signed-in' ? state.session.expires : 0
  useEffect(() => {
    if (!expires) return
    const timer = setTimeout(() => setState({ kind: 'signed-out', error: t('Your session ended. Sign in again.') }), Math.max(0, expires - Date.now()))
    return () => clearTimeout(timer)
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
      setState({ kind: 'signed-out', error: e instanceof Error ? e.message : t('Google sign-in failed.') })
    } finally {
      setBusy(false)
    }
  }

  if (state.kind === 'signed-in') return <>{children(state.session, logOut)}</>

  return (
    <main className="gate-screen">
      <div className="gate-card">
        <div className="brand"><i />Travel Hub AI</div>
        {state.kind === 'checking' && <p className="muted" role="status">{t('Checking your account…')}</p>}
        {state.kind === 'signed-out' && (
          <>
            <h1>{t('Sign in to plan your trips.')}</h1>
            {state.error && <p className="gate-error" role="alert">{state.error}</p>}
            <button type="button" className="btn solid" onClick={() => void start()} disabled={busy}>
              {busy ? t('Signing in…') : t('Sign in with Google')}
            </button>
          </>
        )}
        {state.kind === 'denied' && (
          <>
            <h1>{t('No access yet.')}</h1>
            <p className="muted">
              <b>{state.session.email}</b> {t("isn't on the list for Travel Hub AI. Ask the owner to add it, or use another account.")}
            </p>
            <button type="button" className="btn" onClick={logOut}>{t('Log out')}</button>
          </>
        )}
      </div>
    </main>
  )
}
