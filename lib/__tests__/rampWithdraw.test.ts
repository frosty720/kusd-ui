/**
 * The mobile-money cash-out client. The browser only ever talks to our /api/ramp/* routes (the keeper
 * key stays server-side), a USD amount can carry at most 6 decimals (it becomes USDT), and the
 * keeper's error key travels with the error so the cash-out can word "paused" as a cash-out.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  createRampWithdrawal,
  fetchRampWithdrawal,
  fetchRampWithdrawChannels,
  fetchRampWithdrawQuote,
  isRampWithdrawalId,
  isTerminalWithdrawalState,
  isValidUsdAmount,
  RampApiError,
} from '../ramp'

function stubFetch(body: unknown, status = 200) {
  const fetchMock = vi.fn(async (_input: string | URL | Request, _init?: RequestInit) => new Response(JSON.stringify(body), { status }))
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('isValidUsdAmount', () => {
  it('accepts positive amounts with up to 6 decimals', () => {
    for (const v of ['5', '5.5', '0.000001', ' 12.123456 ']) expect(isValidUsdAmount(v), v).toBe(true)
  })
  it('rejects zero, signs, exponents and a 7th decimal', () => {
    for (const v of ['', '0', '0.000000', '-1', '1e3', '1.1234567', 'abc']) expect(isValidUsdAmount(v), v).toBe(false)
  })
})

describe('isRampWithdrawalId', () => {
  it("accepts the keeper's UUIDs and rejects anything that could reshape a path", () => {
    expect(isRampWithdrawalId('88022489-2d28-5e7f-99ca-c4be30132d4e')).toBe(true)
    for (const v of ['', 'short', '../admin/pause', 'a/b-c-d-e-f', 'x'.repeat(65)]) expect(isRampWithdrawalId(v), v).toBe(false)
  })
})

describe('isTerminalWithdrawalState', () => {
  it("stops polling on the keeper's final states", () => {
    for (const s of ['paid', 'failed', 'expired', 'failed_create']) expect(isTerminalWithdrawalState(s), s).toBe(true)
  })
  it('keeps polling while the USDT travels, the payout runs, or a refund is on its way', () => {
    for (const s of ['created', 'awaiting_funds', 'bridging', 'delivered', 'paying', 'forwarding', 'forwarded', 'refunding']) {
      expect(isTerminalWithdrawalState(s), s).toBe(false)
    }
  })
})

describe('withdrawal client', () => {
  it("loads the payout corridors and the keeper's USD bounds", async () => {
    const fetchMock = stubFetch({ corridors: [{ channelId: 'c' }], minUsd: '5', maxUsd: '2000' })
    const res = await fetchRampWithdrawChannels()
    expect(String(fetchMock.mock.calls[0]?.[0])).toBe('/api/ramp/withdraw-channels')
    expect(res).toMatchObject({ corridors: [{ channelId: 'c' }], minUsd: '5', maxUsd: '2000' })
  })

  it('defaults the corridors to an empty list', async () => {
    stubFetch({})
    expect((await fetchRampWithdrawChannels()).corridors).toEqual([])
  })

  it('quotes a cash-out by country, currency and USD amount', async () => {
    const fetchMock = stubFetch({ usd: '6', receiveLocal: 3381.14, feeLocal: 62.68, rate: 573.97, currency: 'XOF' })
    const q = await fetchRampWithdrawQuote('CI', 'XOF', '6')
    expect(String(fetchMock.mock.calls[0]?.[0])).toBe('/api/ramp/withdraw-quote?country=CI&currency=XOF&usd=6')
    expect(q.receiveLocal).toBe(3381.14)
  })

  it('creates a cash-out with a JSON POST of exactly the input', async () => {
    const fetchMock = stubFetch({ withdrawalId: 'w-123456789', state: 'awaiting_funds' }, 201)
    const input = {
      idempotencyKey: 'ui-11111111-1-ab',
      userWallet: '0x1111111111111111111111111111111111111111',
      usdAmount: '6',
      channelId: 'c',
      country: 'CI',
      currency: 'XOF',
      networkId: 'n',
      momoNumber: '+2250700000000',
      accountName: 'Ada',
      sender: { name: 'Ada', country: 'CI' },
    }
    const w = await createRampWithdrawal(input)
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(url).toBe('/api/ramp/withdrawals')
    expect(init.method).toBe('POST')
    expect(JSON.parse(String(init.body))).toEqual(input)
    expect(w.state).toBe('awaiting_funds')
  })

  it('polls a cash-out by its encoded id', async () => {
    const fetchMock = stubFetch({ withdrawalId: 'a b', state: 'paid' })
    await fetchRampWithdrawal('a b')
    expect(String(fetchMock.mock.calls[0]?.[0])).toBe('/api/ramp/withdrawals/a%20b')
  })

  it("keeps the keeper's error key on the error, so 'paused' can be worded for cash-outs", async () => {
    stubFetch({ error: 'paused' }, 503)
    const err = (await fetchRampWithdrawChannels().catch((e) => e)) as RampApiError
    expect(err).toBeInstanceOf(RampApiError)
    expect(err.code).toBe('paused')
    expect(err.outcomeUnknown).toBe(false)
  })

  it("explains the keeper's daily cap and an unknown corridor", async () => {
    stubFetch({ error: 'daily_cap' }, 422)
    expect(((await fetchRampWithdrawQuote('CI', 'XOF', '6').catch((e) => e)) as Error).message).toBe(
      'Today’s limit has been reached. Please try again tomorrow.',
    )
    stubFetch({ error: 'unknown_corridor' }, 400)
    expect(((await fetchRampWithdrawQuote('CI', 'XOF', '6').catch((e) => e)) as Error).message).toBe(
      'This payout method is not available right now. Please pick another one.',
    )
  })

  it('has no error key when the server sent none', async () => {
    stubFetch({}, 500)
    const err = (await fetchRampWithdrawal('w-123456789').catch((e) => e)) as RampApiError
    expect(err.code).toBeNull()
    expect(err.message).toBe('request failed (500)')
  })
})
