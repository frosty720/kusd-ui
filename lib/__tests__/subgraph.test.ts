/**
 * Subgraph routing after the 3890 migration: the app chain (3890) queries kusd-subgraph-kmt, the
 * legacy mainnet keeps its subgraph, testnet has none, and NEXT_PUBLIC_KUSD_SUBGRAPH_URL only
 * overrides the app's own chain.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'

async function load(url?: string) {
  vi.resetModules()
  vi.stubEnv('NEXT_PUBLIC_KUSD_SUBGRAPH_URL', url ?? '')
  return import('../subgraph')
}

afterEach(() => {
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
})

describe('subgraph routing', () => {
  it('uses kusd-subgraph-kmt on 3890 and the legacy subgraph on 3888; none on testnet', async () => {
    const { subgraphUrlFor, isSubgraphChain } = await load()
    expect(subgraphUrlFor(3890)).toBe('https://app.kalyswap.io/subgraphs/name/kusd-subgraph-kmt')
    expect(subgraphUrlFor(3888)).toBe('https://app.kalyswap.io/subgraphs/name/kusd-subgraph-kalychain-mainnet')
    expect(subgraphUrlFor(3889)).toBeNull()
    expect(subgraphUrlFor(undefined)).toBeNull()
    expect(isSubgraphChain(3890)).toBe(true)
    expect(isSubgraphChain(3889)).toBe(false)
    expect(isSubgraphChain(undefined)).toBe(false)
  })

  it('lets NEXT_PUBLIC_KUSD_SUBGRAPH_URL override the app chain only', async () => {
    const { subgraphUrlFor } = await load('https://graph.example/kusd')
    expect(subgraphUrlFor(3890)).toBe('https://graph.example/kusd')
    expect(subgraphUrlFor(3888)).toBe('https://app.kalyswap.io/subgraphs/name/kusd-subgraph-kalychain-mainnet')
  })
})

describe('querySubgraph', () => {
  it('returns data, and null on a chain without a subgraph', async () => {
    const { querySubgraph } = await load()
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ data: { systemState: { live: true } } }), { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)
    expect(await querySubgraph(3890, '{ systemState { live } }')).toEqual({ systemState: { live: true } })
    expect(await querySubgraph(3889, '{ x }')).toBeNull()
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('throws on HTTP errors and on GraphQL errors; null data stays null', async () => {
    const { querySubgraph } = await load()
    vi.stubGlobal('fetch', vi.fn(async () => new Response('nope', { status: 500 })))
    await expect(querySubgraph(3890, '{ x }')).rejects.toThrow('Subgraph HTTP 500')
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ errors: [{ message: 'bad field' }] }), { status: 200 })))
    await expect(querySubgraph(3890, '{ x }')).rejects.toThrow('bad field')
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ errors: [{}] }), { status: 200 })))
    await expect(querySubgraph(3890, '{ x }')).rejects.toThrow('Subgraph query error')
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({}), { status: 200 })))
    expect(await querySubgraph(3890, '{ x }', { a: 1 })).toBeNull()
  })
})
