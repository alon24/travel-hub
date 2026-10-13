import { FakeDrive } from '../src/test/fakeDrive.ts'
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
    // The AI's answer to "plan me a trip" (the hub's New trip page), as OpenRouter shapes it
    if (url.pathname === '/ai') {
      const plan = { title: 'Portugal with the guys', from: 'TLV', to: ['LIS', 'OPO'], start: '2026-11-18', nights: 3, adults: 3 }
      return r.fulfill({ json: { choices: [{ message: { content: JSON.stringify(plan) } }] }, headers: CORS })
    }
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
        initTokenClient: (cfg) => { const c = { callback: cfg.callback, scope: cfg.scope,
          requestAccessToken: () => setTimeout(() => c.callback({ access_token: 'e2e-token', expires_in: 3600, scope: c.scope })) }; return c },
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

/**
 * Google Drive for the hub's trip sync and sharing: the same FakeDrive the unit tests use, behind page.route.
 * Returns it, so a test can add a friend's trip or read what was shared.
 */
export async function mockDrive(page: Page, drive = new FakeDrive('e2e-token', ALLOWED_EMAIL)) {
  const cors = { 'access-control-allow-origin': '*', 'access-control-allow-headers': 'authorization, content-type', 'access-control-allow-methods': 'GET, POST, PATCH, DELETE' }
  await page.route(/googleapis\.com\/(upload\/)?drive\/v3\/files/, async (r) => {
    const req = r.request()
    if (req.method() === 'OPTIONS') return r.fulfill({ status: 204, headers: cors })
    const res = await drive.fetch(req.url(), { method: req.method(), headers: req.headers(), body: req.postData() ?? undefined })
    return r.fulfill({ status: res.status, body: res.status === 204 ? '' : await res.text(), headers: { ...cors, 'content-type': 'application/json' } })
  })
  return drive
}

/** Google Picker that picks the file it was opened on, as a person would; picking makes it readable (drive.file) */
export async function mockPicker(page: Page, drive: FakeDrive) {
  await page.exposeFunction('__pickInFakeDrive', (id: string) => {
    drive.files.get(id)!.hidden = false
  })
  await page.route('https://apis.google.com/js/api.js', (r) =>
    r.fulfill({
      contentType: 'text/javascript',
      body: `window.gapi = { load: (n, cb) => cb() };
        window.google = window.google || {};
        window.google.picker = {
          ViewId: { DOCS: 'docs' }, Action: { PICKED: 'picked', CANCEL: 'cancel' },
          DocsView: class { setMimeTypes() { return this } setFileIds(id) { this.id = id; return this } },
          PickerBuilder: class {
            addView(v) { this.v = v; return this } setOAuthToken() { return this } setDeveloperKey() { return this }
            setAppId() { return this } setCallback(cb) { this.cb = cb; return this }
            build() { const b = this; return { setVisible: async () => { await window.__pickInFakeDrive(b.v.id); b.cb({ action: 'picked', docs: [{ id: b.v.id }] }) } } }
          },
        };`,
    }),
  )
}

export async function signIn(page: Page, email = ALLOWED_EMAIL, drive?: FakeDrive) {
  await mockGoogle(page, email)
  await mockWorker(page, email)
  const d = await mockDrive(page, drive)
  await page.goto('/')
  await page.getByRole('button', { name: 'Sign in with Google' }).click()
  return d
}
