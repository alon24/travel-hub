import { afterEach, describe, expect, it, vi } from 'vitest'
import { draftTrip, monthWindow, nightsRange, planSystem, readPlanReply } from './planAi.ts'

const today = '2026-10-11'
afterEach(() => vi.unstubAllGlobals())

describe('readPlanReply', () => {
  it('turns the JSON into a draft with our airport codes, in travel order', () => {
    const d = readPlanReply('{"title":"Portugal with the guys","from":"TLV","to":["Lisbon","OPO","lis"],"start":"2026-11-18","nights":3,"adults":3}', today)
    expect(d).toEqual({ title: 'Portugal with the guys', home: 'TLV', places: ['LIS', 'OPO'], start: '2026-11-18', nights: 3, adults: 3, countries: [], unknown: [], split: undefined })
  })

  it('reads JSON wrapped in a code fence or a sentence', () => {
    expect(readPlanReply('Sure!\n```json\n{"to":["LIS"]}\n```', today).places).toEqual(['LIS'])
  })

  it('keeps cities it does not know aside instead of dropping them', () => {
    expect(readPlanReply('{"to":["LIS","Atlantis"]}', today)).toMatchObject({ places: ['LIS'], unknown: ['Atlantis'] })
  })

  it('ignores bad values but keeps the good ones', () => {
    const d = readPlanReply('{"to":["LIS"],"start":"2026-10-01","nights":99,"adults":"three","from":"Nowhere"}', today)
    expect(d).toEqual({ title: undefined, home: undefined, places: ['LIS'], start: undefined, nights: undefined, adults: undefined, countries: [], unknown: [], split: undefined })
  })

  it('takes nights per city ("3 in Lisbon, 4 in Porto") and adds them up', () => {
    expect(readPlanReply('{"to":["LIS","OPO"],"nights":3,"split":[3,4]}', today)).toMatchObject({ places: ['LIS', 'OPO'], nights: 7, split: [3, 4] })
  })

  it('drops a per-city split that does not line up with the cities', () => {
    expect(readPlanReply('{"to":["LIS","OPO"],"nights":5,"split":[3]}', today)).toMatchObject({ nights: 5, split: undefined })
    expect(readPlanReply('{"to":["LIS","Atlantis"],"split":[3,4]}', today)).toMatchObject({ split: undefined })
  })

  it('keeps a country asked for as a whole ("Portugal"), by code or name, only when the trip goes there', () => {
    expect(readPlanReply('{"to":["LIS","OPO"],"countries":["pt"]}', today).countries).toEqual(['PT'])
    expect(readPlanReply('{"to":["LIS","OPO"],"countries":["Portugal","PT"]}', today).countries).toEqual(['PT'])
    expect(readPlanReply('{"to":["LIS"],"countries":["ES","Narnia"]}', today).countries).toEqual([])
    expect(readPlanReply('{"to":["LIS"],"countries":"PT"}', today).countries).toEqual([])
  })

  it('"3 days in December" is any 2 nights in the whole of December, not a fixed date', () => {
    const d = readPlanReply('{"to":["LIS"],"days":3,"month":12}', today)
    expect(d).toMatchObject({ window: { from: '2026-12-01', to: '2026-12-31' }, nights: 2, start: '2026-12-01' })
  })

  it('an exact day stays exact; a past one falls back to the month', () => {
    const exact = readPlanReply('{"to":["LIS"],"nights":3,"month":12,"start":"2026-12-04"}', today)
    expect([exact.start, exact.window]).toEqual(['2026-12-04', undefined])
    expect(readPlanReply('{"to":["LIS"],"nights":3,"month":12,"start":"2026-10-01"}', today).window).toEqual({ from: '2026-12-01', to: '2026-12-31' })
  })

  it('takes a loose window ("next weekend") and stretches it when the trip does not fit', () => {
    expect(readPlanReply('{"to":["LIS"],"nights":2,"window":{"from":"2026-10-15","to":"2026-10-18"}}', today).window).toEqual({ from: '2026-10-15', to: '2026-10-18' })
    expect(readPlanReply('{"to":["LIS"],"nights":5,"window":{"from":"2026-10-15","to":"2026-10-18"}}', today).window).toEqual({ from: '2026-10-15', to: '2026-10-20' })
    // Already over, or back to front: no window at all
    expect(readPlanReply('{"to":["LIS"],"window":{"from":"2026-09-01","to":"2026-09-05"}}', today).window).toBeUndefined()
    expect(readPlanReply('{"to":["LIS"],"window":{"from":"2026-12-05","to":"2026-12-01"}}', today).window).toBeUndefined()
  })

  it('counts days as nights + 1, and nights win when both are given', () => {
    expect(readPlanReply('{"to":["LIS"],"days":5}', today).nights).toBe(4)
    expect(readPlanReply('{"to":["LIS"],"days":1}', today).nights).toBe(1)
    expect(readPlanReply('{"to":["LIS"],"days":5,"nights":3}', today).nights).toBe(3)
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

describe('a list or range of nights is "3 or 4", not one number per city', () => {
  it.each([
    ['3,4 nights in portugal next month 4 people', 3, 4],
    ['3-4 nights in Portugal', 3, 4],
    ['3 or 4 nights', 3, 4],
    ['4–3 days in Lisbon', 2, 3],
    ['3-4 לילות בליסבון', 3, 4],
    ['3 ,4 nights in portugal , next month', 3, 4],
    ['3, 4 nights', 3, 4],
    ['3 nights or 4 nights in Lisbon', 3, 4],
    ['3 and 4 nights', 3, 4],
    ['3 או 4 לילות', 3, 4],
  ])('%s', (text, min, max) => expect(nightsRange(text)).toEqual({ min, max }))

  it('not for nights per named city', () => {
    expect(nightsRange('3 nights in Lisbon, 4 nights in Porto')).toBeUndefined()
    expect(nightsRange('3 in Lisbon, 4 in Porto')).toBeUndefined()
  })

  it('wins over an AI that read "3,4 nights" as Lisbon 3 + Porto 4', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ choices: [{ message: { content: '{"to":["LIS","OPO"],"countries":["PT"],"split":[3,4],"month":11}' } }] }))))
    const d = await draftTrip('3,4 nights in portugal next month 4 people', today, { googleToken: 'g' }, { VITE_WORKER_URL: 'https://w.example.dev' })
    expect(d).toMatchObject({ places: ['LIS', 'OPO'], nights: 3, nightsMax: 4, split: undefined, window: { from: '2026-11-01', to: '2026-11-30' } })
  })
})

