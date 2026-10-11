import { expect, test } from '@playwright/test'
import fixture from '../src/test/fixtures/skyhop-handoff.json' with { type: 'json' }
import { signIn } from './google.ts'

test.beforeEach(async ({ page }) => {
  await page.route(/fonts\.(googleapis|gstatic)/, (r) => r.abort())
  await signIn(page)
})

test('plan a two-city trip, get flights back from Skyhop, and see the nights left to book', async ({ page }) => {
  await page.getByRole('link', { name: 'Plan a trip' }).first().click()
  const to = page.getByLabel('Where to')
  await to.fill('Lisbon')
  await to.press('Enter')
  await to.fill('Porto')
  await to.press('Enter')
  await page.getByLabel('Leave around').fill('2026-11-16')
  await page.getByRole('button', { name: 'More travelers' }).click()
  await page.getByRole('button', { name: 'More travelers' }).click()
  await page.getByRole('button', { name: /Create trip/ }).click()

  await expect(page).toHaveURL(/#\/trip\//)
  await expect(page.getByRole('list', { name: 'Progress' }).locator('[aria-current="step"]')).toHaveText(/Flights/)
  const tripId = new URL(page.url()).hash.replace('#/trip/', '')

  // What Skyhop's "Save to my Travel Hub trip" button opens
  const payload = Buffer.from(JSON.stringify({ ...fixture, tripId })).toString('base64url')
  await page.goto(`/#/handoff/${payload}`)

  await expect(page).toHaveURL(new RegExp(`#/trip/${tripId}$`))
  await expect(page.getByRole('list', { name: 'Progress' }).locator('[aria-current="step"]')).toHaveText(/Stays/)
  await expect(page.getByText('3 nights open')).toBeVisible()
  await expect(page.getByRole('form', { name: 'Stay in Lisbon' }).or(page.getByRole('link', { name: /Booking/ }).first())).toBeVisible()

  // Signed in, the trip is also kept in Google Drive (mocked), so the phone sees it
  await expect(page.getByRole('status').filter({ hasText: 'In Drive' })).toBeVisible()

  // The trip survives a reload and shows on the landing page
  await page.goto('/')
  await expect(page.getByRole('link', { name: /Lisbon & Porto.*3 pax/ })).toBeVisible()
})

test('describe the trip in a sentence: the AI fills in the form, you check it and create', async ({ page }) => {
  await page.getByRole('link', { name: 'Plan a trip' }).first().click()
  await page.getByLabel(/Describe it/).fill('3 nights in Lisbon and Porto in mid November, 3 of us from Tel Aviv')
  await page.getByRole('button', { name: 'Fill in the form' }).click()
  await expect(page.getByText('Filled in. Check it, then create the trip.')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Remove OPO' })).toBeVisible()
  await expect(page.getByLabel('Leave around')).toHaveValue('2026-11-18')
  await expect(page).toHaveURL(/#\/new/)                               // nothing is created until you say so
  await page.getByRole('button', { name: /Create trip/ }).click()
  await expect(page.getByRole('article', { name: 'Trip: Portugal with the guys' })).toContainText('LIS')
})

test('a damaged Skyhop link explains itself instead of crashing', async ({ page }) => {
  await page.goto('/#/handoff/not-a-real-payload')
  await expect(page.getByRole('alert')).toContainText(/damaged|understand/)
})
