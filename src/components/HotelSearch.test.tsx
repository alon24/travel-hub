import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import fixture from '../test/fixtures/skyhop-handoff.json'
import { flightsHandoff } from '../model/handoff.ts'
import { applyFlights, createTrip } from '../model/plan.ts'
import type { Trip } from '../model/types.ts'
import type { Hotel } from '../lib/hotels.ts'
import { TripPage } from './TripPage.tsx'

const NOW = new Date('2026-10-10T12:00:00Z')
const idea = createTrip({ home: 'TLV', destinations: [{ code: 'LIS' }, { code: 'OPO' }], startDate: '2026-11-16', nights: 3, adults: 3 }, NOW)
const trip = applyFlights(idea, { ...flightsHandoff.parse(fixture), tripId: idea.id }, NOW)

const LISBON: Hotel[] = [
  { id: 'way/2', name: 'Casa Central', kind: 'guest_house', location: [-9.1393, 38.7223], km: 0 },
  { id: 'node/1', name: 'Hotel Baixa', kind: 'hotel', stars: 4, website: 'https://baixa.example', location: [-9.1366, 38.7105], km: 1.3 },
  { id: 'node/3', name: 'Hostel Up', kind: 'hostel', location: [-9.15, 38.74], km: 2.4 },
]

describe('Hotels in each city', () => {
  it('lists places near the center; "Use" saves one as the stay at its map position, without geocoding', async () => {
    const hotelFinder = vi.fn().mockResolvedValue(LISBON)
    const geocoder = vi.fn()
    const onChange = vi.fn()
    render(<TripPage trip={trip} onChange={onChange} onDelete={vi.fn()} hotelFinder={hotelFinder} geocoder={geocoder} />)

    await userEvent.click(screen.getByRole('button', { name: '🔎 Hotels in Lisbon' }))
    const list = await screen.findByRole('list', { name: 'Places to sleep in Lisbon' })
    expect(hotelFinder).toHaveBeenCalledWith('Lisbon', expect.any(Array))
    expect(within(list).getAllByRole('listitem').map((li) => li.querySelector('b')!.textContent)).toEqual(['Casa Central', 'Hotel Baixa', 'Hostel Up'])
    expect(within(list).getAllByRole('listitem')[1]).toHaveTextContent('Hotel · ★★★★ · 1.3 km from the center')

    const prices = new URL(within(list).getByRole('link', { name: 'Prices for Hotel Baixa' }).getAttribute('href')!)
    expect(prices.searchParams.get('ss')).toBe('Hotel Baixa, Lisbon')
    expect(prices.searchParams.get('group_adults')).toBe('3')
    expect(prices.searchParams.get('checkin')).toMatch(/^2026-11-/)

    await userEvent.click(screen.getByRole('button', { name: 'Hotels' }))   // only hotels
    expect(within(list).getAllByRole('listitem')).toHaveLength(1)

    await userEvent.click(within(list).getByRole('button', { name: 'Use Hotel Baixa' }))
    const form = screen.getByRole('form', { name: 'Stay in Lisbon' })
    expect(within(form).getByLabelText('Hotel or apartment name')).toHaveValue('Hotel Baixa')
    expect(within(form).getByLabelText('Link (optional)')).toHaveValue('https://baixa.example')
    await userEvent.type(within(form).getByLabelText('Total price'), '1200')
    await userEvent.click(within(form).getByRole('button', { name: 'Save stay' }))

    const saved = (onChange.mock.calls.at(-1)![0] as Trip).stays.at(-1)!
    expect(saved).toMatchObject({ name: 'Hotel Baixa', location: [-9.1366, 38.7105], price: 1200, url: 'https://baixa.example' })
    expect(geocoder).not.toHaveBeenCalled()
  })

  it('says when OpenStreetMap is unreachable, and tries again on request', async () => {
    const hotelFinder = vi.fn().mockRejectedValueOnce(new Error("Can't reach OpenStreetMap right now.")).mockResolvedValueOnce(LISBON)
    render(<TripPage trip={trip} onChange={vi.fn()} onDelete={vi.fn()} hotelFinder={hotelFinder} />)
    await userEvent.click(screen.getByRole('button', { name: '🔎 Hotels in Lisbon' }))
    expect(await screen.findByRole('alert')).toHaveTextContent("Can't reach OpenStreetMap right now.")
    await userEvent.click(screen.getByRole('button', { name: 'Try again' }))
    expect(await screen.findByRole('list', { name: 'Places to sleep in Lisbon' })).toBeInTheDocument()
  })
})
