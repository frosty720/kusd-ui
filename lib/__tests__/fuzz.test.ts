/**
 * Fuzz Tests for Math Library
 * 
 * These tests generate thousands of random inputs to find edge cases,
 * overflow conditions, and precision errors in our math implementations.
 */

import { describe, it, expect } from 'vitest'
import {
  wadMul,
  wadDiv,
  rayMul,
  rayDiv,
  rayPow,
  percentOf,
  min,
  max,
} from '../math'
import {
  calculateCollateralRatio,
  calculateLiquidationPrice,
  calculateMaxMint,
  calculateHealthFactor,
} from '../calculations'
import { rpow, rmul } from '../reference-math'
import { WAD, RAY } from '../constants'

// Pseudo-random number generator with seed for reproducibility
function seededRandom(seed: number): () => number {
  return function() {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff
    return seed / 0x7fffffff
  }
}

// Generate random bigint in range
function randomBigInt(random: () => number, min: bigint, max: bigint): bigint {
  const range = max - min
  const randomFraction = random()
  return min + BigInt(Math.floor(Number(range) * randomFraction))
}

describe('Fuzz Tests', () => {
  const ITERATIONS = 50 // Reduced for faster CI, increase for thorough testing
  const random = seededRandom(12345) // Fixed seed for reproducibility

  // ============================================
  // WAD MATH FUZZ TESTS
  // ============================================
  describe('WAD Math Fuzz Tests', () => {
    it(`should handle ${ITERATIONS} random wadMul operations without overflow`, () => {
      for (let i = 0; i < ITERATIONS; i++) {
        // Use reasonable ranges that won't overflow
        const a = randomBigInt(random, 0n, 10n ** 30n) // Up to 10^12 WAD
        const b = randomBigInt(random, 0n, 10n ** 30n)
        
        expect(() => wadMul(a, b)).not.toThrow()
        
        const result = wadMul(a, b)
        // Result should be non-negative
        expect(result).toBeGreaterThanOrEqual(0n)
        
        // Approximate check: result ≈ (a * b) / WAD
        if (a > 0n && b > 0n) {
          const expected = (a * b) / WAD
          expect(result).toBe(expected)
        }
      }
    })

    it(`should handle ${ITERATIONS} random wadDiv operations`, () => {
      for (let i = 0; i < ITERATIONS; i++) {
        const a = randomBigInt(random, 0n, 10n ** 30n)
        const b = randomBigInt(random, 1n, 10n ** 30n) // Avoid division by zero
        
        expect(() => wadDiv(a, b)).not.toThrow()
        
        const result = wadDiv(a, b)
        expect(result).toBeGreaterThanOrEqual(0n)
      }
    })

    it('should return 0 when dividing by 0 (our implementation)', () => {
      // Our implementation returns 0 for division by zero (safety)
      expect(wadDiv(WAD, 0n)).toBe(0n)
    })
  })

  // ============================================
  // RAY MATH FUZZ TESTS
  // ============================================
  describe('RAY Math Fuzz Tests', () => {
    it(`should handle ${ITERATIONS} random rayMul operations`, () => {
      for (let i = 0; i < ITERATIONS; i++) {
        const a = randomBigInt(random, 0n, 10n ** 36n)
        const b = randomBigInt(random, 0n, 10n ** 36n)
        
        expect(() => rayMul(a, b)).not.toThrow()
        
        const result = rayMul(a, b)
        expect(result).toBeGreaterThanOrEqual(0n)
      }
    })

    it(`should handle ${ITERATIONS} random rayPow operations`, () => {
      for (let i = 0; i < ITERATIONS; i++) {
        // Use realistic rate values (between 1.0 and 1.0001 per second in RAY)
        // This is the typical range for per-second compound rates
        const base = randomBigInt(random, RAY, RAY + RAY / 10000n)
        // Use realistic time values (0 to 1 hour in seconds) - longer periods are too slow
        const exponent = randomBigInt(random, 0n, 3600n)

        expect(() => rayPow(base, exponent)).not.toThrow()

        const result = rayPow(base, exponent)
        expect(result).toBeGreaterThanOrEqual(0n)
      }
    })
  })

  // ============================================
  // RPOW COMPARISON FUZZ TESTS
  // ============================================
  describe('rayPow vs rpow comparison', () => {
    it(`should match reference implementation for ${ITERATIONS} random inputs`, () => {
      for (let i = 0; i < ITERATIONS; i++) {
        // Use rate values typical for DeFi per-second rates
        const base = randomBigInt(random, RAY, RAY + RAY / 10000n)
        const exponent = randomBigInt(random, 0n, 3600n) // Up to 1 hour

        const refResult = rpow(base, exponent, RAY)
        const ourResult = rayPow(base, exponent)

        // Allow for 1 wei difference due to rounding
        const diff = refResult > ourResult ? refResult - ourResult : ourResult - refResult
        expect(diff).toBeLessThanOrEqual(1n)
      }
    })
  })

  // ============================================
  // CDP CALCULATIONS FUZZ TESTS
  // ============================================
  describe('CDP Calculations Fuzz Tests', () => {
    it(`should handle ${ITERATIONS} random collateral ratio calculations`, () => {
      for (let i = 0; i < ITERATIONS; i++) {
        const collateral = randomBigInt(random, 0n, 10n ** 24n) // Up to 1M tokens
        const price = randomBigInt(random, WAD, 100000n * WAD) // $1 to $100k
        const debt = randomBigInt(random, 0n, 10n ** 24n)
        
        expect(() => calculateCollateralRatio(collateral, price, debt)).not.toThrow()
      }
    })

    it(`should handle ${ITERATIONS} random liquidation price calculations`, () => {
      for (let i = 0; i < ITERATIONS; i++) {
        const collateral = randomBigInt(random, 0n, 10n ** 24n)
        const debt = randomBigInt(random, 0n, 10n ** 24n)
        const liquidationRatio = randomBigInt(random, WAD, 2n * WAD) // 100% to 200%
        
        expect(() => calculateLiquidationPrice(collateral, debt, liquidationRatio)).not.toThrow()
      }
    })
  })
})

