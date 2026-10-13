import { expect, test } from '@playwright/test'
import fixture from '../src/test/fixtures/skyhop-handoff.json' with { type: 'json' }
import { signIn } from './google.ts'

const cors = { 'access-control-allow-origin': '*' }

test('pick a hotel near the center of each city, see its prices on Booking, and save it as the stay', async ({ page }) => {
  await page.route(/fonts\.(googleapis|gstatic)/, (r) => r.abort())
  await page.route(/nominatim\.openstreetmap\.org/, (r) => r.fulfill({ json: [{ lat: '38.7223', lon: '-9.1393' }], headers: cors }))
  let overpass = 0
  await page.route(/overpass-api\.de/, (r) => {
    overpass++
    return r.fulfill({
      headers: cors,
      json: { elements: [
        { type: 'node', id: 1, lat: 38.7105, lon: -9.1366, tags: { tourism: 'hotel', name: 'Hotel Baixa', stars: '4' } },
        { type: 'way', id: 2, center: { lat: 38.7223, lon: -9.1393 }, tags: { tourism: 'guest_house', name: 'Casa Central' } },
      ] },
    })
  })
  await signIn(page)
  await page.getByRole('link', { name: 'Plan a trip' }).first().click()
  const to = page.getByLabel('Where to')
  await to.fill('Lisbon')
  await to.press('Enter')
  await page.getByLabel('Leave around').fill('2026-11-16')
  await page.getByRole('button', { name: /Create trip/ }).click()
  const tripId = new URL(page.url()).hash.replace('#/trip/', '')
  await page.goto(`/#/handoff/${Buffer.from(JSON.stringify({ ...fixture, tripId })).toString('base64url')}`)

  await page.getByRole('button', { name: '🔎 Hotels in Lisbon' }).click()
  const list = page.getByRole('list', { name: 'Places to sleep in Lisbon' })
  await expect(list.getByRole('listitem')).toHaveCount(2)
  await expect(list.getByRole('listitem').first()).toContainText('Casa Central')
  await expect(list.getByRole('link', { name: 'Prices for Hotel Baixa' })).toHaveAttribute('href', /booking\.com.*ss=Hotel\+Baixa%2C\+Lisbon/)
  await list.getByRole('button', { name: 'Use Hotel Baixa' }).click()
  await page.getByRole('form', { name: 'Stay in Lisbon' }).getByRole('button', { name: 'Save stay' }).click()
  await expect(page.getByText('Hotel Baixa', { exact: true })).toBeVisible()
  await expect(page.getByText(/on the map/)).toBeVisible()
  expect(overpass).toBe(1)
})