describe('children', () => {
  it('"4 people, 1 is a 16 yo child" arrives as 3 adults and a child of 16', () => {
    expect(readPlanReply('{"to":["LIS"],"adults":3,"childrenAges":[16]}', today)).toMatchObject({ adults: 3, childrenAges: [16] })
  })
})

describe('monthWindow', () => {
  it('is the whole month, this year or next', () => {
    expect(monthWindow(12, undefined, '2026-10-11')).toEqual({ from: '2026-12-01', to: '2026-12-31' })
    expect(monthWindow(2, undefined, '2026-10-11')).toEqual({ from: '2027-02-01', to: '2027-02-28' })
    expect(monthWindow(2, undefined, '2027-10-11')).toEqual({ from: '2028-02-01', to: '2028-02-29' })
  })

  it('splits a month into early, mid and late', () => {
    expect(monthWindow(11, 'early', '2026-10-11')).toEqual({ from: '2026-11-01', to: '2026-11-10' })
    expect(monthWindow(11, 'mid', '2026-10-11')).toEqual({ from: '2026-11-11', to: '2026-11-20' })
    expect(monthWindow(11, 'late', '2026-10-11')).toEqual({ from: '2026-11-21', to: '2026-11-30' })
  })

  it('starts tomorrow in the current month, and skips to next year once the part is over', () => {
    expect(monthWindow(12, undefined, '2026-12-10')).toEqual({ from: '2026-12-11', to: '2026-12-31' })
    expect(monthWindow(12, 'early', '2026-12-10')).toEqual({ from: '2027-12-01', to: '2027-12-10' })
  })
})
