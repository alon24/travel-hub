import { expect, test } from '@playwright/test'
import { signIn } from './google.ts'

test.beforeEach(async ({ page }) => {
  await page.route(/fonts\.(googleapis|gstatic)/, (r) => r.abort())
  await signIn(page)
  await expect(page.getByRole('heading', { level: 1, name: /Every trip/ })).toBeVisible()
})

test('shows both apps and the example trip', async ({ page }) => {
  await expect(page.getByRole('link', { name: 'Open Skyhop' })).toBeVisible()
  await expect(page.getByRole('link', { name: 'Open MyMaps AI' })).toBeVisible()
  await expect(page.getByRole('article', { name: /Rome & Florence/ })).toContainText('TLV')
})

test('one Android app link covers the whole suite', async ({ page }) => {
  await expect(page.locator('.ctas').getByRole('link', { name: /Android app/ })).toBeVisible()
  await expect(page.getByRole('link', { name: 'Travel Hub for Android' })).toHaveCount(1)
})

test('the page never scrolls sideways', async ({ page }) => {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
  expect(overflow).toBeLessThanOrEqual(0)
})

test('the Trip model tabs switch', async ({ page }) => {
  await page.getByRole('link', { name: 'See the model' }).click()
  await page.getByRole('tab', { name: 'example.json' }).click()
  await expect(page.getByRole('tabpanel')).toContainText('"home": "TLV"')
})

test('ships a PWA manifest and version file', async ({ request }) => {
  const manifest = await (await request.get('/manifest.webmanifest')).json()
  expect(manifest.name).toBe('Travel Hub AI')
  const version = await (await request.get('/version.json')).json()
  expect(version.version).toBeTruthy()
})
