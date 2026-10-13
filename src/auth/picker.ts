/**
 * Google Picker, pre-selected to one file. With the drive.file scope the hub sees only the files it made,
 * so a trip a friend shared stays hidden until you pick it once here; from then on it syncs like your own.
 * Same approach as MyMaps AI (src/google/auth.ts there).
 */

interface PickerApi {
  ViewId: { DOCS: string }
  Action: { PICKED: string; CANCEL: string }
  DocsView: new (id: string) => { setMimeTypes(m: string): PickerView; setFileIds(id: string): PickerView }
  PickerBuilder: new () => PickerBuilder
}
interface PickerView {
  setMimeTypes(m: string): PickerView
  setFileIds(id: string): PickerView
}
interface PickerBuilder {
  addView(v: PickerView): PickerBuilder
  setOAuthToken(t: string): PickerBuilder
  setDeveloperKey(k: string): PickerBuilder
  setAppId(id: string): PickerBuilder
  setCallback(cb: (data: { action: string; docs?: { id: string }[] }) => void): PickerBuilder
  build(): { setVisible(v: boolean): void }
}
declare global {
  interface Window {
    gapi?: { load: (name: string, cb: () => void) => void }
  }
}

function loadScript(src: string): Promise<void> {
  return new Promise((resolve, reject) => {
    if (document.querySelector(`script[src="${src}"]`)) return resolve()
    const s = document.createElement('script')
    s.src = src
    s.async = true
    s.onload = () => resolve()
    s.onerror = () => reject(new Error('Could not load Google Drive. Check your connection.'))
    document.head.appendChild(s)
  })
}

/** Opens the Picker on `fileId`. Resolves to the picked file id, or null when the window is closed. */
export async function pickFile(fileId: string, token: string, apiKey: string, clientId: string): Promise<string | null> {
  await loadScript('https://apis.google.com/js/api.js')
  await new Promise<void>((r) => window.gapi!.load('picker', r))
  const gp = (window.google as unknown as { picker: PickerApi }).picker
  return new Promise((resolve) => {
    const view = new gp.DocsView(gp.ViewId.DOCS).setMimeTypes('application/json').setFileIds(fileId)
    new gp.PickerBuilder()
      .addView(view)
      .setOAuthToken(token)
      .setDeveloperKey(apiKey)
      .setAppId(clientId.split('-')[0]!)
      .setCallback((data) => {
        if (data.action === gp.Action.PICKED) resolve(data.docs?.[0]?.id ?? null)
        else if (data.action === gp.Action.CANCEL) resolve(null)
      })
      .build()
      .setVisible(true)
  })
}
