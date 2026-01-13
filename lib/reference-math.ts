/**
 * Reference MakerDAO Math Implementations
 * 
 * These are exact ports of the Solidity math functions from MakerDAO DSS contracts.
 * Used to verify that our math.ts implementations produce identical results.
 * 
 * Source: kusd-core/src/jug.sol, kusd-core/src/pot.sol
 */

import { RAY } from './constants'

/**
 * Exact port of MakerDAO's _rpow function from jug.sol/pot.sol
 * 
 * This is the reference implementation that contracts use for rate accumulation.
 * It uses binary exponentiation with rounding.
 * 
 * @param x - Base value (RAY)
 * @param n - Exponent (seconds)
 * @param base - Base for calculation (usually RAY = 10^27)
 * @returns x^n in RAY precision
 */
export function rpow(x: bigint, n: bigint, base: bigint = RAY): bigint {
  // Handle special cases first (matching Solidity assembly logic)
  if (x === 0n) {
    return n === 0n ? base : 0n
  }
  
  // Initialize z based on whether n is odd or even
  let z = n % 2n === 0n ? base : x
  const half = base / 2n // for rounding
  
  // Binary exponentiation with rounding
  n = n / 2n
  while (n > 0n) {
    // xx = x * x
    const xx = x * x
    // Check for overflow: xx / x should equal x
    if (xx / x !== x) {
      throw new Error('rpow: overflow in x*x')
    }
    
    // xxRound = xx + half (for rounding)
    const xxRound = xx + half
    // Check for overflow
    if (xxRound < xx) {
      throw new Error('rpow: overflow in xx + half')
    }
    
    // x = xxRound / base
    x = xxRound / base
    
    // If n is odd, multiply z by x
    if (n % 2n === 1n) {
      // zx = z * x
      const zx = z * x
      // Check for overflow: if x != 0, then zx / x should equal z
      if (x !== 0n && zx / x !== z) {
        throw new Error('rpow: overflow in z*x')
      }
      
      // zxRound = zx + half
      const zxRound = zx + half
      if (zxRound < zx) {
        throw new Error('rpow: overflow in zx + half')
      }
      
      // z = zxRound / base
      z = zxRound / base
    }
    
    n = n / 2n
  }
  
  return z
}

/**
 * Exact port of MakerDAO's _rmul function
 * 
 * Multiplies two RAY values and divides by RAY.
 * z = (x * y) / ONE
 * 
 * @param x - First operand (RAY)
 * @param y - Second operand (RAY)
 * @returns Result in RAY
 */
export function rmul(x: bigint, y: bigint): bigint {
  const z = x * y
  // Overflow check
  if (y !== 0n && z / y !== x) {
    throw new Error('rmul: overflow')
  }
  return z / RAY
}

/**
 * Exact port of MakerDAO's _add function with overflow check
 */
export function safeAdd(x: bigint, y: bigint): bigint {
  const z = x + y
  if (z < x) {
    throw new Error('add: overflow')
  }
  return z
}

/**
 * Exact port of MakerDAO's _sub function with underflow check
 */
export function safeSub(x: bigint, y: bigint): bigint {
  const z = x - y
  if (z > x) {
    throw new Error('sub: underflow')
  }
  return z
}

/**
 * Exact port of MakerDAO's _mul function with overflow check
 */
export function safeMul(x: bigint, y: bigint): bigint {
  if (y === 0n) return 0n
  const z = x * y
  if (z / y !== x) {
    throw new Error('mul: overflow')
  }
  return z
}

/**
 * Calculate accumulated rate (as done in Jug.drip)
 * 
 * rate = rmul(rpow(base + duty, now - rho, RAY), prev_rate)
 * 
 * @param duty - Per-second stability fee rate (RAY, e.g., 1000000000627937192491029810 for 2% APY)
 * @param base - Global base rate (usually 0)
 * @param elapsedSeconds - Time since last drip
 * @param prevRate - Previous accumulated rate
 * @returns New accumulated rate
 */
export function calculateAccumulatedRate(
  duty: bigint,
  base: bigint,
  elapsedSeconds: bigint,
  prevRate: bigint
): bigint {
  const rate = safeAdd(base, duty)
  const accumulatedMultiplier = rpow(rate, elapsedSeconds, RAY)
  return rmul(accumulatedMultiplier, prevRate)
}

/**
 * Calculate chi (accumulated DSR) as done in Pot.drip
 * 
 * chi = rmul(rpow(dsr, now - rho, RAY), prev_chi)
 */
export function calculateChi(
  dsr: bigint,
  elapsedSeconds: bigint,
  prevChi: bigint
): bigint {
  const accumulatedMultiplier = rpow(dsr, elapsedSeconds, RAY)
  return rmul(accumulatedMultiplier, prevChi)
}

