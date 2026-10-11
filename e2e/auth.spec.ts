import { expect, test } from '@playwright/test'
import { ADMIN_EMAIL, mockGoogle, mockWorker, signIn } from './google.ts'

test.beforeEach(async ({ page }) => {
  await page.route(/fonts\.(googleapis|gstatic)/, (r) => r.abort())
})

test('the hub is hidden until you sign in', async ({ page }) => {
  await mockGoogle(page)
  await mockWorker(page, 'e2e@example.com')
  await page.goto('/')
  await expect(page.getByRole('button', { name: 'Sign in with Google' })).toBeVisible()
  await expect(page.getByRole('link', { name: 'Open Skyhop' })).toHaveCount(0)
})

test('an allowed account gets in, stays in after a reload, and logs out from the top bar', async ({ page }) => {
  await signIn(page)
  const bar = page.getByRole('banner')
  await expect(bar.getByText('E2E Traveler')).toBeVisible()
  await page.reload()
  await expect(bar.getByText('E2E Traveler')).toBeVisible()
  await bar.getByRole('button', { name: 'Log out' }).click()
  await expect(page.getByRole('button', { name: 'Sign in with Google' })).toBeVisible()
  await page.reload()
  await expect(page.getByRole('button', { name: 'Sign in with Google' })).toBeVisible()
})

test('an account that is not on the list is kept out', async ({ page }) => {
  await signIn(page, 'stranger@example.com')
  await expect(page.getByRole('heading', { name: 'No access yet.' })).toBeVisible()
  await expect(page.getByText('stranger@example.com')).toBeVisible()
  await expect(page.getByRole('link', { name: 'Open Skyhop' })).toHaveCount(0)
})

test('a normal user sees no Admin link', async ({ page }) => {
  await signIn(page)
  await expect(page.getByRole('banner').getByText('E2E Traveler')).toBeVisible()
  await expect(page.getByRole('link', { name: 'Admin' })).toHaveCount(0)
})

test('an admin adds a user from the Admin page', async ({ page }) => {
  await signIn(page, ADMIN_EMAIL)
  await page.getByRole('link', { name: 'Admin' }).click()
  await expect(page.getByRole('heading', { name: 'Who can use the travel apps' })).toBeVisible()
  const form = page.getByRole('form', { name: 'Add a user' })
  await form.getByLabel('Google account').fill('aya@example.com')
  await form.getByRole('button', { name: 'Add user' }).click()
  await expect(page.getByRole('button', { name: 'Remove aya@example.com' })).toBeVisible()
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
  expect(overflow).toBeLessThanOrEqual(0)
})
