import { type CashoutRoute, getContracts, getNetworkSettings } from './contracts'
import { APP_CHAIN_ID } from './networks'

export interface TradeToken {
  symbol: string
  address: `0x${string}`
  decimals: number
}

/**
 * Everything buying and selling KUSD touches: the USDT PSM (sellGem USDT → KUSD, buyGem KUSD → USDT,
 * both 1:1 less the live tin/tout), its pocket, the two tokens, and the mobile-money cash-out route.
 */
export interface KusdTrade {
  psm: `0x${string}`
  pocket: `0x${string}`
  kusd: TradeToken
  /** The PSM's stable: the network's peg stable (USDT on 3890). */
  gem: TradeToken
  cashout: CashoutRoute | null
}

/** The KUSD trading setup of a chain; null where there is no PSM to trade through. */
export function kusdTrade(chainId: number): KusdTrade | null {
  const settings = getNetworkSettings(chainId)
  if (!settings.psm) return null
  const contracts = getContracts(chainId)
  const gem = contracts.collateral[settings.pegStable]
  return {
    psm: settings.psm.address,
    pocket: settings.psm.pocket,
    kusd: { symbol: 'KUSD', address: contracts.core.kusd, decimals: 18 },
    gem: { symbol: gem.symbol, address: gem.token, decimals: gem.decimals },
    cashout: settings.cashout,
  }
}

/** This deployment's chain (NEXT_PUBLIC_NETWORK). */
export const KUSD_TRADE = kusdTrade(APP_CHAIN_ID)
