import type { Page } from '@playwright/test'

export const ALLOWED_EMAIL = 'e2e@example.com'

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
  await mockDrive(page)
  await page.goto('/')
  await page.getByRole('button', { name: 'Sign in with Google' }).click()
}
