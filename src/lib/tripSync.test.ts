import { beforeEach, describe, expect, it } from 'vitest'
import { createTrip } from '../model/plan.ts'
import type { Trip } from '../model/types.ts'
import { syncTrips } from './tripSync.ts'
import { deleteTrip, deletedTrips, getTrip, listTrips, saveTrip } from './tripStore.ts'
import { FakeDrive } from '../test/fakeDrive.ts'

const trip = (title: string, at: string): Trip => ({
  ...createTrip({ title, home: 'TLV', destinations: [{ code: 'LIS' }], startDate: '2026-11-18', nights: 3, adults: 3 }, new Date(at)),
})

describe('syncTrips', () => {
  let drive: FakeDrive
  const ctx = () => ({ token: 'tok', fetch: drive.fetch })
  beforeEach(() => {
    localStorage.clear()
    drive = new FakeDrive()
  })

  it('puts the trips made here in one Travel Hub folder in Drive', async () => {
    saveTrip(trip('Portugal', '2026-10-10T10:00:00Z'))
    saveTrip(trip('Rome', '2026-10-10T11:00:00Z'))
    expect(await syncTrips(ctx())).toEqual({ pulled: 0, pushed: 2, removed: 0 })
    expect(drive.trips().map((t) => t.title).sort()).toEqual(['Portugal', 'Rome'])
    const folders = [...drive.files.values()].filter((f) => f.mime?.includes('folder'))
    expect(folders).toHaveLength(1)
    expect([...drive.files.values()].filter((f) => f.appProperties.kind === 'trip').every((f) => f.parents[0] === [...drive.files.keys()][0])).toBe(true)
  })

  it('a second device gets the trips, and nothing is uploaded again when both agree', async () => {
    const t = saveTrip(trip('Portugal', '2026-10-10T10:00:00Z'))
    await syncTrips(ctx())
    localStorage.clear()                                       // the phone: nothing here yet
    expect(await syncTrips(ctx())).toEqual({ pulled: 1, pushed: 0, removed: 0 })
    expect(getTrip(t.id)?.title).toBe('Portugal')
    drive.calls = []
    expect(await syncTrips(ctx())).toEqual({ pulled: 0, pushed: 0, removed: 0 })
    expect(drive.calls).toEqual(['GET /drive/v3/files'])      // one list call: compared by the tags, nothing downloaded
  })

  it('the newer copy wins in both directions', async () => {
    const t = saveTrip(trip('Portugal', '2026-10-10T10:00:00Z'))
    await syncTrips(ctx())
    saveTrip({ ...t, title: 'Portugal with the guys', updatedAt: '2026-10-11T09:00:00.000Z' })
    expect((await syncTrips(ctx())).pushed).toBe(1)
    expect(drive.trips()[0]!.title).toBe('Portugal with the guys')

    const [, file] = [...drive.files].find(([, f]) => f.appProperties.kind === 'trip')!
    const newer = { ...JSON.parse(file.content), title: 'Changed on the phone', updatedAt: '2026-10-12T09:00:00.000Z' }
    file.content = JSON.stringify(newer); file.appProperties.updatedAt = newer.updatedAt
    expect((await syncTrips(ctx())).pulled).toBe(1)
    expect(listTrips()[0]!.title).toBe('Changed on the phone')
  })

  it('a trip deleted here is trashed in Drive, not brought back', async () => {
    const t = saveTrip(trip('Portugal', '2026-10-10T10:00:00Z'))
    await syncTrips(ctx())
    deleteTrip(t.id)
    expect(await syncTrips(ctx())).toEqual({ pulled: 0, pushed: 0, removed: 1 })
    expect(drive.trips()).toHaveLength(0)
    expect(listTrips()).toHaveLength(0)
    expect(deletedTrips()).toEqual([])
  })

  it('a file that is not a valid trip is skipped, and an expired sign-in says so', async () => {
    drive.files.set('junk', { name: 'x.trip.json', appProperties: { app: 'travel-hub', kind: 'trip', tripId: 'trip_x', updatedAt: 'z' }, parents: [], content: '{not json', trashed: false })
    expect((await syncTrips(ctx())).pulled).toBe(0)
    await expect(syncTrips({ token: 'old', fetch: drive.fetch })).rejects.toThrow(/sign in again/)
  })

  describe('a trip a friend shared with you', () => {
    const theirs = () => ({ ...trip('Dana in Lisbon', '2026-10-12T10:00:00Z'), id: 'trip_dana' })

    it('comes in once you have opened it, and your edits go back to their file', async () => {
      drive.addFriendsTrip('shared1', theirs(), true)
      expect((await syncTrips(ctx())).pulled).toBe(1)
      saveTrip({ ...getTrip('trip_dana')!, title: 'Dana and me in Lisbon', updatedAt: '2026-10-13T08:00:00.000Z' })
      expect(await syncTrips(ctx())).toEqual({ pulled: 0, pushed: 1, removed: 0 })
      expect(JSON.parse(drive.files.get('shared1')!.content).title).toBe('Dana and me in Lisbon')
      expect(drive.files.get('shared1')!.parents).toEqual(['their-folder'])   // stays in their Drive, not copied to yours
    })

    it('stays out of sight until you open the invite (Drive hides it from the hub until then)', async () => {
      drive.addFriendsTrip('shared1', theirs())
      expect((await syncTrips(ctx())).pulled).toBe(0)
      expect(getTrip('trip_dana')).toBeUndefined()
    })

    it('deleting it only hides it here: it is not trashed for them and does not come back', async () => {
      drive.addFriendsTrip('shared1', theirs(), true)
      await syncTrips(ctx())
      deleteTrip('trip_dana')
      expect(await syncTrips(ctx())).toEqual({ pulled: 0, pushed: 0, removed: 0 })
      expect(drive.files.get('shared1')!.trashed).toBe(false)
      expect(getTrip('trip_dana')).toBeUndefined()
      expect(deletedTrips()).toEqual(['trip_dana'])
    })
  })
})
