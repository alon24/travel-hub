import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createTrip } from '../model/plan.ts'
import { saveTrip, getTrip } from '../lib/tripStore.ts'
import { syncTrips } from '../lib/tripSync.ts'
import { FakeDrive } from '../test/fakeDrive.ts'
import { TripShare } from './TripShare.tsx'
import { SharedTrip } from './SharedTrip.tsx'

const portugal = () => createTrip({ title: 'Portugal with the guys', home: 'TLV', destinations: [{ code: 'LIS' }], startDate: '2026-11-18', nights: 3, adults: 3 })

describe('TripShare: plan it together', () => {
  let drive: FakeDrive
  beforeEach(() => {
    localStorage.clear()
    drive = new FakeDrive()
    window.location.hash = '#/'
  })

  it('gives a friend access by email, then hands you an invite link to send: no Google email with a file', async () => {
    const t = saveTrip(portugal())
    await syncTrips({ token: 'tok', fetch: drive.fetch })
    const addUser = vi.fn().mockResolvedValue({})
    render(<TripShare ctx={{ token: 'tok', fetch: drive.fetch }} tripId={t.id} title={t.title} from="Ilan" addUser={addUser} />)

    expect(await screen.findByText('me@example.com')).toBeInTheDocument()
    await userEvent.type(screen.getByLabelText("Friend's email"), 'Dana@Gmail.com')
    await userEvent.click(screen.getByRole('button', { name: 'Invite' }))

    expect(await screen.findByRole('status')).toHaveTextContent('dana@gmail.com can open this trip now. Send them the invite link. They can sign in to the apps now.')
    expect(screen.getByRole('list', { name: 'People on this trip' })).toHaveTextContent('dana@gmail.com')
    const [fileId] = [...drive.files].find(([, f]) => f.appProperties.tripId === t.id)!
    expect(drive.files.get(fileId)!.permissions!.at(-1)).toMatchObject({ role: 'writer', emailAddress: 'dana@gmail.com' })
    expect(drive.invites.get('dana@gmail.com')).toEqual({ googleEmail: false })
    const invite = screen.getByRole('group', { name: 'Invite for dana@gmail.com' })
    expect(invite.querySelector('code')).toHaveTextContent(new RegExp(`#/shared/${fileId}$`))
    const wa = new URL(screen.getByRole('link', { name: 'WhatsApp' }).getAttribute('href')!)
    expect(wa.searchParams.get('text')).toMatch(new RegExp(`^Ilan invited you to plan "Portugal with the guys" together: http.*#/shared/${fileId}$`))
    expect(drive.files.get(fileId)!.name).toBe('Portugal with the guys · Travel Hub trip')
    expect(addUser).toHaveBeenCalledWith('dana@gmail.com')
  })

  it('without admin rights it says who has to let them in, and you can remove people again', async () => {
    const t = saveTrip(portugal())
    await syncTrips({ token: 'tok', fetch: drive.fetch })
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    render(<TripShare ctx={{ token: 'tok', fetch: drive.fetch }} tripId={t.id} title={t.title} from="Ilan" />)
    await screen.findByText('me@example.com')
    await userEvent.type(screen.getByLabelText("Friend's email"), 'dana@gmail.com{Enter}')
    expect(await screen.findByRole('status')).toHaveTextContent('ask an admin to add them')

    await userEvent.click(screen.getByRole('button', { name: 'Remove dana@gmail.com' }))
    await waitFor(() => expect(screen.getByRole('list', { name: 'People on this trip' })).not.toHaveTextContent('dana@gmail.com'))
  })

  it('checks the address before asking Drive', async () => {
    const t = saveTrip(portugal())
    await syncTrips({ token: 'tok', fetch: drive.fetch })
    render(<TripShare ctx={{ token: 'tok', fetch: drive.fetch }} tripId={t.id} title={t.title} from="Ilan" />)
    await screen.findByText('me@example.com')
    await userEvent.type(screen.getByLabelText("Friend's email"), 'dana{Enter}')
    expect(screen.getByRole('status')).toHaveTextContent('Type their email address')
    expect(drive.invites.size).toBe(0)
  })

  it("on a friend's trip you see who it belongs to, and can't invite or remove people", async () => {
    drive.addFriendsTrip('shared1', { ...portugal(), id: 'trip_dana' }, true)
    render(<TripShare ctx={{ token: 'tok', fetch: drive.fetch }} tripId="trip_dana" title="Dana in Lisbon" from="Ilan" />)
    expect(await screen.findByText('Dana')).toBeInTheDocument()
    expect(screen.getByText(/A friend shared this trip with you/)).toBeInTheDocument()
    expect(screen.queryByLabelText("Friend's email")).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Remove/ })).not.toBeInTheDocument()
  })
})

describe('SharedTrip: opening the link from the invite', () => {
  let drive: FakeDrive
  beforeEach(() => {
    localStorage.clear()
    drive = new FakeDrive()
  })

  it('asks you to pick the file once in Google’s window, then opens the trip', async () => {
    drive.addFriendsTrip('shared1', { ...portugal(), id: 'trip_dana', title: 'Dana in Lisbon' })
    const pick = vi.fn(async (id: string) => {
      drive.files.get(id)!.hidden = false   // what picking it in the Picker does
      return id
    })
    const onOpen = vi.fn()
    render(<SharedTrip ctx={{ token: 'tok', fetch: drive.fetch }} fileId="shared1" pick={pick} onOpen={onOpen} />)
    await userEvent.click(await screen.findByRole('button', { name: 'Open the shared trip' }))
    await waitFor(() => expect(onOpen).toHaveBeenCalled())
    expect(pick).toHaveBeenCalledWith('shared1')
    expect(onOpen.mock.calls[0]![0]).toMatchObject({ id: 'trip_dana', title: 'Dana in Lisbon' })
  })

  it('opens at once when the hub can already read it, and explains a missing Picker key', async () => {
    drive.addFriendsTrip('shared1', { ...portugal(), id: 'trip_dana' }, true)
    const onOpen = vi.fn()
    const { unmount } = render(<SharedTrip ctx={{ token: 'tok', fetch: drive.fetch }} fileId="shared1" onOpen={onOpen} />)
    await waitFor(() => expect(onOpen).toHaveBeenCalled())
    unmount()

    drive.addFriendsTrip('shared2', { ...portugal(), id: 'trip_x' })
    render(<SharedTrip ctx={{ token: 'tok', fetch: drive.fetch }} fileId="shared2" onOpen={vi.fn()} />)
    expect(await screen.findByText(/Picker key is not set up/)).toBeInTheDocument()
    expect(getTrip('trip_x')).toBeUndefined()
  })
})
