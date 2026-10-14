import { t } from '../i18n.ts'
/**
 * Who may use the hub is decided by the Worker, from the user list shared by all the travel apps
 * (Cloudflare D1, managed on the admin page). This module asks it, and talks to its admin API.
 */

export type Role = 'admin' | 'user'

export class AccountError extends Error {
  status: number
  constructor(message: string, status: number) {
    super(message)
    this.status = status
  }
}

const ROLE_KEY = 'travel-hub.role'

/** The last role the Worker gave this account, so the installed app still opens offline. */
export function cachedRole(email: string): Role | null {
  try {
    const r = JSON.parse(localStorage.getItem(ROLE_KEY) ?? 'null') as { email?: string; role?: Role } | null
    return r?.email === email && (r.role === 'admin' || r.role === 'user') ? r.role : null
  } catch {
    return null
  }
}

function rememberRole(email: string, role: Role | null) {
  try {
    if (role) localStorage.setItem(ROLE_KEY, JSON.stringify({ email, role }))
    else localStorage.removeItem(ROLE_KEY)
  } catch {
    /* ignore */
  }
}

export class AccountApi {
  private base: string
  private token: string
  private fetchImpl: typeof fetch
  constructor(workerUrl: string, token: string, fetchImpl: typeof fetch = (...a) => fetch(...a)) {
    this.base = workerUrl.replace(/\/$/, '')
    this.token = token
    this.fetchImpl = fetchImpl
  }

  private async call<T>(path: string, init: RequestInit = {}): Promise<T> {
    let res: Response
    try {
      res = await this.fetchImpl(`${this.base}${path}`, {
        ...init,
        headers: { Authorization: `Bearer ${this.token}`, 'X-App': 'hub', ...(init.body ? { 'Content-Type': 'application/json' } : {}) },
      })
    } catch {
      throw new AccountError(t('Could not reach the server. Check your connection.'), 0)
    }
    if (!res.ok) {
      let msg = `Server error ${res.status}`
      try {
        const body = (await res.json()) as { error?: string }
        if (body.error) msg = body.error
      } catch {
        /* not JSON */
      }
      throw new AccountError(msg, res.status)
    }
    return (await res.json()) as T
  }

  /**
   * The signed-in account's role, or null when it isn't on the list.
   * Offline, falls back to the last answer for the same account.
   */
  async role(email: string): Promise<Role | null> {
    try {
      const me = await this.call<{ email: string; role: Role }>('/me')
      rememberRole(email, me.role)
      return me.role
    } catch (e) {
      if (e instanceof AccountError && (e.status === 401 || e.status === 403)) {
        rememberRole(email, null)
        return null
      }
      const cached = cachedRole(email)
      if (cached) return cached
      throw e
    }
  }

  users = () => this.call<{ users: AdminUser[] }>('/admin/users').then((r) => r.users)
  addUser = (email: string, role: Role) =>
    this.call<{ user: { email: string; role: Role } }>('/admin/users', { method: 'POST', body: JSON.stringify({ email, role }) })
  removeUser = (email: string) => this.call<{ removed: string }>(`/admin/users?email=${encodeURIComponent(email)}`, { method: 'DELETE' })
  audit = (filter: { email?: string; app?: string; before?: number; limit?: number } = {}) => {
    const q = new URLSearchParams()
    for (const [k, v] of Object.entries(filter)) if (v !== undefined && v !== '') q.set(k, String(v))
    return this.call<{ entries: AuditEntry[] }>(`/admin/audit${q.size ? `?${q}` : ''}`).then((r) => r.entries)
  }
  usage = (days: number) => this.call<{ days: number; rows: UsageRow[] }>(`/admin/usage?days=${days}`).then((r) => r.rows)
}

export interface AdminUser {
  email: string
  role: Role
  added_by: string | null
  added_at: number
  last_seen: number | null
}
export interface AuditEntry {
  id: number
  ts: number
  email: string
  app: string
  action: string
  detail: string | null
  tokens: number | null
}
export interface UsageRow {
  email: string
  app: string
  calls: number
  tokens: number
  last: number
}
