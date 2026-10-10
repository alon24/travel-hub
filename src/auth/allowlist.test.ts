import { describe, expect, it } from 'vitest'
import { isAllowed, parseAllowlist, sha256Hex } from './allowlist.ts'

describe('allowlist', () => {
  it('hashes like the Worker (sha256 hex of the text)', async () => {
    expect(await sha256Hex('abc')).toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad')
  })

  it('parses a comma-separated list, lowercased', () => {
    expect(parseAllowlist(' A@x.com, ,sha256:ABC ')).toEqual(['a@x.com', 'sha256:abc'])
    expect(parseAllowlist('')).toEqual([])
  })

  it('lets anyone in when the list is empty', async () => {
    expect(await isAllowed('anyone@example.com', [])).toBe(true)
  })

  it('matches plain addresses, ignoring case and spaces', async () => {
    expect(await isAllowed(' Friend@Example.com', ['friend@example.com'])).toBe(true)
    expect(await isAllowed('stranger@example.com', ['friend@example.com'])).toBe(false)
  })

  it('matches hashed addresses', async () => {
    const list = [`sha256:${await sha256Hex('friend@example.com')}`]
    expect(await isAllowed('FRIEND@example.com', list)).toBe(true)
    expect(await isAllowed('stranger@example.com', list)).toBe(false)
  })

  it('never allows an empty address', async () => {
    expect(await isAllowed('', ['friend@example.com'])).toBe(false)
  })
})
