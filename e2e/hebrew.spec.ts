import { expect, test } from '@playwright/test'
import { signIn } from './google.ts'

test.beforeEach(async ({ page }) => {
  await page.route(/fonts\.(googleapis|gstatic)/, (r) => r.abort())
  await signIn(page)
  // The language button saves the choice and reloads
  await page.getByRole('button', { name: 'Language' }).click()
})

test('Hebrew: right-to-left, translated, nothing scrolls sideways', async ({ page }) => {
  await expect(page.locator('html')).toHaveAttribute('dir', 'rtl')
  await expect(page.getByRole('link', { name: 'תכנון טיול' }).first()).toBeVisible()
  await page.getByRole('link', { name: 'תכנון טיול' }).first().click()
  await expect(page.getByRole('heading', { name: 'לאן נוסעים?' })).toBeVisible()
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
  expect(overflow).toBeLessThanOrEqual(0)
  await page.screenshot({ path: process.env.HE_SHOT ?? '/tmp/he-new.png', fullPage: true })
})
