import { t } from '../i18n.ts'
import { useEffect, useState } from 'react'
import { download, DriveError, type DriveCtx } from '../lib/tripDrive.ts'
import type { Trip } from '../model/types.ts'

interface Props {
  ctx: DriveCtx
  fileId: string
  /** Opens the Google Picker on the file and resolves to the picked id (null = closed); absent without an API key */
  pick?: (fileId: string) => Promise<string | null>
  onOpen: (trip: Trip) => void
}

/**
 * The link in a friend's invite: #/shared/<fileId>. The hub can read the file only after you pick it once
 * in Google's Picker (drive.file scope); then the trip is saved here and syncs like your own.
 */
export function SharedTrip({ ctx, fileId, pick, onOpen }: Props) {
  const [state, setState] = useState<'loading' | 'pick' | 'error'>('loading')
  const [message, setMessage] = useState('')

  const open = async () => {
    try {
      const trip = await download(ctx, fileId)
      if (!trip) {
        setState('error')
        return setMessage(t("That file isn't a Travel Hub trip."))
      }
      onOpen(trip)
    } catch (e) {
      if (e instanceof DriveError && (e.status === 404 || e.status === 403)) return setState('pick')
      setState('error')
      setMessage(e instanceof Error ? e.message : t("Couldn't open the trip."))
    }
  }
  useEffect(() => {
    void open()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fileId, ctx.token])

  const choose = async () => {
    if (!pick) return
    try {
      const id = await pick(fileId)
      if (id) {
        setState('loading')
        await open()
      }
    } catch (e) {
      setMessage(e instanceof Error ? e.message : t('Google Drive is not available right now.'))
    }
  }

  return (
    <section className="page shared">
      <div className="section-head">
        <span className="label">{t('Shared trip')}</span>
        <h2>{state === 'loading' ? t('Opening the trip…') : state === 'pick' ? t('A friend shared a trip with you') : t("Couldn't open the trip")}</h2>
      </div>
      {state === 'pick' &&
        (pick ? (
          <>
            <p>{t('Google asks you to confirm it once: pick the trip in the window that opens, and it joins your trips.')}</p>
            <button type="button" className="btn solid" onClick={() => void choose()}>{t('Open the shared trip')}</button>
          </>
        ) : (
          <p>{t("This hub can't open shared trips yet (its Google Picker key is not set up).")}</p>
        ))}
      {message && <p className="hint" role="alert">{message}</p>}
      <a className="btn" href="#/">{t('See your trips')}</a>
    </section>
  )
}
