import { useEffect, useState, type FormEvent } from 'react'
import { hubUrl } from '../links.ts'
import { fileOf, listPeople, shareTrip, unshare, type DriveCtx, type Person } from '../lib/tripDrive.ts'

interface Props {
  ctx: DriveCtx
  tripId: string
  title: string
  /** Who is sharing, for the invite email */
  from: string
  /** Admins also let the friend into the apps (the shared user list); others ask an admin */
  addUser?: (email: string) => Promise<unknown>
  /** The latest Drive sync finished: a trip made a moment ago has its file now */
  synced?: boolean
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export const sharedLink = (fileId: string) => `${hubUrl()}#/shared/${encodeURIComponent(fileId)}`

/** Who plans this trip with you: invite a friend by email, they edit the same trip (its Drive file). */
export function TripShare({ ctx, tripId, title, from, addUser, synced }: Props) {
  const [file, setFile] = useState<{ id: string; mine: boolean } | null | undefined>(undefined)
  const [people, setPeople] = useState<Person[]>([])
  const [email, setEmail] = useState('')
  const [busy, setBusy] = useState(false)
  const [note, setNote] = useState('')

  const load = async () => {
    try {
      const f = await fileOf(ctx, tripId)
      setFile(f ? { id: f.fileId, mine: f.mine } : null)
      if (f) setPeople(await listPeople(ctx, f.fileId))
    } catch (e) {
      setNote(e instanceof Error ? e.message : "Couldn't reach Google Drive.")
    }
  }
  useEffect(() => {
    void load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tripId, ctx.token])
  useEffect(() => {
    if (synced && file === null) void load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [synced])

  const invite = async (e: FormEvent) => {
    e.preventDefault()
    const who = email.trim().toLowerCase()
    if (!EMAIL.test(who)) return setNote('Type their email address, e.g. dana@gmail.com')
    if (!file) return setNote('This trip is still being saved to Google Drive. Try again in a moment.')
    setBusy(true)
    setNote('')
    try {
      await shareTrip(ctx, file.id, who, `${from} invited you to plan "${title}" together. Open it in Travel Hub: ${sharedLink(file.id)}`)
      let access = ' They need to be on the apps’ user list to open it; ask an admin to add them.'
      if (addUser) {
        try {
          await addUser(who)
          access = ' They can sign in to the apps now.'
        } catch {
          access = ' Add them to the user list on the Admin page so they can sign in.'
        }
      }
      setEmail('')
      setNote(`Invited ${who}. Google emailed them a link to the trip.${access}`)
      setPeople(await listPeople(ctx, file.id))
    } catch (e) {
      setNote(e instanceof Error ? e.message : 'Could not share the trip.')
    } finally {
      setBusy(false)
    }
  }

  const remove = async (p: Person) => {
    if (!file || !confirm(`Stop sharing "${title}" with ${p.email}?`)) return
    try {
      await unshare(ctx, file.id, p.id)
      setPeople((all) => all.filter((x) => x.id !== p.id))
    } catch (e) {
      setNote(e instanceof Error ? e.message : 'Could not remove them.')
    }
  }

  return (
    <section className="card share" aria-labelledby="sec-share">
      <h2 id="sec-share">Plan it together</h2>
      {people.length > 0 && (
        <ul className="people" aria-label="People on this trip">
          {people.map((p) => (
            <li key={p.id}>
              <span className="who" title={p.email}>{p.name ?? p.email}</span>
              {p.role === 'owner' ? (
                <span className="chip">owner</span>
              ) : file?.mine ? (
                <button type="button" className="btn small" aria-label={`Remove ${p.email}`} onClick={() => void remove(p)}>Remove</button>
              ) : null}
            </li>
          ))}
        </ul>
      )}
      {file?.mine !== false && (
        <form className="invite" onSubmit={invite} aria-label="Invite a friend" noValidate>
          <input type="email" inputMode="email" autoComplete="email" placeholder="Friend's email" aria-label="Friend's email" value={email} onChange={(e) => setEmail(e.target.value)} />
          <button type="submit" className="btn" disabled={busy || file === undefined}>{busy ? 'Inviting…' : 'Invite'}</button>
        </form>
      )}
      {file?.mine === false && <p className="hint">A friend shared this trip with you. Your changes reach them too.</p>}
      {note ? <p className="hint" role="status">{note}</p> : file?.mine !== false && <p className="hint">They can see and edit this trip: flights, stays and days.</p>}
    </section>
  )
}
