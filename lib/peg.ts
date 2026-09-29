/**
 * KUSD peg helpers (pure). The market price comes from a V2 pair's reserves on the legacy
 * chains and from a KalySwap V3 pool's slot0 on 3890 — both reduce to "USD per KUSD", with
 * the pool's stable counted as $1.
 */

export type PegStatus = 'on-peg' | 'above-peg' | 'below-peg' | 'critical'

/** Classify a KUSD price: within 0.5% is on peg, within 2% is above/below, beyond that critical. */
export function pegStatus(price: number): PegStatus {
  const deviation = (price - 1) * 100
  if (Math.abs(deviation) < 0.5) return 'on-peg'
  if (Math.abs(deviation) < 2) return deviation > 0 ? 'above-peg' : 'below-peg'
  return 'critical'
}

/**
 * USD per KUSD from a KUSD/stable V3 pool's sqrtPriceX96. sqrtPriceX96²/2¹⁹² is raw token1 per
 * raw token0, so the token order decides which way to read it (on 3890 USDT 0x6318… sorts before
 * KUSD 0xFDb3…, so KUSD is token1).
 */
export function kusdPriceFromSqrt(
  sqrtPriceX96: bigint,
  kusdIsToken0: boolean,
  kusdDecimals = 18,
  stableDecimals = 6,
): number {
  const ratio = Number((sqrtPriceX96 * sqrtPriceX96 * 10n ** 36n) / 2n ** 192n) / 1e36
  if (ratio === 0) return 0
  return kusdIsToken0
    ? ratio * 10 ** (kusdDecimals - stableDecimals)
    : 1 / (ratio * 10 ** (stableDecimals - kusdDecimals))
}

export interface PegPool {
  pool: `0x${string}`
  liquidity: bigint
  sqrtPriceX96: bigint
  token0: `0x${string}`
}

/** The pool with the most active liquidity, or null when none has any. */
export function deepestPool(pools: PegPool[]): PegPool | null {
  let best: PegPool | null = null
  for (const p of pools) if (p.liquidity > 0n && (!best || p.liquidity > best.liquidity)) best = p
  return best
}
