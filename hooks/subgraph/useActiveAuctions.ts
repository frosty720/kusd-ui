'use client'

import { useSubgraphQuery } from './useSubgraphQuery'

export interface SgClipAuction {
  id: string
  auctionId: string
  clip: string
  ilk: { id: string; name: string } | null
  user: string
  keeper: string
  top: string
  tab: string
  lot: string
  lotRemaining: string
  tabRemaining: string
  active: boolean
  startedAt: string
}

export interface SgSurplusAuction {
  id: string
  auctionId: string
  lot: string
  bid: string
  active: boolean
  startedAt: string
}

export interface SgDebtAuction {
  id: string
  auctionId: string
  bid: string
  lot: string
  active: boolean
  startedAt: string
}

export interface ActiveAuctions {
  clipAuctions: SgClipAuction[]
  surplusAuctions: SgSurplusAuction[]
  debtAuctions: SgDebtAuction[]
}

const QUERY = `{
  clipAuctions(where: { active: true }, orderBy: startedAt, orderDirection: desc, first: 50) {
    id
    auctionId
    clip
    ilk { id name }
    user
    keeper
    top
    tab
    lot
    lotRemaining
    tabRemaining
    active
    startedAt
  }
  surplusAuctions(where: { active: true }, orderBy: startedAt, orderDirection: desc, first: 50) {
    id
    auctionId
    lot
    bid
    active
    startedAt
  }
  debtAuctions(where: { active: true }, orderBy: startedAt, orderDirection: desc, first: 50) {
    id
    auctionId
    bid
    lot
    active
    startedAt
  }
}`

export function useActiveAuctions() {
  return useSubgraphQuery<ActiveAuctions>('active-auctions', QUERY, undefined, {
    refetchInterval: 15000,
  })
}
