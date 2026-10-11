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

  it('has no AI box when the AI is not set up', () => {
    render(<NewTrip onCreate={vi.fn()} today="2026-10-11" />)
    expect(screen.queryByLabelText(/Describe it/)).not.toBeInTheDocument()
  })
})
