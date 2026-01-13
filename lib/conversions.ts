/**
 * Unit Conversion Utilities
 * 
 * Functions for converting between different precision levels and token decimals.
 */

import { WAD, RAY, RAD, TOKEN_DECIMALS } from './constants'

/**
 * Convert token amounts to WAD (18 decimals)
 * 
 * This is useful for normalizing different token decimals to a common precision.
 */

export function tokenToWad(amount: bigint, tokenSymbol: string): bigint {
  const decimals = TOKEN_DECIMALS[tokenSymbol] || 18
  
  if (decimals === 18) {
    return amount
  } else if (decimals < 18) {
    // Scale up (e.g., USDC 6 decimals -> 18 decimals)
    const scaleFactor = 10n ** BigInt(18 - decimals)
    return amount * scaleFactor
  } else {
    // Scale down - defensive code for hypothetical > 18 decimal tokens
    // c8 ignore start
    const scaleFactor = 10n ** BigInt(decimals - 18)
    return amount / scaleFactor
    // c8 ignore stop
  }
}

/**
 * Convert WAD to token amount (specific decimals)
 */

export function wadToToken(wad: bigint, tokenSymbol: string): bigint {
  const decimals = TOKEN_DECIMALS[tokenSymbol] || 18
  
  if (decimals === 18) {
    return wad
  } else if (decimals < 18) {
    // Scale down (e.g., 18 decimals -> USDC 6 decimals)
    const scaleFactor = 10n ** BigInt(18 - decimals)
    return wad / scaleFactor
  } else {
    // Scale up - defensive code for hypothetical > 18 decimal tokens
    // c8 ignore start
    const scaleFactor = 10n ** BigInt(decimals - 18)
    return wad * scaleFactor
    // c8 ignore stop
  }
}

/**
 * Convert basis points to RAY (for rates)
 * 
 * Example: 500 bps (5%) -> RAY representation
 */

export function bpsToRay(bps: bigint): bigint {
  // 10000 bps = 100% = 1.0 in RAY = RAY
  // So: bps / 10000 * RAY
  return (bps * RAY) / 10000n
}

/**
 * Convert RAY to basis points
 */

export function rayToBps(ray: bigint): bigint {
  return (ray * 10000n) / RAY
}

/**
 * Convert percentage to RAY
 * 
 * Example: 5 (5%) -> RAY representation
 */

export function percentToRay(percent: bigint): bigint {
  // 100% = 1.0 in RAY = RAY
  // So: percent / 100 * RAY
  return (percent * RAY) / 100n
}

/**
 * Convert RAY to percentage
 */

export function rayToPercent(ray: bigint): bigint {
  return (ray * 100n) / RAY
}

/**
 * Convert annual percentage rate to per-second rate (RAY)
 * 
 * Used for stability fees and DSR.
 * Formula: (1 + APR)^(1/seconds_per_year)
 * 
 * Note: This is an approximation. For exact values, use the rate
 * calculation from the Jug contract.
 */

export function aprToRate(apr: number): bigint {
  const secondsPerYear = 365.25 * 24 * 60 * 60
  const rate = Math.pow(1 + apr / 100, 1 / secondsPerYear)
  
  // Convert to RAY (27 decimals)
  const rateRay = BigInt(Math.floor(rate * Number(RAY)))
  
  return rateRay
}

/**
 * Convert per-second rate (RAY) to annual percentage rate
 * 
 * Formula: (rate^seconds_per_year - 1) * 100
 */

export function rateToApr(rate: bigint): number {
  const secondsPerYear = 365.25 * 24 * 60 * 60
  const rateDecimal = Number(rate) / Number(RAY)
  
  const apr = (Math.pow(rateDecimal, secondsPerYear) - 1) * 100
  
  return apr
}

/**
 * Convert collateral ratio from basis points to percentage
 * 
 * Example: 15000 bps -> 150%
 */

export function collateralRatioBpsToPercent(bps: bigint): number {
  return Number(bps) / 100
}

/**
 * Convert percentage to collateral ratio in basis points
 * 
 * Example: 150% -> 15000 bps
 */

export function percentToCollateralRatioBps(percent: number): bigint {
  return BigInt(Math.floor(percent * 100))
}

/**
 * Convert price from oracle (WAD) to human-readable USD
 */

export function oraclePriceToUsd(price: bigint): number {
  return Number(price) / Number(WAD)
}

/**
 * Convert USD price to oracle format (WAD)
 */

export function usdToOraclePrice(usd: number): bigint {
  return BigInt(Math.floor(usd * Number(WAD)))
}

/**
 * Scale amount by decimals
 */

export function scaleUp(amount: bigint, decimals: number): bigint {
  return amount * (10n ** BigInt(decimals))
}

export function scaleDown(amount: bigint, decimals: number): bigint {
  return amount / (10n ** BigInt(decimals))
}

/**
 * Convert between different token decimals
 */

export function convertDecimals(
  amount: bigint,
  fromDecimals: number,
  toDecimals: number
): bigint {
  if (fromDecimals === toDecimals) {
    return amount
  } else if (fromDecimals < toDecimals) {
    const scaleFactor = 10n ** BigInt(toDecimals - fromDecimals)
    return amount * scaleFactor
  } else {
    const scaleFactor = 10n ** BigInt(fromDecimals - toDecimals)
    return amount / scaleFactor
  }
}

/**
 * Normalize token amount to 18 decimals (WAD)
 * 
 * This is the same as tokenToWad but uses explicit decimals parameter
 */

export function normalizeToWad(amount: bigint, decimals: number): bigint {
  return convertDecimals(amount, decimals, 18)
}

/**
 * Denormalize from WAD to specific decimals
 */

export function denormalizeFromWad(wad: bigint, decimals: number): bigint {
  return convertDecimals(wad, 18, decimals)
}

