import { act, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it } from 'vitest'
import App from '../App.tsx'
import { saveTrip } from '../lib/tripStore.ts'
import { createTrip } from '../model/plan.ts'
import { GUIDES } from './guides.ts'

const goTo = (hash: string) =>
  act(() => {
    window.location.hash = hash
    window.dispatchEvent(new HashChangeEvent('hashchange'))
  })

const guide = () => screen.getByRole('dialog')

describe('Help guide', () => {
  beforeEach(() => {
    localStorage.clear()
    window.location.hash = ''
  })

  it('opens by itself the first time a screen is seen, and only once', () => {
    const { unmount } = render(<App firstRunHelp />)
    expect(guide()).toHaveTextContent('Welcome to Travel Hub')
    unmount()
    render(<App firstRunHelp />)
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('covers every part of the trip page', async () => {
    const trip = saveTrip(createTrip({ title: 'Portugal', home: 'TLV', destinations: [{ code: 'LIS' }, { code: 'OPO' }], startDate: '2027-05-01', nights: 6, adults: 2 }))
    window.location.hash = `#/trip/${trip.id}`
    render(<App firstRunHelp />)
    // Everything but "Plan it together", which needs a Drive sign-in
    expect(guide()).toHaveTextContent(`1/${GUIDES.trip.steps.length - 1}`)
    const seen: string[] = []
    for (;;) {
      seen.push(within(guide()).getByRole('heading').textContent!)
      expect(document.querySelectorAll('.help-spot')).toHaveLength(1)
      const next = within(guide()).queryByRole('button', { name: 'Next' })
      if (!next) break
      await userEvent.click(next)
    }
    expect(seen).toEqual(GUIDES.trip.steps.filter((s) => s.target !== '.share').map((s) => s.title))
  })

  it('skips the tour, or stops guides from opening by themselves', async () => {
    const { unmount } = render(<App firstRunHelp />)
    await userEvent.click(within(guide()).getByRole('button', { name: 'Skip' }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    goTo('#/new')
    await userEvent.click(within(guide()).getByRole('button', { name: "Don't show guides again" }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    unmount()
    // No other screen opens its guide by itself now, but ? Help still does
    const trip = saveTrip(createTrip({ title: 'Rome', home: 'TLV', destinations: [{ code: 'FCO' }], startDate: '2027-05-01', nights: 3, adults: 2 }))
    window.location.hash = `#/trip/${trip.id}`
    render(<App firstRunHelp />)
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: /Help/ }))
    expect(guide()).toHaveTextContent('Your trip page')
  })
})
