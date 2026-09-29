'use client'

import { useQuery, type UseQueryResult } from '@tanstack/react-query'
import { querySubgraph, isSubgraphChain } from '@/lib/subgraph'
import { APP_CHAIN_ID } from '@/config/networks'

/**
 * Thin react-query wrapper around a subgraph query for the app's chain, gated to chains that
 * have a subgraph (3890 and the legacy 3888). On other chains it stays disabled and returns
 * undefined, so callers degrade to their on-chain reads.
 */
export function useSubgraphQuery<T>(
  key: string,
  query: string,
  variables?: Record<string, unknown>,
  opts?: { refetchInterval?: number; enabled?: boolean },
): UseQueryResult<T | null> & { isSubgraphAvailable: boolean } {
  // Always the app's chain (NEXT_PUBLIC_NETWORK), like every contract read — never the
  // wallet's, which may sit on another chain.
  const chainId = APP_CHAIN_ID
  const available = isSubgraphChain(chainId)

  const result = useQuery({
    queryKey: ['kusd-subgraph', key, chainId, variables ?? {}],
    queryFn: () => querySubgraph<T>(chainId, query, variables),
    enabled: available && (opts?.enabled ?? true),
    refetchInterval: opts?.refetchInterval ?? 15000,
    staleTime: 10000,
  })

  return Object.assign(result, { isSubgraphAvailable: available })
}
