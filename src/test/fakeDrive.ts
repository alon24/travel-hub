import type { Trip } from '../model/types.ts'

interface FakePermission {
  id: string
  type: 'user'
  role: 'owner' | 'writer'
  emailAddress: string
  displayName?: string
}
interface FakeFile {
  name: string
  appProperties: Record<string, string>
  parents: string[]
  content: string
  trashed: boolean
  mime?: string
  /** false: a friend's file shared with this account */
  ownedByMe?: boolean
  /** Shared with this account but not yet picked in the Picker: drive.file can't see it */
  hidden?: boolean
  permissions?: FakePermission[]
}

/**
 * Just enough of Drive v3 for the hub: one folder, trip files with appProperties, multipart uploads, trash,
 * and sharing (permissions, files a friend shared that stay hidden until picked).
 */
export class FakeDrive {
  files = new Map<string, FakeFile>()
  calls: string[] = []
  /** The emailMessage of each invite, by address */
  invites = new Map<string, string>()
  private n = 0

  constructor(readonly token = 'tok', readonly me = 'me@example.com') {}

  fetch = (async (input: RequestInfo | URL, init: RequestInit = {}) => {
    const url = new URL(String(input))
    const method = init.method ?? 'GET'
    this.calls.push(`${method} ${url.pathname}`)
    if (new Headers(init.headers).get('Authorization') !== `Bearer ${this.token}`) return new Response('{}', { status: 401 })
    const json = (v: unknown) => new Response(JSON.stringify(v), { status: 200 })
    const [id, sub, pid] = (url.pathname.split('/files/')[1] ?? '').split('/')
    const file = id ? this.files.get(id) : undefined
    if (id && (!file || file.hidden)) return new Response('{}', { status: 404 })

    if (sub === 'permissions') {
      const perms = (file!.permissions ??= [{ id: 'p0', type: 'user', role: 'owner', emailAddress: this.me }])
      if (method === 'GET') return json({ permissions: perms })
      if (method === 'POST') {
        const body = JSON.parse(String(init.body))
        perms.push({ id: `p${perms.length}`, type: 'user', role: body.role, emailAddress: body.emailAddress })
        this.invites.set(body.emailAddress, url.searchParams.get('emailMessage') ?? '')
        return json({ id: `p${perms.length - 1}` })
      }
      if (method === 'DELETE') {
        file!.permissions = perms.filter((p) => p.id !== pid)
        return new Response(null, { status: 204 })
      }
    }
    if (url.pathname === '/drive/v3/files' && method === 'GET') {
      const q = url.searchParams.get('q')!
      const folder = q.includes('folder')
      return json({
        files: [...this.files]
          .filter(([, f]) => !f.trashed && !f.hidden && (folder ? f.mime?.includes('folder') : f.appProperties.kind === 'trip'))
          .map(([id, f]) => ({ id, appProperties: f.appProperties, ownedByMe: f.ownedByMe !== false })),
      })
    }
    if (url.pathname === '/drive/v3/files' && method === 'POST') {
      const meta = JSON.parse(String(init.body))
      const fid = `f${++this.n}`
      this.files.set(fid, { name: meta.name, appProperties: meta.appProperties, parents: [], content: '', trashed: false, mime: meta.mimeType })
      return json({ id: fid })
    }
    if (id && url.searchParams.get('alt') === 'media') return new Response(file!.content, { status: 200 })
    if (id && url.pathname.startsWith('/drive/v3/files/') && method === 'PATCH') {
      if (file!.ownedByMe === false) return new Response('{}', { status: 403 })   // only the owner can trash it
      Object.assign(file!, JSON.parse(String(init.body)))
      return json({ id })
    }
    if (url.pathname.startsWith('/upload/drive/v3/files')) {
      const parts = String(init.body).split(/--trip\w+/).map((p) => p.split('\r\n\r\n')[1]?.trim()).filter(Boolean)
      const meta = JSON.parse(parts[0]!)
      const fid = id || `f${++this.n}`
      this.files.set(fid, { ...file, name: meta.name, appProperties: meta.appProperties, parents: meta.parents ?? file?.parents ?? [], content: parts[1]!, trashed: false })
      return json({ id: fid })
    }
    return new Response('{}', { status: 404 })
  }) as typeof fetch

  /** A friend's trip, shared with this account; `picked` = already opened once through the Picker */
  addFriendsTrip(fileId: string, trip: Trip, picked = false): void {
    this.files.set(fileId, {
      name: `${trip.title}.trip.json`,
      appProperties: { app: 'travel-hub', kind: 'trip', tripId: trip.id, updatedAt: trip.updatedAt },
      parents: ['their-folder'],
      content: JSON.stringify(trip),
      trashed: false,
      ownedByMe: false,
      hidden: !picked,
      permissions: [
        { id: 'p0', type: 'user', role: 'owner', emailAddress: 'friend@example.com', displayName: 'Dana' },
        { id: 'p1', type: 'user', role: 'writer', emailAddress: this.me },
      ],
    })
  }

  trips = () => [...this.files.values()].filter((f) => !f.trashed && f.appProperties.kind === 'trip').map((f) => JSON.parse(f.content) as Trip)
}
