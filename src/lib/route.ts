import { useEffect, useState } from 'react'

/** Hash routes. Plain anchors like #apps are not routes: they stay on the landing page and scroll. */
export type Route = { name: 'home' } | { name: 'new' } | { name: 'trip'; id: string } | { name: 'handoff' }

export function parseRoute(hash: string): Route {
  if (hash === '#/new') return { name: 'new' }
  const trip = hash.match(/^#\/trip\/([\w-]+)$/)
  if (trip) return { name: 'trip', id: trip[1] }
  if (hash.startsWith('#/handoff/')) return { name: 'handoff' }
  return { name: 'home' }
}

export function useRoute(): Route {
  const [route, setRoute] = useState(() => parseRoute(window.location.hash))
  useEffect(() => {
    const on = () => {
      setRoute(parseRoute(window.location.hash))
      if (window.location.hash.startsWith('#/')) window.scrollTo(0, 0)
    }
    window.addEventListener('hashchange', on)
    return () => window.removeEventListener('hashchange', on)
  }, [])
  return route
}

export const go = (hash: string): void => {
  window.location.hash = hash
}
