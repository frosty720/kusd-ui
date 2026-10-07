/**
 * The cash-out routes hold the keeper API key: they must refuse obviously bad input before it reaches
 * the keeper, forward nothing the browser added, and report an unreachable keeper as an unknown
 * outcome (504 keeper_unreachable) so the browser keeps its idempotency key.
 */
import { NextRequest } from 'next/server'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const KEY = 'test-keeper-key-0123456789'
const KEEPER = 'https://keeper.test'
const WALLET = '0xfF409DBD66bD013385c41cb55D8cD90902BB4c80'

const keeper = vi.fn(async (_url: string, _init?: RequestInit) => new Response(JSON.stringify({ ok: true }), { status: 200 }))

/** lib/ramp-server.ts reads its env when first imported, so each test loads the routes fresh. */
async function routes() {
  vi.resetModules()
  vi.stubEnv('RAMP_KEEPER_API_KEY', KEY)
  vi.stubEnv('RAMP_KEEPER_URL', KEEPER)
  return {
    withdrawChannels: (await import('../withdraw-channels/route')).GET,
    withdrawQuote: (await import('../withdraw-quote/route')).GET,
    createWithdrawal: (await import('../withdrawals/route')).POST,
    getWithdrawal: (await import('../withdrawals/[id]/route')).GET,
  }
}

beforeEach(() => {
  keeper.mockClear()
  vi.stubGlobal('fetch', keeper)
})
afterEach(() => {
  vi.unstubAllGlobals()
  vi.unstubAllEnvs()
})

const req = (path: string, init?: { method?: string; body?: string }) => new NextRequest(`http://localhost${path}`, init)
const lastCall = () => keeper.mock.calls.at(-1) as [string, RequestInit]

describe('mobile-money cash-out routes', () => {
  it('forwards the payout corridors with the key attached server-side', async () => {
    const { withdrawChannels } = await routes()
    const res = await withdrawChannels()
    expect(lastCall()[0]).toBe(`${KEEPER}/api/withdraw-channels`)
    expect((lastCall()[1].headers as Record<string, string>).authorization).toBe(`Bearer ${KEY}`)
    expect(await res.json()).toEqual({ ok: true })
  })

  it('quotes only with country, currency and a ≤6-decimal USD amount, forwarding nothing else', async () => {
    const { withdrawQuote } = await routes()
    expect((await withdrawQuote(req('/api/ramp/withdraw-quote?country=CI&currency=XOF'))).status).toBe(400)
    expect((await withdrawQuote(req('/api/ramp/withdraw-quote?currency=XOF&usd=5'))).status).toBe(400)
    expect((await withdrawQuote(req('/api/ramp/withdraw-quote?country=CI&usd=5'))).status).toBe(400)
    expect((await withdrawQuote(req('/api/ramp/withdraw-quote?country=CI&currency=XOF&usd=1.1234567'))).status).toBe(400)
    expect(keeper).not.toHaveBeenCalled()
    await withdrawQuote(req('/api/ramp/withdraw-quote?country=CI&currency=XOF&usd=25&evil=1'))
    expect(lastCall()[0]).toBe(`${KEEPER}/api/withdraw-quote?country=CI&currency=XOF&usd=25`)
  })

  it('rejects malformed withdrawals before reaching the keeper', async () => {
    const { createWithdrawal } = await routes()
    const post = (body: string) => createWithdrawal(req('/api/ramp/withdrawals', { method: 'POST', body }))
    for (const body of [
      '{nope',
      'null',
      '[]',
      JSON.stringify({ userWallet: '0x123', usdAmount: '25' }),
      JSON.stringify({ userWallet: WALLET, usdAmount: '-1' }),
      JSON.stringify({ userWallet: WALLET, usdAmount: '1.1234567' }),
      JSON.stringify({ userWallet: WALLET }),
    ]) {
      expect((await post(body)).status, body).toBe(400)
    }
    expect(keeper).not.toHaveBeenCalled()
  })

  it('forwards a valid withdrawal unchanged as a POST, and an unreachable keeper as an unknown outcome', async () => {
    const { createWithdrawal } = await routes()
    const body = { idempotencyKey: 'ui-ff409dbd-1', userWallet: WALLET, usdAmount: '25', channelId: 'wd1' }
    await createWithdrawal(req('/api/ramp/withdrawals', { method: 'POST', body: JSON.stringify(body) }))
    const [url, init] = lastCall()
    expect(url).toBe(`${KEEPER}/api/withdrawals`)
    expect(init.method).toBe('POST')
    expect(JSON.parse(String(init.body))).toEqual(body)

    keeper.mockRejectedValueOnce(new TypeError('fetch failed'))
    const res = await createWithdrawal(req('/api/ramp/withdrawals', { method: 'POST', body: JSON.stringify(body) }))
    expect(res.status).toBe(504)
    expect(await res.json()).toEqual({ error: 'keeper_unreachable' })
  })

  it('checks the withdrawal id before forwarding a status poll', async () => {
    const { getWithdrawal } = await routes()
    const get = (id: string) => getWithdrawal(req(`/api/ramp/withdrawals/${id}`), { params: Promise.resolve({ id }) })
    for (const id of ['..%2Fadmin', 'short']) expect((await get(id)).status, id).toBe(400)
    expect(keeper).not.toHaveBeenCalled()
    await get('6f1c2d3e-4a5b-6c7d')
    expect(lastCall()[0]).toBe(`${KEEPER}/api/withdrawals/6f1c2d3e-4a5b-6c7d`)
  })
})
