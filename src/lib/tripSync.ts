import type { Trip } from '../model/types.ts'
import { deletedTrips, forgetDeleted, listTrips, putTrips } from './tripStore.ts'
import { download, folderId, listRemote, trash, upload, type DriveCtx } from './tripDrive.ts'

export interface SyncResult {
  pulled: number
  pushed: number
  removed: number
}

/**
 * Makes this device and Google Drive hold the same trips. For each trip the newer `updatedAt` wins
 * (one person editing on a phone and a laptop, not live co-editing). A trip deleted here is trashed in Drive.
 */
export async function syncTrips(ctx: DriveCtx): Promise<SyncResult> {
  const remote = await listRemote(ctx)
  const local = new Map(listTrips().map((t) => [t.id, t]))
  const deleted = deletedTrips()
  let folder: Promise<string> | null = null
  const inFolder = () => (folder ??= folderId(ctx))

  const gone = remote.filter((r) => deleted.includes(r.tripId))
  for (const r of gone) await trash(ctx, r.fileId)
  forgetDeleted(deleted)

  const pulled: Trip[] = []
  let pushed = 0
  for (const r of remote) {
    if (deleted.includes(r.tripId)) continue
    const mine = local.get(r.tripId)
    if (!mine || r.updatedAt > mine.updatedAt) {
      const t = await download(ctx, r.fileId)
      if (t) pulled.push(t)
    } else if (mine.updatedAt > r.updatedAt) {
      await upload(ctx, mine, r.fileId)
      pushed++
    }
  }
  const known = new Set(remote.map((r) => r.tripId))
  for (const t of local.values()) {
    if (known.has(t.id)) continue
    await upload(ctx, t, undefined, inFolder)
    pushed++
  }
  putTrips(pulled)
  return { pulled: pulled.length, pushed, removed: gone.length }
}
