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

  it('walks through the steps and points at each part of the screen', async () => {
    render(<App firstRunHelp />)
    // No sign-in here, so the Drive step has nothing to point at and is skipped
    expect(guide()).toHaveTextContent('1/4')
    expect(guide()).toHaveTextContent('One place for the whole vacation')
    await userEvent.click(within(guide()).getByRole('button', { name: 'Next' }))
    expect(guide()).toHaveTextContent('Start a trip')
    const plan = screen.getAllByRole('link', { name: 'Plan a trip' })[0]
    expect(plan).toHaveClass('help-spot')
    await userEvent.click(within(guide()).getByRole('button', { name: 'Next' }))
    expect(plan).not.toHaveClass('help-spot')
    expect(document.querySelector('#trips')).toHaveClass('help-spot')
    await userEvent.click(within(guide()).getByRole('button', { name: 'Back' }))
    expect(guide()).toHaveTextContent('Start a trip')
    await userEvent.click(within(guide()).getByRole('button', { name: 'Next' }))
    await userEvent.click(within(guide()).getByRole('button', { name: 'Next' }))
    expect(guide()).toHaveTextContent('Help on every screen')
    await userEvent.click(within(guide()).getByRole('button', { name: 'Got it' }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(document.querySelector('.help-spot')).toBeNull()
  })

  it('reopens from the Help button and closes with Escape or ×', async () => {
    render(<App />)
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    const help = screen.getByRole('button', { name: /Help/ })
    await userEvent.click(help)
    expect(guide()).toHaveTextContent('Welcome to Travel Hub')
    await userEvent.keyboard('{Escape}')
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    await userEvent.click(help)
    await userEvent.click(within(guide()).getByRole('button', { name: 'Close help' }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('explains the screen you are on', async () => {
    render(<App firstRunHelp />)
    await userEvent.click(within(guide()).getByRole('button', { name: 'Close help' }))
    goTo('#/new')
    expect(guide()).toHaveTextContent('Planning a new trip')
    expect(guide()).toHaveTextContent(`1/${GUIDES.new.steps.length - 1}`) // the AI box needs a sign-in
    expect(guide()).toHaveTextContent('Where to')
    expect(document.querySelector('#nt-to')!.closest('[data-help]')).toHaveClass('help-spot')
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
