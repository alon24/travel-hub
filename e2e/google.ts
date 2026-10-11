import type { Page } from '@playwright/test'

export const ALLOWED_EMAIL = 'e2e@example.com'
export const ADMIN_EMAIL = 'admin@example.com'
const WORKER = 'https://worker.e2e.test'
const CORS = {
  'access-control-allow-origin': '*',
  'access-control-allow-headers': 'authorization, content-type, x-app',
  'access-control-allow-methods': 'GET, POST, DELETE',
}

/**
 * Stands in for the Worker's shared user list: /me answers for the signed-in account,
 * and the admin API keeps an in-memory list.
 */
export async function mockWorker(page: Page, email: string) {
  const roles: Record<string, 'admin' | 'user'> = { [ALLOWED_EMAIL]: 'user', [ADMIN_EMAIL]: 'admin' }
  const added: { email: string; role: string }[] = []
  await page.route(`${WORKER}/**`, async (r) => {
    const req = r.request()
    if (req.method() === 'OPTIONS') return r.fulfill({ status: 204, headers: CORS })
    const url = new URL(req.url())
    const role = roles[email]
    if (!role) return r.fulfill({ status: 401, json: { error: 'unauthorized' }, headers: CORS })
    if (url.pathname === '/me') return r.fulfill({ json: { email, role }, headers: CORS })
    if (role !== 'admin') return r.fulfill({ status: 403, json: { error: 'admins only' }, headers: CORS })
    if (url.pathname === '/admin/users' && req.method() === 'POST') {
      const body = req.postDataJSON() as { email: string; role: string }
      added.push(body)
      return r.fulfill({ json: { user: body }, headers: CORS })
    }
    if (url.pathname === '/admin/users') {
      const users = [{ email: ADMIN_EMAIL, role: 'admin', added_by: null, added_at: 1_700_000_000_000, last_seen: null }, ...added.map((u) => ({ ...u, added_by: email, added_at: Date.now(), last_seen: null }))]
      return r.fulfill({ json: { users }, headers: CORS })
    }
    if (url.pathname === '/admin/usage') return r.fulfill({ json: { days: 30, rows: [] }, headers: CORS })
    if (url.pathname === '/admin/audit') return r.fulfill({ json: { entries: [] }, headers: CORS })
    return r.fulfill({ status: 404, json: { error: 'not found' }, headers: CORS })
  })
}

/**
 * Stands in for Google: a fake Identity Services script that hands out a token at once,
 * and a userinfo endpoint that says who the token belongs to.
 */
export async function mockGoogle(page: Page, email = ALLOWED_EMAIL) {
  await page.route('https://accounts.google.com/gsi/client', (r) =>
    r.fulfill({
      contentType: 'text/javascript',
      body: `window.google = { accounts: { oauth2: {
        initTokenClient: (cfg) => { const c = { callback: cfg.callback,
          requestAccessToken: () => setTimeout(() => c.callback({ access_token: 'e2e-token', expires_in: 3600 })) }; return c },
        revoke: (t, done) => done(),
      } } }`,
    }),
  )
  await page.route('https://www.googleapis.com/oauth2/v3/userinfo', (r) =>
    r.request().method() === 'OPTIONS'
      ? r.fulfill({ status: 204, headers: { 'access-control-allow-origin': '*', 'access-control-allow-headers': 'authorization' } })
      : r.fulfill({ json: { email, name: 'E2E Traveler' }, headers: { 'access-control-allow-origin': '*' } }),
  )
}

/** An empty Google Drive that accepts uploads, for the hub's trip sync */
export async function mockDrive(page: Page) {
  const cors = { 'access-control-allow-origin': '*', 'access-control-allow-headers': 'authorization, content-type', 'access-control-allow-methods': 'GET, POST, PATCH' }
  const uploads: string[] = []
  await page.route(/googleapis\.com\/(upload\/)?drive\/v3\/files/, (r) => {
    if (r.request().method() === 'OPTIONS') return r.fulfill({ status: 204, headers: cors })
    if (r.request().method() === 'GET') return r.fulfill({ json: { files: [] }, headers: cors })
    uploads.push(r.request().url())
    return r.fulfill({ json: { id: `f${uploads.length}` }, headers: cors })
  })
  return uploads
}

export async function signIn(page: Page, email = ALLOWED_EMAIL) {
  await mockGoogle(page, email)
  await mockWorker(page, email)
  await mockDrive(page)
  await page.goto('/')
  await page.getByRole('button', { name: 'Sign in with Google' }).click()
}
