'use client'

import { useQuery, type UseQueryResult } from '@tanstack/react-query'
import { useAccount } from 'wagmi'
import { querySubgraph, isSubgraphChain } from '@/lib/subgraph'
import { getCurrentNetwork } from '@/config/networks'

/**
 * Thin react-query wrapper around a subgraph query, gated to chains that have a
 * subgraph (mainnet). On other chains it stays disabled and returns undefined,
 * so callers degrade to their on-chain reads.
 */
export function useSubgraphQuery<T>(
  key: string,
  query: string,
  variables?: Record<string, unknown>,
  opts?: { refetchInterval?: number; enabled?: boolean },
): UseQueryResult<T | null> & { isSubgraphAvailable: boolean } {
  // Use the wallet's connected chain; when disconnected, fall back to the app's
  // configured network (NEXT_PUBLIC_NETWORK) rather than wagmi's default-chain.
  const { chainId: connectedChainId } = useAccount()
  const chainId = connectedChainId ?? getCurrentNetwork().id
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
