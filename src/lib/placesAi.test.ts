import { describe, expect, it } from 'vitest'
import { readPlaceIdeas } from './placesAi.ts'

describe('readPlaceIdeas', () => {
  it('reads fenced JSON, drops already-planned and duplicate places', () => {
    const reply = 'Here:\n```json\n{"places":[{"name":"Belém Tower","note":"Riverside fort"},{"name":"belém tower"},{"name":"Alfama"},{"name":""}]}\n```'
    expect(readPlaceIdeas(reply, ['alfama'])).toEqual([{ name: 'Belém Tower', note: 'Riverside fort' }])
  })

  it('throws when there is no JSON', () => {
    expect(() => readPlaceIdeas('sorry')).toThrow(/didn't return/)
  })
})
