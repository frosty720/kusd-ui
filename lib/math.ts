/**
 * DeFi Math Operations
 * 
 * Fixed-point arithmetic operations for WAD, RAY, and RAD precision.
 * Based on MakerDAO DSS math libraries.
 */

import { WAD, RAY, RAD } from './constants'

/**
 * WAD Math Operations (18 decimals)
 */

export function wadMul(a: bigint, b: bigint): bigint {
  return (a * b) / WAD
}

export function wadDiv(a: bigint, b: bigint): bigint {
  if (b === 0n) return 0n
  return (a * WAD) / b
}

export function wadAdd(a: bigint, b: bigint): bigint {
  return a + b
}

export function wadSub(a: bigint, b: bigint): bigint {
  return a - b
}

/**
 * RAY Math Operations (27 decimals)
 */

export function rayMul(a: bigint, b: bigint): bigint {
  return (a * b) / RAY
}

export function rayDiv(a: bigint, b: bigint): bigint {
  if (b === 0n) return 0n
  return (a * RAY) / b
}

export function rayAdd(a: bigint, b: bigint): bigint {
  return a + b
}

export function raySub(a: bigint, b: bigint): bigint {
  return a - b
}

/**
 * RAD Math Operations (45 decimals)
 */

export function radMul(a: bigint, b: bigint): bigint {
  return (a * b) / RAD
}

export function radDiv(a: bigint, b: bigint): bigint {
  if (b === 0n) return 0n
  return (a * RAD) / b
}

export function radAdd(a: bigint, b: bigint): bigint {
  return a + b
}

export function radSub(a: bigint, b: bigint): bigint {
  return a - b
}

/**
 * Conversion Operations
 */

export function wadToRay(wad: bigint): bigint {
  return wad * (RAY / WAD)
}

export function rayToWad(ray: bigint): bigint {
  return ray / (RAY / WAD)
}

export function wadToRad(wad: bigint): bigint {
  return wad * (RAD / WAD)
}

export function radToWad(rad: bigint): bigint {
  return rad / (RAD / WAD)
}

export function rayToRad(ray: bigint): bigint {
  return ray * (RAD / RAY)
}

export function radToRay(rad: bigint): bigint {
  return rad / (RAD / RAY)
}

/**
 * Power Operations
 * 
 * Used for calculating compound interest rates
 */

export function rayPow(base: bigint, exp: bigint): bigint {
  if (exp === 0n) return RAY
  
  let result = RAY
  let x = base
  let n = exp
  
  while (n > 0n) {
    if (n % 2n === 1n) {
      result = rayMul(result, x)
    }
    x = rayMul(x, x)
    n = n / 2n
  }
  
  return result
}

/**
 * Minimum and Maximum
 */

export function min(a: bigint, b: bigint): bigint {
  return a < b ? a : b
}

export function max(a: bigint, b: bigint): bigint {
  return a > b ? a : b
}

/**
 * Percentage Calculations
 */

export function percentOf(amount: bigint, percent: bigint, base: bigint = 100n): bigint {
  return (amount * percent) / base
}

export function bpsToPercent(bps: bigint): bigint {
  return bps / 100n
}

export function percentToBps(percent: bigint): bigint {
  return percent * 100n
}

/**
 * Safe Math Operations with Overflow Checks
 */

export function safeAdd(a: bigint, b: bigint): bigint {
  const result = a + b
  if (result < a) throw new Error('Addition overflow')
  return result
}

export function safeSub(a: bigint, b: bigint): bigint {
  if (b > a) throw new Error('Subtraction underflow')
  return a - b
}

export function safeMul(a: bigint, b: bigint): bigint {
  if (a === 0n || b === 0n) return 0n
  const result = a * b
  if (result / a !== b) throw new Error('Multiplication overflow')
  return result
}

export function safeDiv(a: bigint, b: bigint): bigint {
  if (b === 0n) throw new Error('Division by zero')
  return a / b
}

/**
 * Rounding Operations
 */

export function roundDown(value: bigint, precision: bigint): bigint {
  return (value / precision) * precision
}

export function roundUp(value: bigint, precision: bigint): bigint {
  const remainder = value % precision
  if (remainder === 0n) return value
  return value + (precision - remainder)
}

/**
 * Comparison Helpers
 */

export function isZero(value: bigint): boolean {
  return value === 0n
}

export function isPositive(value: bigint): boolean {
  return value > 0n
}

export function isNegative(value: bigint): boolean {
  return value < 0n
}

export function equals(a: bigint, b: bigint): boolean {
  return a === b
}

/**
 * Absolute Value
 */

export function abs(value: bigint): bigint {
  return value < 0n ? -value : value
}

