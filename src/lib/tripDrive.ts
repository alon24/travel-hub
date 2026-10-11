import { parseTrip } from '../model/schema.ts'
import type { Trip } from '../model/types.ts'

/**
 * Trips in Google Drive, so the same trips show on every device you sign in on.
 * Scope drive.file (same OAuth client as MyMaps AI): the hub sees only the files it created.
 * One `<title>.trip.json` per trip in a "Travel Hub" folder, tagged with the trip id and its updatedAt,
 * so a sync can compare without downloading every file.
 */
export const DRIVE_SCOPE = 'https://www.googleapis.com/auth/drive.file'
const API = 'https://www.googleapis.com/drive/v3'
const UPLOAD = 'https://www.googleapis.com/upload/drive/v3'
const FOLDER = 'Travel Hub'
const APP = 'travel-hub'

export interface DriveCtx {
  token: string
  fetch?: typeof fetch
}

export interface RemoteTrip {
  fileId: string
  tripId: string
  updatedAt: string
}

export class DriveError extends Error {}

async function call(ctx: DriveCtx, url: string, init: RequestInit = {}): Promise<Response> {
  const headers = new Headers(init.headers)
  headers.set('Authorization', `Bearer ${ctx.token}`)
  let res: Response
  try {
    res = await (ctx.fetch ?? fetch)(url, { ...init, headers })
  } catch {
    throw new DriveError("Can't reach Google Drive.")
  }
  if (!res.ok) throw new DriveError(res.status === 401 || res.status === 403 ? 'Google Drive needs you to sign in again.' : `Google Drive error ${res.status}.`)
  return res
}

const query = (q: string, fields: string) => new URLSearchParams({ q, fields, spaces: 'drive', pageSize: '1000' })

export async function folderId(ctx: DriveCtx): Promise<string> {
  const q = `mimeType='application/vnd.google-apps.folder' and name='${FOLDER}' and trashed=false and appProperties has { key='app' and value='${APP}' }`
  const { files } = (await (await call(ctx, `${API}/files?${query(q, 'files(id)')}`)).json()) as { files: { id: string }[] }
  if (files[0]) return files[0].id
  const res = await call(ctx, `${API}/files?fields=id`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: FOLDER, mimeType: 'application/vnd.google-apps.folder', appProperties: { app: APP } }),
  })
  return ((await res.json()) as { id: string }).id
}

export async function listRemote(ctx: DriveCtx): Promise<RemoteTrip[]> {
  const q = `trashed=false and appProperties has { key='app' and value='${APP}' } and appProperties has { key='kind' and value='trip' }`
  const { files } = (await (await call(ctx, `${API}/files?${query(q, 'files(id,appProperties)')}`)).json()) as {
    files: { id: string; appProperties?: Record<string, string> }[]
  }
  return files.flatMap((f) =>
    f.appProperties?.tripId ? [{ fileId: f.id, tripId: f.appProperties.tripId, updatedAt: f.appProperties.updatedAt ?? '' }] : [],
  )
}

/** The trip in a Drive file, or null when the file isn't a valid trip (it is then left alone). */
export async function download(ctx: DriveCtx, fileId: string): Promise<Trip | null> {
  try {
    return parseTrip(await (await call(ctx, `${API}/files/${encodeURIComponent(fileId)}?alt=media`)).json())
  } catch (e) {
    if (e instanceof DriveError) throw e
    return null
  }
}

function multipart(meta: object, trip: Trip): { body: string; type: string } {
  const b = `trip${Math.random().toString(36).slice(2)}`
  return {
    body: `--${b}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(meta)}\r\n` +
      `--${b}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(trip)}\r\n--${b}--`,
    type: `multipart/related; boundary=${b}`,
  }
}

const fileName = (t: Trip) => `${t.title.replace(/[\\/]/g, '_') || 'Trip'}.trip.json`
const props = (t: Trip) => ({ app: APP, kind: 'trip', tripId: t.id, updatedAt: t.updatedAt })

/** Creates the trip's file, or replaces the content of `fileId`. */
export async function upload(ctx: DriveCtx, trip: Trip, fileId?: string, folder?: () => Promise<string>): Promise<void> {
  const meta = fileId
    ? { name: fileName(trip), appProperties: props(trip) }
    : { name: fileName(trip), mimeType: 'application/json', appProperties: props(trip), parents: [await (folder ?? (() => folderId(ctx)))()] }
  const { body, type } = multipart(meta, trip)
  const url = fileId ? `${UPLOAD}/files/${encodeURIComponent(fileId)}?uploadType=multipart&fields=id` : `${UPLOAD}/files?uploadType=multipart&fields=id`
  await call(ctx, url, { method: fileId ? 'PATCH' : 'POST', headers: { 'Content-Type': type }, body })
}

export async function trash(ctx: DriveCtx, fileId: string): Promise<void> {
  await call(ctx, `${API}/files/${encodeURIComponent(fileId)}?fields=id`, {
    method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ trashed: true }),
  })
}
