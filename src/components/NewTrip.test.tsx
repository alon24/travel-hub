import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { NewTrip } from './NewTrip.tsx'
import type { Trip } from '../model/types.ts'

describe('NewTrip: describe it and the AI fills in the form', () => {
  it('fills the form from a sentence, and creates the trip only when you press Create', async () => {
    const onCreate = vi.fn()
    const draft = vi.fn().mockResolvedValue({ title: 'Portugal with the guys', home: 'TLV', places: ['LIS', 'OPO'], start: '2026-11-18', nights: 3, adults: 3, unknown: [] })
    render(<NewTrip onCreate={onCreate} draft={draft} today="2026-10-11" />)
    await userEvent.type(screen.getByLabelText(/Describe it/), '3 nights in Lisbon and Porto in November, 3 of us{Enter}')

    expect(draft).toHaveBeenCalledWith('3 nights in Lisbon and Porto in November, 3 of us')
    expect(await screen.findByRole('status')).toHaveTextContent('Filled in. Check it, then create the trip.')
    expect(screen.getByLabelText('Leave around')).toHaveValue('2026-11-18')
    expect(screen.getByLabelText('Nights')).toHaveValue(3)
    expect(screen.getByLabelText('Travelers')).toHaveValue(3)
    expect(screen.getByLabelText(/Name/)).toHaveValue('Portugal with the guys')
    expect(onCreate).not.toHaveBeenCalled()

    await userEvent.click(screen.getByRole('button', { name: /Create trip/ }))
    const trip = onCreate.mock.calls[0]![0] as Trip
    expect(trip.destinations.map((d) => d.airport)).toEqual(['LIS', 'OPO'])
    expect(trip).toMatchObject({ title: 'Portugal with the guys', home: 'TLV', startDate: '2026-11-18', endDate: '2026-11-21' })
    expect(trip.travelers).toHaveLength(3)
  })

  it('counts a child in Travelers and creates the trip with them as a child', async () => {
    const onCreate = vi.fn()
    const draft = vi.fn().mockResolvedValue({ home: 'TLV', places: ['LIS'], nights: 3, adults: 3, childrenAges: [16], unknown: [] })
    render(<NewTrip onCreate={onCreate} draft={draft} today="2026-10-11" />)
    await userEvent.type(screen.getByLabelText(/Describe it/), '4 people, 1 is a 16 yo child{Enter}')
    expect(screen.getByLabelText('Travelers')).toHaveValue(4)
    await userEvent.click(screen.getByRole('button', { name: /Create trip/ }))
    expect((onCreate.mock.calls[0]![0] as Trip).travelers.map((p) => p.kind)).toEqual(['adult', 'adult', 'adult', 'child'])
  })

  it('shows "3 or 4 nights" as a range and keeps it on the trip', async () => {
    const onCreate = vi.fn()
    const draft = vi.fn().mockResolvedValue({ home: 'TLV', places: ['LIS', 'OPO'], nights: 3, nightsMax: 4, window: { from: '2026-11-01', to: '2026-11-30' }, start: '2026-11-01', unknown: [] })
    render(<NewTrip onCreate={onCreate} draft={draft} today="2026-10-11" />)
    await userEvent.type(screen.getByLabelText(/Describe it/), '3,4 nights in portugal next month{Enter}')
    expect(await screen.findByRole('status')).toHaveTextContent('Comparing 3 to 4 nights.')
    expect(screen.getByLabelText('Nights, from')).toHaveValue(3)
    expect(screen.getByLabelText('Nights, up to')).toHaveValue(4)
    expect(screen.getByRole('note')).toHaveTextContent('compare 3 to 4 nights')
    await userEvent.click(screen.getByRole('button', { name: /Create trip/ }))
    expect(onCreate.mock.calls[0]![0]).toMatchObject({ nightsMax: 4, endDate: '2026-11-04' })
  })

  it('keeps the nights you gave each city ("3 in Lisbon, 4 in Porto"), until you change the nights or cities', async () => {
    const onCreate = vi.fn()
    const draft = vi.fn().mockResolvedValue({ home: 'TLV', places: ['LIS', 'OPO'], start: '2026-11-18', nights: 7, split: [3, 4], unknown: [] })
    render(<NewTrip onCreate={onCreate} draft={draft} today="2026-10-11" />)
    await userEvent.type(screen.getByLabelText(/Describe it/), '3 nights in Lisbon, 4 in Porto{Enter}')
    expect(await screen.findByRole('status')).toHaveTextContent('Lisbon 3 nights, Porto 4 nights.')
    expect(screen.getByLabelText('Nights')).toHaveValue(7)
    await userEvent.click(screen.getByRole('button', { name: /Create trip/ }))
    const trip = onCreate.mock.calls[0]![0] as Trip
    expect(trip.destinations.map((d) => [d.airport, d.arrive, d.depart])).toEqual([['LIS', '2026-11-18', '2026-11-21'], ['OPO', '2026-11-21', '2026-11-25']])

    await userEvent.click(screen.getByRole('button', { name: 'More nights' }))   // your change wins: split evenly again
    await userEvent.click(screen.getByRole('button', { name: /Create trip/ }))
    const again = onCreate.mock.calls[1]![0] as Trip
    expect(again.destinations.map((d) => d.depart)).toEqual(['2026-11-22', '2026-11-26'])
  })

  it('says which places it could not match, and shows AI errors without losing the form', async () => {
    const draft = vi.fn()
      .mockResolvedValueOnce({ places: ['LIS'], unknown: ['Sintra'] })
      .mockRejectedValueOnce(new Error('Not allowed to use the AI. Sign in again.'))
    render(<NewTrip onCreate={vi.fn()} draft={draft} today="2026-10-11" />)
    const box = screen.getByLabelText(/Describe it/)
    await userEvent.type(box, 'Lisbon and Sintra')
    await userEvent.click(screen.getByRole('button', { name: 'Fill in the form' }))
    expect(await screen.findByRole('status')).toHaveTextContent('Not in our city list yet: Sintra.')
    expect(screen.getByRole('button', { name: 'Remove LIS' })).toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: 'Fill in the form' }))
    expect(await screen.findByText('Not allowed to use the AI. Sign in again.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Remove LIS' })).toBeInTheDocument()
  })

  it('keeps "Portugal" as the whole country, so flights go to any of its airports', async () => {
    const onCreate = vi.fn()
    const draft = vi.fn().mockResolvedValue({ home: 'TLV', places: ['LIS', 'OPO'], nights: 3, countries: ['PT'], unknown: [] })
    render(<NewTrip onCreate={onCreate} draft={draft} today="2026-10-11" />)
    await userEvent.type(screen.getByLabelText(/Describe it/), 'flights to Portugal{Enter}')
    expect(await screen.findByRole('note')).toHaveTextContent('Flights to any airport in Portugal: LIS, OPO, FAO')
    await userEvent.click(screen.getByRole('button', { name: /Create trip/ }))
    expect((onCreate.mock.calls[0]![0] as Trip).countries).toEqual(['PT'])
  })

})

