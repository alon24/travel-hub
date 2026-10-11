import { useCallback, useEffect, useState, type FormEvent } from 'react'
import type { AccountApi, AdminUser, AuditEntry, Role, UsageRow } from '../lib/account.ts'

const APPS: Record<string, string> = { hub: 'Travel Hub', mymaps: 'MyMaps AI', skyhop: 'Skyhop', admin: 'Admin' }
const appName = (a: string) => APPS[a] ?? a

const when = (ts: number | null) =>
  ts ? new Date(ts).toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : '—'
const num = (n: number) => n.toLocaleString('en-US')

const errText = (e: unknown) => (e instanceof Error ? e.message : 'Something went wrong.')

/**
 * Admin page: the one user list shared by Travel Hub, MyMaps AI and Skyhop, plus usage and the audit log.
 * Everything here is enforced by the Worker; this page only shows what it returns.
 */
export function AdminPage({ api, self }: { api: AccountApi; self: string }) {
  return (
    <section className="page admin">
      <div className="section-head">
        <span className="label">Admin</span>
        <h2>Who can use the travel apps</h2>
        <p className="muted">One list for Travel Hub, MyMaps AI and Skyhop. Changes apply right away in all three.</p>
      </div>
      <Users api={api} self={self} />
      <Usage api={api} />
      <Audit api={api} />
    </section>
  )
}

function Users({ api, self }: { api: AccountApi; self: string }) {
  const [users, setUsers] = useState<AdminUser[] | null>(null)
  const [error, setError] = useState('')
  const [email, setEmail] = useState('')
  const [role, setRole] = useState<Role>('user')
  const [busy, setBusy] = useState(false)

  const load = useCallback(() => api.users().then(setUsers, (e: unknown) => setError(errText(e))), [api])
  useEffect(() => {
    void load()
  }, [load])

  const add = async (e: FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setError('')
    try {
      await api.addUser(email.trim(), role)
      setEmail('')
      setRole('user')
      await load()
    } catch (err) {
      setError(errText(err))
    } finally {
      setBusy(false)
    }
  }

  const remove = async (u: AdminUser) => {
    if (!window.confirm(`Remove ${u.email}? They lose access to all three apps.`)) return
    setError('')
    try {
      await api.removeUser(u.email)
      await load()
    } catch (err) {
      setError(errText(err))
    }
  }

  return (
    <div className="card admin-block" aria-labelledby="users-h">
      <h3 id="users-h">Users</h3>
      <form className="admin-add" onSubmit={(e) => void add(e)} aria-label="Add a user">
        <label>
          <span>Google account</span>
          <input type="email" required placeholder="friend@gmail.com" value={email} onChange={(e) => setEmail(e.target.value)} />
        </label>
        <label>
          <span>Role</span>
          <select value={role} onChange={(e) => setRole(e.target.value as Role)}>
            <option value="user">User</option>
            <option value="admin">Admin</option>
          </select>
        </label>
        <button type="submit" className="btn small solid" disabled={busy}>{busy ? 'Adding…' : 'Add user'}</button>
      </form>
      {error && <p className="gate-error" role="alert">{error}</p>}
      {users === null ? (
        !error && <p className="muted" role="status">Loading users…</p>
      ) : users.length === 0 ? (
        <p className="muted">No users yet. You're an admin through the Worker settings, so you're always in.</p>
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr><th>Account</th><th>Role</th><th>Added</th><th>Last active</th><th><span className="sr-only">Actions</span></th></tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.email}>
                  <td className="mono">{u.email}</td>
                  <td>{u.role === 'admin' ? <span className="tag">Admin</span> : 'User'}</td>
                  <td className="mono">{when(u.added_at)}</td>
                  <td className="mono">{when(u.last_seen)}</td>
                  <td>
                    {u.email !== self && (
                      <button type="button" className="btn small" onClick={() => void remove(u)} aria-label={`Remove ${u.email}`}>Remove</button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

function Usage({ api }: { api: AccountApi }) {
  const [days, setDays] = useState(30)
  const [rows, setRows] = useState<UsageRow[] | null>(null)
  const [error, setError] = useState('')
  useEffect(() => {
    setRows(null)
    api.usage(days).then(setRows, (e: unknown) => setError(errText(e)))
  }, [api, days])

  return (
    <div className="card admin-block" aria-labelledby="usage-h">
      <div className="admin-head">
        <h3 id="usage-h">AI usage</h3>
        <select aria-label="Period" value={days} onChange={(e) => setDays(Number(e.target.value))}>
          <option value={1}>Last 24 hours</option>
          <option value={7}>Last 7 days</option>
          <option value={30}>Last 30 days</option>
          <option value={365}>Last year</option>
        </select>
      </div>
      {error && <p className="gate-error" role="alert">{error}</p>}
      {rows === null ? (
        !error && <p className="muted" role="status">Loading usage…</p>
      ) : rows.length === 0 ? (
        <p className="muted">No AI use in this period.</p>
      ) : (
        <div className="table-wrap">
          <table>
            <thead><tr><th>Account</th><th>App</th><th className="num">Calls</th><th className="num">Tokens</th><th>Last</th></tr></thead>
            <tbody>
              {rows.map((r) => (
                <tr key={`${r.email}|${r.app}`}>
                  <td className="mono">{r.email}</td>
                  <td>{appName(r.app)}</td>
                  <td className="mono num">{num(r.calls)}</td>
                  <td className="mono num">{num(r.tokens)}</td>
                  <td className="mono">{when(r.last)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

const PAGE = 50

function Audit({ api }: { api: AccountApi }) {
  const [filter, setFilter] = useState('')
  const [entries, setEntries] = useState<AuditEntry[] | null>(null)
  const [more, setMore] = useState(false)
  const [error, setError] = useState('')

  const load = useCallback(
    async (before?: number) => {
      try {
        const page = await api.audit({ email: filter.trim() || undefined, before, limit: PAGE })
        setEntries((prev) => (before && prev ? [...prev, ...page] : page))
        setMore(page.length === PAGE)
      } catch (e) {
        setError(errText(e))
      }
    },
    [api, filter],
  )
  useEffect(() => {
    setEntries(null)
    const t = setTimeout(() => void load(), 300)
    return () => clearTimeout(t)
  }, [load])

  return (
    <div className="card admin-block" aria-labelledby="audit-h">
      <div className="admin-head">
        <h3 id="audit-h">Activity log</h3>
        <input type="search" aria-label="Filter by account" placeholder="Filter by account" value={filter} onChange={(e) => setFilter(e.target.value)} />
      </div>
      {error && <p className="gate-error" role="alert">{error}</p>}
      {entries === null ? (
        !error && <p className="muted" role="status">Loading activity…</p>
      ) : entries.length === 0 ? (
        <p className="muted">Nothing logged yet.</p>
      ) : (
        <>
          <ol className="audit">
            {entries.map((e) => (
              <li key={e.id}>
                <span className="mono when">{when(e.ts)}</span>
                <span className="mono who">{e.email}</span>
                <span>{appName(e.app)} · {e.action.replace(/_/g, ' ')}{e.detail ? `: ${e.detail}` : ''}</span>
                {e.tokens != null && <span className="mono muted">{num(e.tokens)} tokens</span>}
              </li>
            ))}
          </ol>
          {more && <button type="button" className="btn small" onClick={() => void load(entries[entries.length - 1].id)}>Show older</button>}
        </>
      )}
    </div>
  )
}
