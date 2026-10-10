import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { AuthGate } from './AuthGate.tsx'
import type { Session } from './google.ts'

const google = vi.hoisted(() => ({
  loadSession: vi.fn<() => Session | null>(),
  signIn: vi.fn<(clientId: string) => Promise<Session>>(),
  signOut: vi.fn<(s: Session | null) => Promise<void>>(),
}))
vi.mock('./google.ts', () => google)

const ALLOWED = ['friend@example.com']
const session = (email: string): Session => ({ token: 't', expires: Date.now() + 3_600_000, email, name: 'Friend' })

function renderGate(clientId = 'client-id') {
  return render(
    <AuthGate clientId={clientId} allowlist={ALLOWED}>
      {(s, signOut) => (
        <div>
          <p>App for {s?.email ?? 'nobody'}</p>
          <button onClick={signOut}>Log out</button>
        </div>
      )}
    </AuthGate>,
  )
}

beforeEach(() => {
  vi.resetAllMocks()
  google.loadSession.mockReturnValue(null)
  google.signOut.mockResolvedValue()
})

describe('AuthGate', () => {
  it('shows the app without a gate when no Google client is configured', () => {
    renderGate('')
    expect(screen.getByText('App for nobody')).toBeInTheDocument()
  })

  it('asks to sign in, then shows the app to an allowed account', async () => {
    google.signIn.mockResolvedValue(session('friend@example.com'))
    renderGate()
    expect(screen.queryByText(/App for/)).not.toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Sign in with Google' }))
    expect(await screen.findByText('App for friend@example.com')).toBeInTheDocument()
    expect(google.signIn).toHaveBeenCalledWith('client-id')
  })

  it('keeps out an account that is not on the list', async () => {
    google.signIn.mockResolvedValue(session('stranger@example.com'))
    renderGate()
    await userEvent.click(screen.getByRole('button', { name: 'Sign in with Google' }))
    expect(await screen.findByText('No access yet.')).toBeInTheDocument()
    expect(screen.getByText('stranger@example.com')).toBeInTheDocument()
    expect(screen.queryByText(/App for/)).not.toBeInTheDocument()
  })

  it('shows why sign-in failed and lets you retry', async () => {
    google.signIn.mockRejectedValue(new Error('The sign-in window was closed.'))
    renderGate()
    await userEvent.click(screen.getByRole('button', { name: 'Sign in with Google' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('The sign-in window was closed.')
    expect(screen.getByRole('button', { name: 'Sign in with Google' })).toBeEnabled()
  })

  it('restores a saved session without a popup', async () => {
    google.loadSession.mockReturnValue(session('friend@example.com'))
    renderGate()
    expect(await screen.findByText('App for friend@example.com')).toBeInTheDocument()
    expect(google.signIn).not.toHaveBeenCalled()
  })

  it('logs out back to the sign-in screen', async () => {
    const s = session('friend@example.com')
    google.loadSession.mockReturnValue(s)
    renderGate()
    await userEvent.click(await screen.findByRole('button', { name: 'Log out' }))
    expect(screen.getByRole('button', { name: 'Sign in with Google' })).toBeInTheDocument()
    expect(google.signOut).toHaveBeenCalledWith(s)
  })
})
