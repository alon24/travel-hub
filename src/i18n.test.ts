import { describe, expect, it } from 'vitest'
// @ts-expect-error plain script shared with the CLI
import { sourceKeys } from '../scripts/i18n-keys.mjs'
import { HE } from './i18n/he.ts'

describe('Hebrew UI', () => {
  it('has a translation for every text passed to t()', () => {
    const missing = (sourceKeys('src') as string[]).filter((k) => !HE[k])
    expect(missing).toEqual([])
  })
})
