import { expect, test } from '@playwright/test'
import { signIn } from './google.ts'

test.beforeEach(async ({ page }) => {
  await page.route(/fonts\.(googleapis|gstatic)/, (r) => r.abort())
})

test('a first visit gets a guide that points at each part of the screen, and Help brings it back', async ({ page }, info) => {
  await signIn(page, undefined, undefined, { help: true })
  const guide = page.getByRole('dialog')
  await expect(guide).toContainText('Welcome to Travel Hub')
  await page.screenshot({ path: info.outputPath('help-1.png') })
  await guide.getByRole('button', { name: 'Next' }).click()
  await expect(guide).toContainText('Start a trip')
  await expect(page.locator('.help-spot')).toHaveText('Plan a trip')
  await page.screenshot({ path: info.outputPath('help-2.png') })
  expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(0)
  await guide.getByRole('button', { name: 'Close help' }).click()
  await expect(guide).toHaveCount(0)

  // The next screen explains itself once too
  await page.locator('[data-help="plan"]').click()
  await expect(guide).toContainText('Planning a new trip')
  await page.screenshot({ path: info.outputPath('help-3.png') })
  await page.keyboard.press('Escape')
  await expect(guide).toHaveCount(0)

  // Gone after a reload, back on demand
  await page.reload()
  await expect(page.getByRole('heading', { name: 'Where are you going?' })).toBeVisible()
  await expect(guide).toHaveCount(0)
  await page.getByRole('button', { name: /Help/ }).click()
  await expect(guide).toContainText('Planning a new trip')
})
