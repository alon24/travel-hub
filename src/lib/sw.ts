/**
 * A new deploy takes over the installed app on its own, but an open tab or PWA keeps running the old
 * code until it reloads. So: look for a new version on start, hourly and when the app comes back
 * to the front, and reload once when a new one takes over (not on the very first install).
 */
export function keepFresh(sw: ServiceWorkerContainer | undefined = typeof navigator === 'undefined' ? undefined : navigator.serviceWorker): void {
  if (!sw) return
  const hadController = Boolean(sw.controller)
  let reloading = false
  sw.addEventListener('controllerchange', () => {
    if (!hadController || reloading) return
    reloading = true
    location.reload()
  })
  const check = () => void sw.getRegistration().then((r) => r?.update()).catch(() => undefined)
  check()
  setInterval(check, 60 * 60 * 1000)
  document.addEventListener('visibilitychange', () => document.visibilityState === 'visible' && check())
}
