/**
 * CDP and DeFi Calculations
 * 
 * Functions for calculating collateral ratios, liquidation prices,
 * available to mint, and other CDP-related values.
 */

import { wadMul, wadDiv, rayMul, min } from './math'
import { WAD, RAY } from './constants'

/**
 * Calculate collateral ratio
 * 
 * Formula: (collateral * price) / debt
 * 
 * @param collateral - Amount of collateral in WAD
 * @param price - Collateral price in WAD (USD per unit)
 * @param debt - Amount of debt in WAD
 * @returns Collateral ratio in WAD (e.g., 1.5 * WAD = 150%)
 */
export function calculateCollateralRatio(
  collateral: bigint,
  price: bigint,
  debt: bigint
): bigint {
  if (debt === 0n) {
    return 0n // No debt = infinite ratio, return 0 to indicate no position
  }
  
  const collateralValue = wadMul(collateral, price)
  return wadDiv(collateralValue, debt)
}

/**
 * Calculate liquidation price
 * 
 * Formula: (debt * liquidationRatio) / collateral
 * 
 * @param collateral - Amount of collateral in WAD
 * @param debt - Amount of debt in WAD
 * @param liquidationRatio - Liquidation ratio in WAD (e.g., 1.5 * WAD = 150%)
 * @returns Liquidation price in WAD
 */
export function calculateLiquidationPrice(
  collateral: bigint,
  debt: bigint,
  liquidationRatio: bigint
): bigint {
  if (collateral === 0n) {
    return 0n
  }
  
  const requiredValue = wadMul(debt, liquidationRatio)
  return wadDiv(requiredValue, collateral)
}

/**
 * Calculate maximum KUSD that can be minted
 *
 * Formula: (collateral * price) / liquidationRatio - currentDebt
 *
 * @param collateral - Amount of collateral in WAD
 * @param price - Collateral price in WAD
 * @param liquidationRatio - Liquidation ratio in WAD
 * @param currentDebt - Current debt in WAD
 * @param debtCeiling - Ilk debt ceiling in RAD
 * @param totalDebt - Total ilk debt in RAD
 * @returns Maximum KUSD that can be minted in WAD
 */
export function calculateMaxMint(
  collateral: bigint,
  price: bigint,
  liquidationRatio: bigint,
  currentDebt: bigint,
  debtCeiling: bigint = 0n,
  totalDebt: bigint = 0n
): bigint {
  // Guard against division by zero
  if (liquidationRatio === 0n) {
    return 0n
  }

  // Calculate max based on collateral
  const collateralValue = wadMul(collateral, price)
  const maxFromCollateral = wadDiv(collateralValue, liquidationRatio)
  const availableFromCollateral = maxFromCollateral > currentDebt
    ? maxFromCollateral - currentDebt
    : 0n

  // If no debt ceiling check, return collateral-based max
  if (debtCeiling === 0n) {
    return availableFromCollateral
  }

  // Calculate available from debt ceiling
  const availableFromCeiling = debtCeiling > totalDebt
    ? debtCeiling - totalDebt
    : 0n

  // Return minimum of both constraints
  return min(availableFromCollateral, availableFromCeiling)
}

/**
 * Calculate maximum collateral that can be withdrawn
 *
 * Formula: collateral - (debt * liquidationRatio) / price
 *
 * @param collateral - Amount of collateral in WAD
 * @param debt - Amount of debt in WAD
 * @param price - Collateral price in WAD
 * @param liquidationRatio - Liquidation ratio in WAD
 * @returns Maximum collateral that can be withdrawn in WAD
 */
export function calculateMaxWithdraw(
  collateral: bigint,
  debt: bigint,
  price: bigint,
  liquidationRatio: bigint
): bigint {
  if (debt === 0n) {
    return collateral // No debt = can withdraw all
  }

  // Guard against division by zero
  if (price === 0n) {
    return 0n
  }

  const requiredValue = wadMul(debt, liquidationRatio)
  const requiredCollateral = wadDiv(requiredValue, price)

  if (collateral <= requiredCollateral) {
    return 0n // Already at or below liquidation ratio
  }

  return collateral - requiredCollateral
}

/**
 * Calculate health factor
 * 
 * Health factor = collateralRatio / liquidationRatio
 * - > 1.0 = healthy
 * - = 1.0 = at liquidation threshold
 * - < 1.0 = can be liquidated
 * 
 * @param collateralRatio - Current collateral ratio in WAD
 * @param liquidationRatio - Liquidation ratio in WAD
 * @returns Health factor in WAD
 */
