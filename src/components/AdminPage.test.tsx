import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { AccountApi, AdminUser, AuditEntry } from '../lib/account.ts'
import { AdminPage } from './AdminPage.tsx'

const OWNER = 'owner@example.com'

function fakeApi() {
  let users: AdminUser[] = [
    { email: OWNER, role: 'admin', added_by: null, added_at: 1_700_000_000_000, last_seen: null },
    { email: 'friend@example.com', role: 'user', added_by: OWNER, added_at: 1_700_000_000_000, last_seen: 1_700_000_500_000 },
  ]
  const audit: AuditEntry[] = [
    { id: 2, ts: 1_700_000_600_000, email: 'friend@example.com', app: 'skyhop', action: 'chat', detail: null, tokens: 1200 },
    { id: 1, ts: 1_700_000_500_000, email: OWNER, app: 'admin', action: 'add_user', detail: 'friend@example.com (user)', tokens: null },
  ]
  return {
    users: vi.fn(async () => users),
    addUser: vi.fn(async (email: string, role: 'admin' | 'user') => {
      users = [...users, { email, role, added_by: OWNER, added_at: Date.now(), last_seen: null }]
      return { user: { email, role } }
    }),
    removeUser: vi.fn(async (email: string) => {
      users = users.filter((u) => u.email !== email)
      return { removed: email }
    }),
    audit: vi.fn(async ({ email }: { email?: string } = {}) => audit.filter((e) => !email || e.email === email)),
    usage: vi.fn(async () => [{ email: 'friend@example.com', app: 'skyhop', calls: 3, tokens: 4500, last: 1_700_000_600_000 }]),
  }
}

let api: ReturnType<typeof fakeApi>
beforeEach(() => {
  api = fakeApi()
  vi.spyOn(window, 'confirm').mockReturnValue(true)
})
const renderPage = () => render(<AdminPage api={api as unknown as AccountApi} self={OWNER} />)

describe('Admin page', () => {
  it('lists the users; you can remove others but not yourself', async () => {
    renderPage()
    const table = (await screen.findByRole('button', { name: 'Remove friend@example.com' })).closest('table')!
    expect(within(table).getByText(OWNER)).toBeInTheDocument()
    expect(within(table).queryByRole('button', { name: `Remove ${OWNER}` })).not.toBeInTheDocument()
    await userEvent.click(within(table).getByRole('button', { name: 'Remove friend@example.com' }))
    expect(api.removeUser).toHaveBeenCalledWith('friend@example.com')
    expect(await within(table).findByText(OWNER)).toBeInTheDocument()
    expect(within(table).queryByText('friend@example.com')).not.toBeInTheDocument()
  })

  it('adds a user with a role', async () => {
    renderPage()
    const form = screen.getByRole('form', { name: 'Add a user' })
    await userEvent.type(within(form).getByLabelText('Google account'), 'aya@example.com')
    await userEvent.selectOptions(within(form).getByLabelText('Role'), 'admin')
    await userEvent.click(within(form).getByRole('button', { name: 'Add user' }))
    expect(api.addUser).toHaveBeenCalledWith('aya@example.com', 'admin')
    expect(await screen.findByRole('button', { name: 'Remove aya@example.com' })).toBeInTheDocument()
    expect(within(form).getByLabelText('Google account')).toHaveValue('')
  })

  it('shows the error the server gives', async () => {
    api.addUser.mockRejectedValueOnce(new Error('invalid email'))
    renderPage()
    const form = screen.getByRole('form', { name: 'Add a user' })
    await userEvent.type(within(form).getByLabelText('Google account'), 'x@y.co')
    await userEvent.click(within(form).getByRole('button', { name: 'Add user' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('invalid email')
  })

  it('shows usage per account and app, and the activity log with a filter', async () => {
    renderPage()
    const usage = screen.getByRole('heading', { name: 'AI usage' }).closest('div.card') as HTMLElement
    expect(await within(usage).findByText('4,500')).toBeInTheDocument()
    expect(within(usage).getByText('Skyhop')).toBeInTheDocument()
    await userEvent.selectOptions(within(usage).getByLabelText('Period'), '7')
    expect(api.usage).toHaveBeenLastCalledWith(7)

    const log = screen.getByRole('heading', { name: 'Activity log' }).closest('div.card') as HTMLElement
    expect(await within(log).findByText(/Admin · add user: friend@example.com/)).toBeInTheDocument()
    expect(within(log).getByText('1,200 tokens')).toBeInTheDocument()
    await userEvent.type(within(log).getByLabelText('Filter by account'), 'friend@example.com')
    await vi.waitFor(() => expect(api.audit).toHaveBeenLastCalledWith(expect.objectContaining({ email: 'friend@example.com' })))
    expect(await within(log).findByText(/Skyhop · chat/)).toBeInTheDocument()
    expect(within(log).queryByText(/add user/)).not.toBeInTheDocument()
  })
})
