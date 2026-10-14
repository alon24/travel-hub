import { useEffect, useState } from 'react'
import type { Guide } from './guides.ts'

/**
 * A step-by-step guide that points at the parts of the screen it explains.
 * Not modal: the page stays usable, so you can try each step as you read it.
 */
export function HelpGuide({ guide, onClose }: { guide: Guide; onClose: () => void }) {
  // Only the steps whose part of the screen is showing (e.g. no hotel step when every night is covered)
  const [steps] = useState(() => guide.steps.filter((s) => !s.target || document.querySelector(s.target)))
  const [at, setAt] = useState(0)
  const step = steps[at]
  const last = at === steps.length - 1

  useEffect(() => {
    const el = step?.target ? document.querySelector(step.target) : null
    if (!el) return
    el.classList.add('help-spot')
    el.scrollIntoView?.({ block: 'start', behavior: 'smooth' })
    return () => el.classList.remove('help-spot')
  }, [step])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  if (!step) return null
  return (
    <div className="help-guide" role="dialog" aria-modal="false" aria-labelledby="help-title" aria-describedby="help-text">
      <div className="help-top">
        <span className="label">{guide.title} · {at + 1}/{steps.length}</span>
        <button type="button" className="x" aria-label="Close help" onClick={onClose}>×</button>
      </div>
      <h3 id="help-title">{step.title}</h3>
      <p id="help-text">{step.text}</p>
      <div className="help-nav">
        <span className="help-dots" aria-hidden="true">
          {steps.map((s, i) => <i key={s.title} className={i === at ? 'on' : ''} />)}
        </span>
        {at > 0 && <button type="button" className="btn small" onClick={() => setAt(at - 1)}>Back</button>}
        <button type="button" className="btn small solid" autoFocus onClick={() => (last ? onClose() : setAt(at + 1))}>{last ? 'Got it' : 'Next'}</button>
      </div>
    </div>
  )
}
