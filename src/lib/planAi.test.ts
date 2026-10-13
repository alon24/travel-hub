import { afterEach, describe, expect, it, vi } from 'vitest'
import { draftTrip, planSystem, readPlanReply } from './planAi.ts'

const today = '2026-10-11'
afterEach(() => vi.unstubAllGlobals())

describe('readPlanReply', () => {
  it('turns the JSON into a draft with our airport codes, in travel order', () => {
    const d = readPlanReply('{"title":"Portugal with the guys","from":"TLV","to":["Lisbon","OPO","lis"],"start":"2026-11-18","nights":3,"adults":3}', today)
    expect(d).toEqual({ title: 'Portugal with the guys', home: 'TLV', places: ['LIS', 'OPO'], start: '2026-11-18', nights: 3, adults: 3, unknown: [], split: undefined })
  })

  it('reads JSON wrapped in a code fence or a sentence', () => {
    expect(readPlanReply('Sure!\n```json\n{"to":["LIS"]}\n```', today).places).toEqual(['LIS'])
  })

  it('keeps cities it does not know aside instead of dropping them', () => {
    expect(readPlanReply('{"to":["LIS","Atlantis"]}', today)).toMatchObject({ places: ['LIS'], unknown: ['Atlantis'] })
  })

  it('ignores bad values but keeps the good ones', () => {
    const d = readPlanReply('{"to":["LIS"],"start":"2026-10-01","nights":99,"adults":"three","from":"Nowhere"}', today)
    expect(d).toEqual({ title: undefined, home: undefined, places: ['LIS'], start: undefined, nights: undefined, adults: undefined, unknown: [], split: undefined })
  })

  it('takes nights per city ("3 in Lisbon, 4 in Porto") and adds them up', () => {
    expect(readPlanReply('{"to":["LIS","OPO"],"nights":3,"split":[3,4]}', today)).toMatchObject({ places: ['LIS', 'OPO'], nights: 7, split: [3, 4] })
  })

  it('drops a per-city split that does not line up with the cities', () => {
    expect(readPlanReply('{"to":["LIS","OPO"],"nights":5,"split":[3]}', today)).toMatchObject({ nights: 5, split: undefined })
    expect(readPlanReply('{"to":["LIS","Atlantis"],"split":[3,4]}', today)).toMatchObject({ split: undefined })
  })

  it('tells the AI how to read nights per city and a range of nights', () => {
    expect(planSystem(today)).toMatch(/"split"\?:int\[\]/)
    expect(planSystem(today)).toContain('3-4 nights')
  })

  it('says so when there is no plan at all', () => {
    expect(() => readPlanReply('I cannot help with that.', today)).toThrow(/didn't return a plan/)
  })
})

describe('draftTrip', () => {
  it('asks the Worker with a short prompt that knows today and our cities', async () => {
    const fetch = vi.fn().mockResolvedValue(new Response(JSON.stringify({ choices: [{ message: { content: '{"to":["LIS"],"nights":3}' } }] })))
    vi.stubGlobal('fetch', fetch)
    const d = await draftTrip('3 nights in Lisbon', today, { googleToken: 'g' }, { VITE_WORKER_URL: 'https://w.example.dev' })
    expect(d).toMatchObject({ places: ['LIS'], nights: 3 })
    const body = JSON.parse(fetch.mock.calls[0][1].body)
    expect(body.system).toBe(planSystem(today))
    expect(body.system).toContain('Today is 2026-10-11')
    expect(body.system).toContain('LIS Lisbon')
    expect(body.system.length).toBeLessThan(2500)
    expect(body.messages).toEqual([{ role: 'user', content: '3 nights in Lisbon' }])
  })
})
