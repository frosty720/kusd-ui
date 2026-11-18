/**
 * The mobile-money cash-out client. The browser only ever talks to our /api/ramp/* routes (the keeper
 * key stays server-side), a USD amount can carry at most 6 decimals (it becomes USDT), and the
 * keeper's error key travels with the error so the cash-out can word "paused" as a cash-out.
 */
import { keccak256, toBytes } from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  cashoutDeadline,
  cashoutSignatureStale,
  cashoutTypedData,
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
      signature: '0xsig',
      deadline: '1767225600',
    }
    const w = await createRampWithdrawal(input)
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(url).toBe('/api/ramp/withdrawals')
    expect(init.method).toBe('POST')
    expect(JSON.parse(String(init.body))).toEqual(input)
    expect(JSON.parse(String(init.body)).deadline).toBe('1767225600')
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

describe('cash-out signature', () => {
  // The keeper's v2 test vector (fiat-bridge-keeper test/cashoutSignature.test.ts): same throwaway key, request,
  // deadline and signature. A change to the signed format on either side breaks one of the two tests.
  it('signs the exact format the keeper checks (version 2, with the deadline)', async () => {
    const account = privateKeyToAccount(keccak256(toBytes('kusd cash-out test wallet')))
    expect(account.address).toBe('0xA91aA6FEaBB547E39B161a2369c98Bf62d8eCadB')
    const request = {
      idempotencyKey: 'wd-key-1',
      userWallet: account.address,
      usdAmount: '25',
      channelId: 'wd1',
      country: 'CI',
      currency: 'XOF',
      networkId: 'mtn',
      momoNumber: '+2250701234567',
      accountName: 'Ada',
      deadline: '1767225600',
    }
    expect(await account.signTypedData(cashoutTypedData(request))).toBe(
      '0x1edfc7c84990ce51c85cfd9f5e16d70feab09ea7f126d96bb28cbcefdcd33c911262a44060f89ed7cfd9586d62c3d8b1c0477c51b0ce5fda4d574794473ee4071b',
    )
  })

  it('is domain version 2 with the deadline signed last, as a uint256', () => {
    const typed = cashoutTypedData({
      idempotencyKey: 'k',
      userWallet: '0xA91aA6FEaBB547E39B161a2369c98Bf62d8eCadB',
      usdAmount: '1',
      channelId: 'c',
      country: 'CI',
      currency: 'XOF',
      networkId: 'n',
      momoNumber: '+2250701234567',
      accountName: 'A',
      deadline: '1767225600',
    })
    expect(typed.domain).toEqual({ name: 'KUSD Cash-out', version: '2' })
    expect(typed.types.CashOut.at(-1)).toEqual({ name: 'deadline', type: 'uint256' })
    expect(typed.message.deadline).toBe(1767225600n)
  })

  it('asks for a deadline 10 minutes out, and a fresh signature only after deadline - 60 s', () => {
    expect(cashoutDeadline(1_767_225_000_000)).toBe('1767225600')
    expect(cashoutSignatureStale('1767225600', (1_767_225_600 - 60) * 1000)).toBe(false)
    expect(cashoutSignatureStale('1767225600', (1_767_225_600 - 60) * 1000 + 1000)).toBe(true)
  })

  it('signs only what the keeper checks: the KYC sender is not part of it', () => {
    const request = {
      idempotencyKey: 'k',
      userWallet: '0xA91aA6FEaBB547E39B161a2369c98Bf62d8eCadB',
      usdAmount: '1',
      channelId: 'c',
      country: 'CI',
      currency: 'XOF',
      networkId: 'n',
      momoNumber: '+2250701234567',
      accountName: 'A',
      deadline: '1767225600',
      sender: { name: 'A', country: 'CI' },
    }
    expect(Object.keys(cashoutTypedData(request).message)).toEqual([
      'userWallet',
      'usdAmount',
      'country',
      'currency',
      'channelId',
      'networkId',
      'momoNumber',
      'accountName',
      'idempotencyKey',
      'deadline',
    ])
  })
})

// Amendment 2026-11-18: the deadline and the retry check run on the server's clock, read from the Date header of
// our own ramp responses. A PC clock 48–68 min slow (seen on the boss's PC) must not make the signature expire.
describe('cash-out deadline on the server clock', () => {
  const SERVER = 1_767_225_000_000 // ms, a whole second
  /** A ramp response from our proxy whose Date header is `date` (none when null). */
  const stubServerDate = (date: string | null) =>
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(JSON.stringify({ usd: '25' }), { status: 200, headers: date ? { date } : {} })),
    )
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it.each([
    ['60 min slow', -60 * 60_000],
    ['10 min fast', 10 * 60_000],
  ])('signs serverNow + 600 when the PC clock is %s, inside the keeper window', async (_label, skew) => {
    vi.spyOn(Date, 'now').mockReturnValue(SERVER + skew)
    stubServerDate(new Date(SERVER).toUTCString())
    await fetchRampWithdrawQuote('CI', 'XOF', '25')
    const deadline = Number(cashoutDeadline())
    expect(deadline).toBe(SERVER / 1000 + 600)
    // The keeper's rule: nowSeconds <= deadline <= nowSeconds + 900, on its NTP clock (= SERVER).
    expect(deadline >= SERVER / 1000 && deadline <= SERVER / 1000 + 900).toBe(true)
  })

  it('measures the retry rule (deadline - 60) in serverNow, not on the PC clock', async () => {
    const deadline = String(SERVER / 1000 + 600) // signed at serverNow = SERVER
    const clock = vi.spyOn(Date, 'now')
    // PC 60 min slow: at serverNow = deadline - 59 the kept signature is about to expire, so sign again.
    clock.mockReturnValue(SERVER - 60 * 60_000)
    stubServerDate(new Date(SERVER).toUTCString())
    await fetchRampWithdrawQuote('CI', 'XOF', '25')
    clock.mockReturnValue(SERVER - 60 * 60_000 + 541_000)
    expect(cashoutSignatureStale(deadline)).toBe(true)
    // PC 10 min fast: at serverNow = SERVER + 300 the signature is still good, so no second wallet prompt.
    clock.mockReturnValue(SERVER + 10 * 60_000)
    await fetchRampWithdrawQuote('CI', 'XOF', '25')
    clock.mockReturnValue(SERVER + 10 * 60_000 + 300_000)
    expect(cashoutSignatureStale(deadline)).toBe(false)
  })

  it('refreshes the offset on every ramp call, and falls back to offset 0 with a log when the Date header is missing', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    vi.spyOn(Date, 'now').mockReturnValue(SERVER - 60 * 60_000)
    stubServerDate(new Date(SERVER).toUTCString())
    await fetchRampWithdrawQuote('CI', 'XOF', '25')
    expect(cashoutDeadline()).toBe(String(SERVER / 1000 + 600))
    stubServerDate(null)
    await fetchRampWithdrawQuote('CI', 'XOF', '25')
    expect(cashoutDeadline()).toBe(String((SERVER - 60 * 60_000) / 1000 + 600))
    expect(warn).toHaveBeenCalled()
    warn.mockClear()
    stubServerDate('not a date')
    await fetchRampWithdrawQuote('CI', 'XOF', '25')
    expect(cashoutDeadline()).toBe(String((SERVER - 60 * 60_000) / 1000 + 600))
    expect(warn).toHaveBeenCalled()
  })
})