describe('NewTrip: flexible dates', () => {
  it('"3 days in December" fills a window, not a fixed date, and the trip keeps it', async () => {
    const onCreate = vi.fn()
    const draft = vi.fn().mockResolvedValue({ home: 'TLV', places: ['LIS'], start: '2026-12-01', nights: 2, window: { from: '2026-12-01', to: '2026-12-31' }, unknown: [] })
    render(<NewTrip onCreate={onCreate} draft={draft} today="2026-10-11" />)
    await userEvent.type(screen.getByLabelText(/Describe it/), '3 days in Lisbon in December{Enter}')
    expect(await screen.findByRole('status')).toHaveTextContent('Any 2 nights between 2026-12-01 and 2026-12-31')
    expect(screen.getByLabelText('Leave from')).toHaveValue('2026-12-01')
    expect(screen.getByLabelText('Back by')).toHaveValue('2026-12-31')
    expect(screen.queryByLabelText('Leave around')).toBeNull()
    await userEvent.click(screen.getByRole('button', { name: /Create trip/ }))
    expect(onCreate.mock.calls[0]![0]).toMatchObject({ flexible: { from: '2026-12-01', to: '2026-12-31' }, startDate: '2026-12-01', endDate: '2026-12-03' })
  })

  it('can be switched on and off by hand, and refuses a window too short for the trip', async () => {
    const onCreate = vi.fn()
    render(<NewTrip onCreate={onCreate} today="2026-10-11" />)
    await userEvent.type(screen.getByLabelText('Where to'), 'LIS{Enter}')
    await userEvent.click(screen.getByLabelText(/Flexible dates/))
    expect(screen.getByLabelText('Leave from')).toHaveValue('2026-11-10')
    expect(screen.getByLabelText('Back by')).toHaveValue('2026-12-10')
    await userEvent.clear(screen.getByLabelText('Back by'))
    await userEvent.type(screen.getByLabelText('Back by'), '2026-11-11')
    await userEvent.click(screen.getByRole('button', { name: /Create trip/ }))
    expect(screen.getByRole('alert')).toHaveTextContent("3 nights don't fit")
    expect(onCreate).not.toHaveBeenCalled()

    await userEvent.click(screen.getByLabelText(/Flexible dates/))
    await userEvent.click(screen.getByRole('button', { name: /Create trip/ }))
    expect((onCreate.mock.calls[0]![0] as Trip).flexible).toBeUndefined()
  })
})

describe('NewTrip: a country as a destination', () => {
  it('adds every airport of a typed country, once, and the trip flies to all of them', async () => {
    const onCreate = vi.fn()
    render(<NewTrip onCreate={onCreate} today="2026-10-11" />)
    await userEvent.type(screen.getByLabelText('Where to'), 'portugal{Enter}')
    for (const code of ['LIS', 'OPO', 'FAO', 'FNC']) expect(screen.getByRole('button', { name: `Remove ${code}` })).toBeInTheDocument()

    await userEvent.type(screen.getByLabelText('Where to'), 'Portugal (all 4 airports)')   // picking it again: no duplicates
    expect(screen.getAllByRole('button', { name: /^Remove / })).toHaveLength(4)

    await userEvent.click(screen.getByRole('button', { name: 'Remove FNC' }))                      // drop the ones you don't want
    await userEvent.click(screen.getByRole('button', { name: /Create trip/ }))
    expect((onCreate.mock.calls[0]![0] as Trip).destinations.map((d) => d.airport)).toEqual(['LIS', 'OPO', 'FAO'])
    expect((onCreate.mock.calls[0]![0] as Trip).countries).toEqual(['PT'])
  })

  it('knows common short names, and says what it does not know', async () => {
    render(<NewTrip onCreate={vi.fn()} today="2026-10-11" />)
    await userEvent.click(screen.getByRole('button', { name: /Create trip/ }))
    expect(screen.getByRole('alert')).toHaveTextContent('Add at least one place to go.')
    await userEvent.type(screen.getByLabelText('Where to'), 'uk{Enter}')
    expect(screen.getByRole('button', { name: 'Remove LHR' })).toBeInTheDocument()
    await userEvent.type(screen.getByLabelText('Where to'), 'Narnia{Enter}')
    expect(screen.getByRole('alert')).toHaveTextContent('Pick a city or a country from the list')
  })
})

