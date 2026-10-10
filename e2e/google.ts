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

export async function signIn(page: Page, email = ALLOWED_EMAIL) {
  await mockGoogle(page, email)
  await page.goto('/')
  await page.getByRole('button', { name: 'Sign in with Google' }).click()
}
