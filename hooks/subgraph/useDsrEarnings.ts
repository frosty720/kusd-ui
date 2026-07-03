'use client'

import { useSubgraphQuery } from './useSubgraphQuery'

export interface SgDsrPosition {
  id: string
  owner: string
  pie: string
  principal: string // net KUSD deposited (WAD) = joins - exits
  chiAtLastAction: string
  updatedAt: string
}

const QUERY = `query Dsr($owner: ID!) {
  dsrPosition(id: $owner) {
    id
    owner
    pie
    principal
    chiAtLastAction
    updatedAt
  }
}`

/**
 * DSR position for an owner (the user's DSProxy, lowercased). The subgraph's
 * `principal` (net KUSD deposited) can't be derived from on-chain reads, so it's
 * what unlocks the "earnings" figure: earnings = currentBalance − principal,
 * where currentBalance = pie × current chi / RAY (read live on-chain).
 */
export function useDsrEarnings(owner: string | undefined) {
  return useSubgraphQuery<{ dsrPosition: SgDsrPosition | null }>(
    'dsr-position',
    QUERY,
    owner ? { owner: owner.toLowerCase() } : undefined,
    { enabled: !!owner, refetchInterval: 30000 },
  )
}
