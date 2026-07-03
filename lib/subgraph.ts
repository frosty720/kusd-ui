/**
 * KUSD subgraph client (mainnet only).
 *
 * The subgraph indexes KalyChain MAINNET (chainId 3888) — there is no testnet
 * graph node — so every query is gated on the connected chain. On testnet (or
 * any other chain) the helpers return null and callers fall back to their
 * existing on-chain reads.
 */

import { kalyChainMainnet } from '@/config/networks'

const SUBGRAPH_URLS: Record<number, string> = {
  [kalyChainMainnet.id]:
    process.env.NEXT_PUBLIC_KUSD_SUBGRAPH_URL ||
    'https://app.kalyswap.io/subgraphs/name/kusd-subgraph-kalychain-mainnet',
}

export function subgraphUrlFor(chainId: number | undefined): string | null {
  if (chainId === undefined) return null
  return SUBGRAPH_URLS[chainId] || null
}

export function isSubgraphChain(chainId: number | undefined): boolean {
  return chainId !== undefined && SUBGRAPH_URLS[chainId] !== undefined
}

export async function querySubgraph<T>(
  chainId: number | undefined,
  query: string,
  variables?: Record<string, unknown>,
): Promise<T | null> {
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
