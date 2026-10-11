import type { Trip } from '../model/types.ts'

/** Just enough of Drive v3 for the hub: one folder, trip files with appProperties, multipart uploads, trash. */
export class FakeDrive {
  files = new Map<string, { name: string; appProperties: Record<string, string>; parents: string[]; content: string; trashed: boolean; mime?: string }>()
  calls: string[] = []
  private n = 0

  fetch = (async (input: RequestInfo | URL, init: RequestInit = {}) => {
    const url = new URL(String(input))
    const method = init.method ?? 'GET'
    this.calls.push(`${method} ${url.pathname}`)
    if (new Headers(init.headers).get('Authorization') !== 'Bearer tok') return new Response('{}', { status: 401 })
    const json = (v: unknown) => new Response(JSON.stringify(v), { status: 200 })
    const id = url.pathname.split('/files/')[1]
    if (url.pathname === '/drive/v3/files' && method === 'GET') {
      const q = url.searchParams.get('q')!
      const folder = q.includes('folder')
      return json({ files: [...this.files].filter(([, f]) => !f.trashed && (folder ? f.mime?.includes('folder') : f.appProperties.kind === 'trip'))
        .map(([id, f]) => ({ id, appProperties: f.appProperties })) })
    }
    if (url.pathname === '/drive/v3/files' && method === 'POST') {
      const meta = JSON.parse(String(init.body))
      const fid = `f${++this.n}`
      this.files.set(fid, { name: meta.name, appProperties: meta.appProperties, parents: [], content: '', trashed: false, mime: meta.mimeType })
      return json({ id: fid })
    }
    if (url.pathname.startsWith('/drive/v3/files/') && url.searchParams.get('alt') === 'media') return new Response(this.files.get(id)!.content, { status: 200 })
    if (url.pathname.startsWith('/drive/v3/files/') && method === 'PATCH') {
      Object.assign(this.files.get(id)!, JSON.parse(String(init.body)))
      return json({ id })
    }
    if (url.pathname.startsWith('/upload/drive/v3/files')) {
      const parts = String(init.body).split(/--trip\w+/).map((p) => p.split('\r\n\r\n')[1]?.trim()).filter(Boolean)
      const meta = JSON.parse(parts[0]!)
      const fid = id ?? `f${++this.n}`
      const prev = this.files.get(fid)
      this.files.set(fid, { name: meta.name, appProperties: meta.appProperties, parents: meta.parents ?? prev?.parents ?? [], content: parts[1]!, trashed: false })
      return json({ id: fid })
    }
    return new Response('{}', { status: 404 })
  }) as typeof fetch

  trips = () => [...this.files.values()].filter((f) => !f.trashed && f.appProperties.kind === 'trip').map((f) => JSON.parse(f.content) as Trip)
}

