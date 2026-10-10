import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import App from './App.tsx'
import { MYMAPS_URL, SKYHOP_URL } from './links.ts'

describe('Landing page', () => {
  it('links to both apps', () => {
    render(<App />)
    expect(screen.getByRole('link', { name: 'Open Skyhop' })).toHaveAttribute('href', SKYHOP_URL)
    expect(screen.getByRole('link', { name: 'Open MyMaps AI' })).toHaveAttribute('href', MYMAPS_URL)
  })

  it('draws the example trip from its data', () => {
    render(<App />)
    const pass = screen.getByRole('article', { name: /Rome & Florence/ })
    expect(within(pass).getByText('12 MAR 27')).toBeInTheDocument()
    expect(within(pass).getByText('2A · 1C')).toBeInTheDocument()
    expect(within(pass).getByText('7')).toBeInTheDocument()
  })

  it('switches between the type and the example', async () => {
    render(<App />)
    expect(screen.getByRole('tabpanel')).toHaveTextContent('export interface Trip')
    await userEvent.click(screen.getByRole('tab', { name: 'example.json' }))
    expect(screen.getByRole('tabpanel')).toHaveTextContent('"Rome & Florence"')
  })

  it('shows who is signed in and logs out from the top bar', async () => {
    const onSignOut = vi.fn()
    render(<App account={{ email: 'friend@example.com', name: 'Friend' }} onSignOut={onSignOut} />)
    const bar = screen.getByRole('banner')
    expect(within(bar).getByText('Friend')).toHaveAttribute('title', 'friend@example.com')
    await userEvent.click(within(bar).getByRole('button', { name: 'Log out' }))
    expect(onSignOut).toHaveBeenCalledOnce()
  })

  it('has no account area when there is no sign-in', () => {
    render(<App />)
    expect(screen.queryByRole('button', { name: 'Log out' })).not.toBeInTheDocument()
  })
})
