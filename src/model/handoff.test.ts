import { describe, expect, it } from 'vitest'
import fixture from '../test/fixtures/skyhop-handoff.json'
import { decodePayload, encodePayload, readHandoff } from './handoff.ts'

describe('handoff', () => {
  it('round-trips through base64url, Unicode included', () => {
    const value = { name: 'Zürich → Lisboa ✈', n: 1 }
    const text = encodePayload(value)
    expect(text).toMatch(/^[A-Za-z0-9_-]+$/)
    expect(decodePayload(text)).toEqual(value)
  })

  it("reads Skyhop's flights from a hub link (the shared contract fixture)", () => {
    const h = readHandoff(`#/handoff/${encodePayload(fixture)}`)!
    expect(h.adults).toBe(3)
    expect(h.legs.map((l) => `${l.origin}-${l.destination}`)).toEqual(['TLV-LIS', 'OPO-TLV'])
  })

  it('ignores hashes that are not handoffs', () => {
    expect(readHandoff('#/trip/abc')).toBeNull()
    expect(readHandoff('#apps')).toBeNull()
  })

  it('rejects damaged or invalid data with a readable message', () => {
    expect(() => readHandoff('#/handoff/not-json')).toThrow(/damaged/)
    const bad = { ...fixture, legs: [{ ...fixture.legs[0], origin: 'Tel Aviv' }] }
    expect(() => readHandoff(`#/handoff/${encodePayload(bad)}`)).toThrow(/doesn't understand/)
  })
})
