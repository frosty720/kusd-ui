/**
 * Block-explorer link helpers (network-aware).
 *
 * The correct KalyScan host depends on the connected chain — 3890 and 3888 use
 * kalyscan.io, testnet uses testnet.kalyscan.io — so links are derived from the
 * chain config rather than hardcoded.
 */

import { kalyChainKmt, kalyChainMainnet, kalyChainTestnet } from '@/config/networks'

function explorerBase(chainId: number | undefined): string {
  const net = [kalyChainKmt, kalyChainMainnet].find((n) => n.id === chainId) ?? kalyChainTestnet
  return net.blockExplorers.default.url
}

/** KalyScan transaction URL for the given chain. */
export function getExplorerTxUrl(chainId: number | undefined, hash: string): string {
  return `${explorerBase(chainId)}/tx/${hash}`
}

/** KalyScan address URL for the given chain. */
export function getExplorerAddressUrl(chainId: number | undefined, address: string): string {
  return `${explorerBase(chainId)}/address/${address}`
}
