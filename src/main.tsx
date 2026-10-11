import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { AuthGate } from './auth/AuthGate.tsx'
import type { Session } from './auth/google.ts'
import { env } from './env.ts'
import { AccountApi, type Role } from './lib/account.ts'

// The Worker decides who comes in, from the user list shared by all the travel apps.
// Without a Worker (local dev) any Google account gets in as a user.
const check = (s: Session): Promise<Role | null> =>
  env.VITE_WORKER_URL ? new AccountApi(env.VITE_WORKER_URL, s.token).role(s.email) : Promise.resolve('user')

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AuthGate clientId={env.VITE_GOOGLE_CLIENT_ID} check={check}>
      {(session, signOut) => <App account={session} onSignOut={signOut} />}
    </AuthGate>
  </StrictMode>,
)
