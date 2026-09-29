/**
 * The /api/ramp/* proxy's keeper call: the key stays server-side, and a keeper that does not
 * answer is reported as 504 keeper_unreachable — an UNKNOWN outcome the browser retries with the
 * same idempotency key, so a lost response can never open a second Yellow Card payment.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const KEY = 'test-keeper-key'
const fetchMock = vi.fn(async (_url: string, _init?: RequestInit) => new Response(JSON.stringify({ ok: true }), { status: 200 }))

async function load(env: Record<string, string | undefined>) {
  vi.resetModules()
  for (const [k, v] of Object.entries(env)) {
    if (v === undefined) vi.stubEnv(k, '')
    else vi.stubEnv(k, v)
  }
  return import('../ramp-server')
}

beforeEach(() => {
  fetchMock.mockClear()
  vi.stubGlobal('fetch', fetchMock)
})
afterEach(() => {
  vi.unstubAllGlobals()
  vi.unstubAllEnvs()
})

describe('keeperFetch', () => {
  it('attaches the bearer key and forwards status and body', async () => {
    const { keeperFetch } = await load({ RAMP_KEEPER_API_KEY: KEY, RAMP_KEEPER_URL: 'https://keeper.test' })
    const r = await keeperFetch('/api/channels')
    expect(r).toEqual({ status: 200, body: { ok: true } })
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(url).toBe('https://keeper.test/api/channels')
    expect((init.headers as Record<string, string>).authorization).toBe(`Bearer ${KEY}`)
  })

  it('sends a JSON body on POST', async () => {
    const { keeperFetch } = await load({ RAMP_KEEPER_API_KEY: KEY, RAMP_KEEPER_URL: 'https://keeper.test' })
    await keeperFetch('/api/deposits', { method: 'POST', body: { a: 1 } })
    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(init.method).toBe('POST')
    expect(init.body).toBe('{"a":1}')
    expect((init.headers as Record<string, string>)['content-type']).toBe('application/json')
  })

  it('answers 503 without calling out when no key is configured', async () => {
    const { keeperFetch } = await load({ RAMP_KEEPER_API_KEY: undefined })
    expect(await keeperFetch('/api/channels')).toEqual({ status: 503, body: { error: 'ramp not configured' } })
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('reports an unreachable keeper as 504 keeper_unreachable', async () => {
    const { keeperFetch, KEEPER_UNREACHABLE } = await load({ RAMP_KEEPER_API_KEY: KEY })
    fetchMock.mockRejectedValueOnce(new TypeError('fetch failed'))
    expect(await keeperFetch('/api/deposits', { method: 'POST', body: {} })).toEqual({ status: 504, body: { error: KEEPER_UNREACHABLE } })
    expect(KEEPER_UNREACHABLE).toBe('keeper_unreachable')
  })

  it('maps a non-JSON keeper reply to a JSON error', async () => {
    const { keeperFetch } = await load({ RAMP_KEEPER_API_KEY: KEY })
    fetchMock.mockResolvedValueOnce(new Response('<html>bad gateway</html>', { status: 502 }))
    expect(await keeperFetch('/api/channels')).toEqual({ status: 502, body: { error: 'bad keeper response' } })
  })
})
