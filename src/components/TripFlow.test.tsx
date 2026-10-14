import { act, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import App from '../App.tsx'
import fixture from '../test/fixtures/skyhop-handoff.json'
import { encodePayload, flightsHandoff } from '../model/handoff.ts'
import { applyFlights, createTrip } from '../model/plan.ts'
import type { Trip } from '../model/types.ts'
import { NewTrip } from './NewTrip.tsx'
import { TripPage } from './TripPage.tsx'
import { FakeDrive } from '../test/fakeDrive.ts'
import { saveTrip } from '../lib/tripStore.ts'

const NOW = new Date('2026-10-10T12:00:00Z')

describe('NewTrip', () => {
  it('creates a two-city trip for three people', async () => {
    const onCreate = vi.fn()
    render(<NewTrip onCreate={onCreate} today="2026-10-10" />)
    const to = screen.getByLabelText('Where to')
    await userEvent.type(to, 'Lisbon{Enter}')
    await userEvent.type(to, 'opo{Enter}')
    await userEvent.clear(screen.getByLabelText('Leave around'))
    await userEvent.type(screen.getByLabelText('Leave around'), '2026-11-16')
    await userEvent.click(screen.getByRole('button', { name: 'More travelers' }))
    await userEvent.click(screen.getByRole('button', { name: /Create trip/ }))
    const trip: Trip = onCreate.mock.calls[0][0]
    expect(trip.destinations.map((d) => d.airport)).toEqual(['LIS', 'OPO'])
    expect(trip.travelers).toHaveLength(3)
    expect([trip.startDate, trip.endDate]).toEqual(['2026-11-16', '2026-11-19'])
  })

  it('explains what is missing', async () => {
    render(<NewTrip onCreate={vi.fn()} today="2026-10-10" />)
    await userEvent.click(screen.getByRole('button', { name: /Create trip/ }))
    expect(screen.getByRole('alert')).toHaveTextContent('Add at least one place to go.')
    await userEvent.type(screen.getByLabelText('Where to'), 'Atlantis{Enter}')
    expect(screen.getByRole('alert')).toHaveTextContent(/Pick a city/)
  })
})

describe('TripPage', () => {
  const idea = createTrip({ home: 'TLV', destinations: [{ code: 'LIS' }, { code: 'OPO' }], startDate: '2026-11-16', nights: 3, adults: 3 }, NOW)
  const withFlights = applyFlights(idea, { ...flightsHandoff.parse(fixture), tripId: idea.id }, NOW)

  it('sends a new trip to Skyhop with the search filled in', async () => {
    const navigate = vi.fn()
    render(<TripPage trip={idea} onChange={vi.fn()} onDelete={vi.fn()} navigate={navigate} />)
    expect(screen.getByRole('listitem', { current: 'step' })).toHaveTextContent('Flights')
    await userEvent.click(screen.getByRole('button', { name: /Find flights in Skyhop/ }))
    const url = new URL(navigate.mock.calls[0][0])
    expect(url.searchParams.get('to')).toBe('LIS,OPO')
    expect(url.searchParams.get('adults')).toBe('3')
    expect(url.searchParams.get('trip')).toBe(idea.id)
  })

  it('adds a hotel for the open nights, pinned on the map', async () => {
    const onChange = vi.fn()
    const geocoder = vi.fn(async () => [-9.13, 38.71] as [number, number])
    render(<TripPage trip={withFlights} onChange={onChange} onDelete={vi.fn()} geocoder={geocoder} />)
    expect(screen.getByText('3 nights open')).toBeInTheDocument()
    const stays = screen.getByRole('region', { name: /Where you sleep/ })
    expect(within(stays).getAllByRole('link', { name: 'Booking.com ↗' })[0].getAttribute('href')).toContain('group_adults=3')
    await userEvent.click(within(stays).getAllByRole('button', { name: /Add the place you booked/ })[0])
    const form = screen.getByRole('form', { name: 'Stay in Lisbon' })
    await userEvent.type(within(form).getByLabelText('Hotel or apartment name'), 'Alfama flat')
    await userEvent.type(within(form).getByLabelText('Total price'), '1200')
    await userEvent.click(within(form).getByRole('button', { name: 'Save stay' }))
    expect(geocoder).toHaveBeenCalledWith('Alfama flat, Lisbon', [-9.1354, 38.7742])
    const saved: Trip = onChange.mock.calls[0][0]
    expect(saved.stays[0]).toMatchObject({ name: 'Alfama flat', checkIn: '2026-11-16', checkOut: '2026-11-18', price: 1200, location: [-9.13, 38.71] })
  })

  it('shows the itinerary as day tabs with Google Maps links and directions', async () => {
    let current = withFlights
    const { rerender } = render(<TripPage trip={current} onChange={(t) => { current = t }} onDelete={vi.fn()} />)
    const tabs = screen.getByRole('tablist', { name: 'Trip days' })
    expect(within(tabs).getAllByRole('tab')).toHaveLength(withFlights.days.length)
    await userEvent.click(within(tabs).getAllByRole('tab')[1])
    expect(screen.getByRole('tab', { selected: true })).toBe(within(tabs).getAllByRole('tab')[1])
    expect(screen.queryByRole('link', { name: /Directions/ })).toBeNull()
    await userEvent.type(screen.getByLabelText('Place name'), 'Belém Tower')
    await userEvent.click(screen.getByRole('button', { name: /Add$/ }))
    rerender(<TripPage trip={current} onChange={(t) => { current = t }} onDelete={vi.fn()} />)
    expect(screen.getByRole('link', { name: 'Open Belém Tower in Google Maps' }).getAttribute('href')).toContain('google.com/maps/search')
    expect(screen.getByRole('link', { name: /Directions in Google Maps/ }).getAttribute('href')).toContain('google.com/maps/dir')
  })

  it('opens the map in MyMaps AI and remembers it on the trip', async () => {
    const onChange = vi.fn()
    const navigate = vi.fn()
    render(<TripPage trip={withFlights} onChange={onChange} onDelete={vi.fn()} navigate={navigate} />)
    await userEvent.click(screen.getByRole('button', { name: /Plan the days on a map/ }))
    expect(onChange.mock.calls[0][0].apps.mymaps.mapId).toBe(`trip-${idea.id}`)
    expect(navigate.mock.calls[0][0]).toMatch(/mymaps-ai\/#\/import\//)
  })
})

describe('App routes', () => {
  beforeEach(() => {
    localStorage.clear()
    window.location.hash = ''
  })

  it('turns flights sent from Skyhop into a saved trip and opens it', async () => {
    window.location.hash = `#/handoff/${encodePayload(fixture)}`
    render(<App />)
    expect(await screen.findByRole('heading', { name: /Where you sleep/ })).toBeInTheDocument()
    expect(window.location.hash).toMatch(/^#\/trip\//)
    expect(screen.getByRole('article', { name: 'Trip: Lisbon & Porto' })).toBeInTheDocument()
    expect(JSON.parse(localStorage.getItem('travel-hub.trips')!)).toHaveLength(1)
  })

  it('shows a readable error for a broken link', async () => {
    window.location.hash = '#/handoff/broken'
    render(<App />)
    expect(await screen.findByRole('alert')).toHaveTextContent(/damaged/)
  })

  it('lists saved trips on the landing page', async () => {
    render(<App />)
    expect(screen.getAllByRole('link', { name: /Plan a trip/ })).toHaveLength(2)
    act(() => {
      window.location.hash = '#/new'
      window.dispatchEvent(new HashChangeEvent('hashchange'))
    })
    expect(screen.getByRole('form', { name: 'Plan a trip' })).toBeInTheDocument()
  })
})

describe('Trips in Google Drive', () => {
  beforeEach(() => {
    localStorage.clear()
    window.location.hash = '#/'
  })

  it('a signed-in hub keeps its trips in Drive and says so in the top bar', async () => {
    const drive = new FakeDrive()
    saveTrip(createTrip({ title: 'Portugal', home: 'TLV', destinations: [{ code: 'LIS' }], startDate: '2026-11-18', nights: 3, adults: 3 }, NOW))
    render(<App account={{ email: 'a@example.com', token: 'tok' }} driveFetch={drive.fetch} />)
    expect(await screen.findByText('☁ In Drive')).toBeInTheDocument()
    expect(drive.trips().map((t) => t.title)).toEqual(['Portugal'])
  })

  it('shows a Drive problem without blocking the trips', async () => {
    render(<App account={{ email: 'a@example.com', token: 'expired' }} driveFetch={new FakeDrive().fetch} />)
    expect(await screen.findByText('⚠ Drive')).toHaveAttribute('title', expect.stringMatching(/sign in again/))
    expect(screen.getAllByRole('link', { name: /Plan a trip/ }).length).toBeGreaterThan(0)   // the hub still works
  })
})
