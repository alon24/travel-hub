import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { AuthGate } from './auth/AuthGate.tsx'
import { parseAllowlist } from './auth/allowlist.ts'
import { env } from './env.ts'

const allowlist = parseAllowlist(env.VITE_ALLOWED_EMAILS)

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AuthGate clientId={env.VITE_GOOGLE_CLIENT_ID} allowlist={allowlist}>
      {(session, signOut) => <App account={session} onSignOut={signOut} />}
    </AuthGate>
  </StrictMode>,
)
