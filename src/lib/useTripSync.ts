import { useEffect, useState } from 'react'
import { onTripsChange } from './tripStore.ts'
import { syncTrips } from './tripSync.ts'

export type SyncState = { kind: 'off' } | { kind: 'syncing' } | { kind: 'synced' } | { kind: 'error'; message: string }

/** Keeps the trips in Google Drive while signed in: once on sign-in, then shortly after every change. */
export function useTripSync(token: string | undefined, fetcher?: typeof fetch, delay = 1500): SyncState {
  const [state, setState] = useState<SyncState>({ kind: token ? 'syncing' : 'off' })
  useEffect(() => {
    if (!token) return
    let alive = true, running = false, again = false
    let timer: ReturnType<typeof setTimeout> | undefined
    const run = async () => {
      if (running) { again = true; return }
      running = true
      setState({ kind: 'syncing' })
      try {
        await syncTrips({ token, fetch: fetcher })
        if (alive) setState({ kind: 'synced' })
      } catch (e) {
        if (alive) setState({ kind: 'error', message: e instanceof Error ? e.message : 'Google Drive error.' })
      } finally {
        running = false
        if (again && alive) { again = false; void run() }
      }
    }
    void run()
    const off = onTripsChange(() => { clearTimeout(timer); timer = setTimeout(() => void run(), delay) })
    return () => { alive = false; clearTimeout(timer); off() }
  }, [token, fetcher, delay])
  return token ? state : { kind: 'off' }
}