export function calculateHealthFactor(
  collateralRatio: bigint,
  liquidationRatio: bigint
): bigint {
  if (liquidationRatio === 0n) {
    return WAD // No liquidation ratio = always healthy
  }
  
  return wadDiv(collateralRatio, liquidationRatio)
}

/**
 * Calculate accrued stability fees
 * 
 * Formula: debt * (rate - RAY)
 * 
 * @param normalizedDebt - Normalized debt (art) in WAD
 * @param rate - Accumulated rate in RAY
 * @returns Accrued fees in WAD
 */
export function calculateAccruedFees(
  normalizedDebt: bigint,
  rate: bigint
): bigint {
  if (rate <= RAY) {
    return 0n
  }
  
  const totalDebt = rayMul(normalizedDebt, rate)
  return totalDebt - normalizedDebt
}

/**
 * Calculate total debt including fees
 * 
 * Formula: normalizedDebt * rate
 * 
 * @param normalizedDebt - Normalized debt (art) in WAD
 * @param rate - Accumulated rate in RAY
 * @returns Total debt in WAD
 */
export function calculateTotalDebt(
  normalizedDebt: bigint,
  rate: bigint
): bigint {
  return rayMul(normalizedDebt, rate)
}

/**
 * Calculate DSR earnings
 * 
 * Formula: deposit * (chi - initialChi)
 * 
 * @param deposit - Amount deposited in WAD
 * @param currentChi - Current chi value in RAY
 * @param initialChi - Chi value at deposit time in RAY
 * @returns Earnings in WAD
 */
export function calculateDSREarnings(
  deposit: bigint,
  currentChi: bigint,
  initialChi: bigint
): bigint {
  if (currentChi <= initialChi) {
    return 0n
  }
  
  const currentValue = rayMul(deposit, currentChi)
  const initialValue = rayMul(deposit, initialChi)
  
  return currentValue - initialValue
}

/**
 * Calculate auction price (Dutch auction with linear decrease)
 * 
 * Formula: top * (1 - (elapsed / duration))
 * 
 * @param startPrice - Starting price in RAY
 * @param elapsed - Time elapsed since auction start in seconds
 * @param duration - Total auction duration in seconds
 * @returns Current auction price in RAY
 */
export function calculateAuctionPrice(
  startPrice: bigint,
  elapsed: bigint,
  duration: bigint
): bigint {
  if (elapsed >= duration) {
    return 0n // Auction expired
  }
  
  // Calculate price decrease: startPrice * (duration - elapsed) / duration
  const remaining = duration - elapsed
  return (startPrice * remaining) / duration
}

/**
 * Calculate required collateral for target debt
 * 
 * Formula: (debt * liquidationRatio) / price
 * 
 * @param debt - Target debt amount in WAD
 * @param price - Collateral price in WAD
 * @param liquidationRatio - Liquidation ratio in WAD
 * @returns Required collateral in WAD
 */
export function calculateRequiredCollateral(
  debt: bigint,
  price: bigint,
  liquidationRatio: bigint
): bigint {
  // Guard against division by zero
  if (price === 0n) {
    return 0n
  }
  const requiredValue = wadMul(debt, liquidationRatio)
  return wadDiv(requiredValue, price)
}

/**
 * Calculate collateral value in USD
 * 
 * @param collateral - Amount of collateral in WAD
 * @param price - Collateral price in WAD
 * @returns Collateral value in WAD (USD)
 */
export function calculateCollateralValue(
  collateral: bigint,
  price: bigint
): bigint {
  return wadMul(collateral, price)
}

/**
 * Check if position is safe (above liquidation ratio)
 * 
 * @param collateralRatio - Current collateral ratio in WAD
 * @param liquidationRatio - Liquidation ratio in WAD
 * @returns true if position is safe
 */
export function isPositionSafe(
  collateralRatio: bigint,
  liquidationRatio: bigint
): boolean {
  return collateralRatio >= liquidationRatio
}

/**
 * Calculate liquidation penalty amount
 * 
 * @param debt - Debt amount in WAD
 * @param penaltyBps - Penalty in basis points (e.g., 1300 = 13%)
 * @returns Penalty amount in WAD
 */
export function calculateLiquidationPenalty(
  debt: bigint,
  penaltyBps: bigint
): bigint {
  return (debt * penaltyBps) / 10000n
}

/**
 * Calculate normalized debt (art) from total debt
 * 
 * Formula: totalDebt / rate
 * 
 * @param totalDebt - Total debt in WAD
 * @param rate - Accumulated rate in RAY
 * @returns Normalized debt in WAD
 */
export function calculateNormalizedDebt(
  totalDebt: bigint,
  rate: bigint
): bigint {
  if (rate === 0n) return 0n
  return (totalDebt * RAY) / rate
}

