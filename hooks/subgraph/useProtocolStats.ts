'use client'

import { useSubgraphQuery } from './useSubgraphQuery'

export interface SgIlk {
  id: string
  name: string
  Art: string
  rate: string
  spot: string
  line: string
  dust: string
  duty: string
  mat: string
  lastPriceVal: string
  vaultCount: number
}

export interface ProtocolStats {
  systemState: {
    live: boolean
    totalDebt: string
    totalVice: string
    kusdSupply: string
    activeVaults: number
    activeClipAuctions: number
  } | null
  ilks: SgIlk[]
}

const QUERY = `{
  systemState(id: "current") {
    live
    totalDebt
    totalVice
    kusdSupply
    activeVaults
    activeClipAuctions
  }
  ilks(first: 20, orderBy: Art, orderDirection: desc) {
    id
    name
    Art
    rate
    spot
    line
    dust
    duty
    mat
    lastPriceVal
    vaultCount
  }
}`

export function useProtocolStats() {
  return useSubgraphQuery<ProtocolStats>('protocol-stats', QUERY, undefined, {
    refetchInterval: 30000,
  })
}
