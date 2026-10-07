/**
 * USDT lite-PSM math (KssLitePsm._sellGem / _buyGem). Each function mirrors the contract arithmetic,
 * so a quote shown is the amount the chain will actually move.
 */
import { parseAmount } from './amounts'
import { WAD } from './constants'

/** KssLitePsm.HALTED: a tin/tout of max uint256 disables that swap direction. */
export const PSM_HALTED = 2n ** 256n - 1n

/** sell = USDT → KUSD (sellGem), buy = KUSD → USDT (buyGem). */
export type PsmDirection = 'sell' | 'buy'

const KUSD_DECIMALS = 18

function toWad(amount: bigint, decimals: number): bigint {
  return amount * 10n ** BigInt(18 - decimals)
}

/** KUSD received for selling `gemAmt` gems: gemAmt·10^(18−dec) minus the tin fee. */
export function psmSellOut(gemAmt: bigint, gemDecimals: number, tin: bigint): bigint {
  const gross = toWad(gemAmt, gemDecimals)
  return gross - (tin > 0n ? (gross * tin) / WAD : 0n)
}

/** KUSD charged for buying `gemAmt` gems: gemAmt·10^(18−dec) plus the tout fee. */
export function psmBuyCost(gemAmt: bigint, gemDecimals: number, tout: bigint): bigint {
  const gross = toWad(gemAmt, gemDecimals)
  return gross + (tout > 0n ? (gross * tout) / WAD : 0n)
}

/**
 * The most gems `kusdIn` KUSD can buy through buyGem (whose argument is the gem amount).
 * Rounds down, then steps back while the exact cost still exceeds the KUSD offered.
 */
export function psmGemsForKusd(kusdIn: bigint, gemDecimals: number, tout: bigint): bigint {
  const unit = 10n ** BigInt(18 - gemDecimals)
  let gems = (kusdIn * WAD) / ((WAD + tout) * unit)
  while (gems > 0n && psmBuyCost(gems, gemDecimals, tout) > kusdIn) gems -= 1n
  return gems
}

export interface PsmQuote {
  /** The PSM call's argument (USDT amount) in both directions. */
  gemAmt: bigint
  /** What leaves the wallet: USDT when selling, the exact KUSD cost when buying. */
  pay: bigint
  /** What arrives: KUSD when selling, USDT when buying. */
  receive: bigint
}

/** Quote a PSM swap for `input` of the pay token (null when the amount is missing, zero or invalid). */
export function quotePsm(direction: PsmDirection, input: string, tin: bigint, tout: bigint, gemDecimals: number): PsmQuote | null {
  if (direction === 'sell') {
    const gemAmt = parseAmount(input, gemDecimals)
    if (!gemAmt) return null
    return { gemAmt, pay: gemAmt, receive: psmSellOut(gemAmt, gemDecimals, tin) }
  }
  const kusdIn = parseAmount(input, KUSD_DECIMALS)
  if (!kusdIn) return null
  const gemAmt = psmGemsForKusd(kusdIn, gemDecimals, tout)
  if (gemAmt === 0n) return null
  return { gemAmt, pay: psmBuyCost(gemAmt, gemDecimals, tout), receive: gemAmt }
}

/** A PSM fee (WAD fraction) as a percent label: "No fee" at zero, else up to 4 decimals ("0.1%"). */
export function psmFeeLabel(fee: bigint): string {
  if (fee === 0n) return 'No fee'
  const pct = Number((fee * 1_000_000n) / WAD) / 10_000
  return `${pct.toLocaleString('en-US', { maximumFractionDigits: 4 })}%`
}
