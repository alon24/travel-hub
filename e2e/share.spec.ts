import { expect, test } from '@playwright/test'
import { FakeDrive } from '../src/test/fakeDrive.ts'
import { createTrip } from '../src/model/plan.ts'
import { ALLOWED_EMAIL, mockPicker, signIn } from './google.ts'

test.beforeEach(async ({ page }) => {
  await page.route(/fonts\.(googleapis|gstatic)/, (r) => r.abort())
})

test('invite a friend to a trip: Google emails them a link that opens it in the hub', async ({ page }) => {
  const drive = await signIn(page)
  await page.getByRole('link', { name: 'Plan a trip' }).first().click()
  await page.getByLabel('Where to').fill('Lisbon')
  await page.getByLabel('Where to').press('Enter')
  await page.getByRole('button', { name: /Create trip/ }).click()
  await expect(page.getByRole('status').filter({ hasText: 'In Drive' })).toBeVisible()

  const share = page.getByRole('region', { name: 'Plan it together' })
  await expect(share.getByText(ALLOWED_EMAIL)).toBeVisible()
  await share.getByLabel("Friend's email").fill('dana@gmail.com')
  await share.getByRole('button', { name: 'Invite' }).click()
  await expect(share.getByRole('status')).toContainText('Invited dana@gmail.com')
  await expect(share.getByRole('list', { name: 'People on this trip' })).toContainText('dana@gmail.com')
  expect(drive.invites.get('dana@gmail.com')).toMatch(/#\/shared\/f\d+$/)
})

test("open a friend's invite: pick it once in Google's window and it joins your trips", async ({ page }) => {
  const drive = new FakeDrive('e2e-token', ALLOWED_EMAIL)
  drive.addFriendsTrip('shared1', { ...createTrip({ title: "Dana's Lisbon", home: 'TLV', destinations: [{ code: 'LIS' }], startDate: '2026-11-18', nights: 3, adults: 2 }), id: 'trip_dana' })
  await mockPicker(page, drive)
  await signIn(page, ALLOWED_EMAIL, drive)
  await expect(page.getByRole('status').filter({ hasText: 'In Drive' })).toBeVisible()

  await page.goto('/#/shared/shared1')
  await page.getByRole('button', { name: 'Open the shared trip' }).click()
  await expect(page).toHaveURL(/#\/trip\/trip_dana$/)
  await expect(page.getByRole('region', { name: 'Plan it together' })).toContainText('A friend shared this trip with you')
  await page.goto('/')
  await expect(page.getByRole('link', { name: /Dana's Lisbon/ })).toBeVisible()
})
