/**
 * KUSD subgraph client.
 *
 * Subgraphs exist for the relaunched KalyChain (3890, `kusd-subgraph-kmt`) and the legacy
 * mainnet (3888). There is no testnet graph node, so on 3889 (or any other chain) the helpers
 * return null and callers fall back to their existing on-chain reads.
 * NEXT_PUBLIC_KUSD_SUBGRAPH_URL overrides the URL for the app's own chain.
 */

import { APP_CHAIN_ID, kalyChainKmt, kalyChainMainnet } from '@/config/networks'

const DEFAULT_SUBGRAPH_URLS: Record<number, string> = {
  [kalyChainKmt.id]: 'https://app.kalyswap.io/subgraphs/name/kusd-subgraph-kmt',
  [kalyChainMainnet.id]: 'https://app.kalyswap.io/subgraphs/name/kusd-subgraph-kalychain-mainnet',
}

const SUBGRAPH_URLS: Record<number, string> = {
  ...DEFAULT_SUBGRAPH_URLS,
  ...(process.env.NEXT_PUBLIC_KUSD_SUBGRAPH_URL && DEFAULT_SUBGRAPH_URLS[APP_CHAIN_ID] ? { [APP_CHAIN_ID]: process.env.NEXT_PUBLIC_KUSD_SUBGRAPH_URL } : {}),
}

export function subgraphUrlFor(chainId: number | undefined): string | null {
  if (chainId === undefined) return null
  return SUBGRAPH_URLS[chainId] || null
}

export function isSubgraphChain(chainId: number | undefined): boolean {
  return chainId !== undefined && SUBGRAPH_URLS[chainId] !== undefined
}

export async function querySubgraph<T>(chainId: number | undefined, query: string, variables?: Record<string, unknown>): Promise<T | null> {
  const url = subgraphUrlFor(chainId)
  if (!url) return null

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ query, variables: variables || {} }),
  })
  if (!res.ok) throw new Error(`Subgraph HTTP ${res.status}`)
  const json = (await res.json()) as { data?: T; errors?: { message: string }[] }
  if (json.errors && json.errors.length > 0) {
    throw new Error(json.errors[0].message || 'Subgraph query error')
  }
  return json.data ?? null
}
