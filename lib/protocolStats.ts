/**
 * Protocol-wide backing figures for the home page (pure). Everything comes from on-chain reads:
 *
 * - TVL = the PSM pocket's stable (at $1, the price the PSM itself swaps at) plus every vault
 *   collateral type's tokens held by its GemJoin, valued at the protocol's own price
 *   (Vat spot × Spotter mat, i.e. the oracle price before the liquidation ratio was applied).
 * - Circulating KUSD = Vat debt minus the KUSD the PSM holds itself: a lite PSM pre-mints its
 *   `buf` into its own balance, and that KUSD is not issued to anyone until someone sells gem.
 */

const RAY = 10n ** 27n
const RAD = 10n ** 45n
const WAD = 10n ** 18n

export interface VaultCollateral {
  /** Collateral tokens held by the ilk's GemJoin (token decimals). */
  balance: bigint
  decimals: number
  /** Vat.ilks(ilk).spot — price / par / mat, in RAY. 0 when no oracle has been poked. */
  spot: bigint
  /** Spotter.ilks(ilk).mat — liquidation ratio, in RAY. */
  mat: bigint
}

export interface ProtocolStatsInput {
  /** Vat.debt, in RAD. */
  vatDebt: bigint
  /** KUSD held by the PSM contract itself (WAD). */
  psmKusd: bigint
  /** The PSM gem (stable) held by the pocket, in gem decimals. */
  pocketGem: bigint
  gemDecimals: number
  vaults: readonly VaultCollateral[]
}

export interface ProtocolStats {
  tvlUsd: number
  circulatingKusd: number
  /** TVL as a % of circulating KUSD; null when nothing is circulating. */
  backingPct: number | null
  /** Some GemJoin holds collateral that has no price yet, so TVL leaves it out. */
  unpricedCollateral: boolean
}

function toWad(amount: bigint, decimals: number): bigint {
  return amount * 10n ** BigInt(18 - decimals)
}

/** USD value (WAD) of one collateral type's locked tokens: amount × spot × mat. */
export function collateralUsdWad(c: VaultCollateral): bigint {
  return (toWad(c.balance, c.decimals) * c.spot * c.mat) / RAY / RAY
}

function wadToNumber(wad: bigint): number {
  return Number(wad / 10n ** 12n) / 1e6
}

export function protocolStats(input: ProtocolStatsInput): ProtocolStats {
  const vaultUsd = input.vaults.reduce((sum, c) => sum + collateralUsdWad(c), 0n)
  const tvl = toWad(input.pocketGem, input.gemDecimals) + vaultUsd
  const supply = input.vatDebt / (RAD / WAD)
  const circulating = supply > input.psmKusd ? supply - input.psmKusd : 0n
  return {
    tvlUsd: wadToNumber(tvl),
    circulatingKusd: wadToNumber(circulating),
    backingPct: circulating > 0n ? Number((tvl * 10_000n) / circulating) / 100 : null,
    unpricedCollateral: input.vaults.some((c) => c.balance > 0n && c.spot === 0n),
  }
}

/** Card label for the backing %: at 100% every circulating KUSD is matched by collateral. */
export function backingLabel(pct: number | null): string {
  if (pct === null) return 'No KUSD issued'
  return pct >= 100 ? 'Fully backed' : 'Under-backed'
}
