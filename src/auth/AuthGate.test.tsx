import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { AuthGate } from './AuthGate.tsx'
import type { Session } from './google.ts'

const google = vi.hoisted(() => ({
  loadSession: vi.fn<() => Session | null>(),
  lastAccount: vi.fn<() => { email: string } | null>(),
  refreshSession: vi.fn<(clientId: string, prev: { email: string }) => Promise<Session>>(),
  signIn: vi.fn<(clientId: string) => Promise<Session>>(),
  signOut: vi.fn<(s: Session | null) => Promise<void>>(),
}))
vi.mock('./google.ts', () => google)

const ROLES: Record<string, 'admin' | 'user'> = { 'friend@example.com': 'user', 'owner@example.com': 'admin' }
// Stands in for the Worker's /me: the shared user list decides
const check = vi.fn(async (s: Session) => ROLES[s.email] ?? null)
const session = (email: string): Session => ({ token: 't', expires: Date.now() + 3_600_000, email, name: 'Friend' })

function renderGate(clientId = 'client-id') {
  return render(
    <AuthGate clientId={clientId} check={check}>
      {(s, signOut) => (
        <div>
          <p>App for {s?.email ?? 'nobody'}{s ? ` as ${s.role}` : ''}</p>
          <button onClick={signOut}>Log out</button>
        </div>
      )}
    </AuthGate>,
  )
}

beforeEach(() => {
  vi.resetAllMocks()
  check.mockImplementation(async (s: Session) => ROLES[s.email] ?? null)
  google.loadSession.mockReturnValue(null)
  google.lastAccount.mockReturnValue(null)
  google.signOut.mockResolvedValue()
})

describe('AuthGate', () => {
  it('renews an expired token quietly instead of asking to sign in again', async () => {
    google.lastAccount.mockReturnValue({ email: 'friend@example.com' })
    google.refreshSession.mockResolvedValue(session('friend@example.com'))
    renderGate()
    expect(await screen.findByText('App for friend@example.com as user')).toBeInTheDocument()
    expect(google.refreshSession).toHaveBeenCalledWith('client-id', { email: 'friend@example.com' })
  })

  it('falls back to the sign-in button when quiet renewal is not possible', async () => {
    google.lastAccount.mockReturnValue({ email: 'friend@example.com' })
    google.refreshSession.mockRejectedValue(new Error('needs click'))
    renderGate()
    expect(await screen.findByRole('button', { name: 'Sign in with Google' })).toBeInTheDocument()
  })

  it('shows the app without a gate when no Google client is configured', () => {
    renderGate('')
    expect(screen.getByText('App for nobody')).toBeInTheDocument()
  })

  it('shows why sign-in failed and lets you retry', async () => {
    google.signIn.mockRejectedValue(new Error('The sign-in window was closed.'))
    renderGate()
    await userEvent.click(screen.getByRole('button', { name: 'Sign in with Google' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('The sign-in window was closed.')
    expect(screen.getByRole('button', { name: 'Sign in with Google' })).toBeEnabled()
  })

  it('passes the role from the user list to the app', async () => {
    google.loadSession.mockReturnValue(session('owner@example.com'))
    renderGate()
    expect(await screen.findByText('App for owner@example.com as admin')).toBeInTheDocument()
  })

  it("says why when the account can't be checked (offline, first time)", async () => {
    check.mockRejectedValue(new Error('Could not reach the server. Check your connection.'))
    google.loadSession.mockReturnValue(session('friend@example.com'))
    renderGate()
    expect(await screen.findByRole('alert')).toHaveTextContent('Could not reach the server')
    expect(screen.getByRole('button', { name: 'Sign in with Google' })).toBeInTheDocument()
  })

})
