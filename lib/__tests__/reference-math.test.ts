/**
 * Reference Math Implementation Tests
 * 
 * These tests verify that our math.ts implementations match the exact
 * behavior of the MakerDAO Solidity reference implementations.
 */

import { describe, it, expect } from 'vitest'
import {
  rpow,
  rmul,
  safeAdd,
  safeSub,
  safeMul,
  calculateAccumulatedRate,
  calculateChi,
} from '../reference-math'
import { rayPow, rayMul } from '../math'
import { RAY, WAD } from '../constants'

describe('Reference Math vs Our Implementation', () => {
  // ============================================
  // RPOW REFERENCE TESTS
  // ============================================
  describe('rpow (reference implementation)', () => {
    it('should return base when x=0 and n=0', () => {
      expect(rpow(0n, 0n, RAY)).toBe(RAY)
    })

    it('should return 0 when x=0 and n>0', () => {
      expect(rpow(0n, 1n, RAY)).toBe(0n)
      expect(rpow(0n, 100n, RAY)).toBe(0n)
    })

    it('should return x when n=1', () => {
      expect(rpow(RAY, 1n, RAY)).toBe(RAY)
      expect(rpow(2n * RAY, 1n, RAY)).toBe(2n * RAY)
    })

    it('should return base when n=0', () => {
      expect(rpow(RAY, 0n, RAY)).toBe(RAY)
      expect(rpow(2n * RAY, 0n, RAY)).toBe(RAY)
    })

    it('should calculate 1.02^1 correctly (2% for 1 second)', () => {
      // 2% per second rate
      const rate = RAY + (RAY * 2n) / 100n // 1.02 in RAY
      const result = rpow(rate, 1n, RAY)
      expect(result).toBe(rate) // x^1 = x
    })

    it('should calculate compound interest correctly', () => {
      // 2% APY per-second rate: 1000000000627937192491029810
      const duty = 1000000000627937192491029810n
      
      // After 1 year (31536000 seconds)
      const oneYear = 31536000n
      const result = rpow(duty, oneYear, RAY)
      
      // Should be approximately 1.02 * RAY (2% growth)
      const expectedMin = RAY + (RAY * 19n) / 1000n // 1.019 (allowing some tolerance)
      const expectedMax = RAY + (RAY * 21n) / 1000n // 1.021
      
      expect(result).toBeGreaterThanOrEqual(expectedMin)
      expect(result).toBeLessThanOrEqual(expectedMax)
    })

    it('should match our rayPow implementation', () => {
      // Test various values
      const testCases = [
        { x: RAY, n: 0n },
        { x: RAY, n: 1n },
        { x: RAY, n: 10n },
        { x: RAY + RAY / 100n, n: 1n }, // 1.01
        { x: RAY + RAY / 100n, n: 10n }, // 1.01^10
        { x: RAY + RAY / 100n, n: 100n }, // 1.01^100
        { x: 1000000000627937192491029810n, n: 3600n }, // ~2% APY for 1 hour
        { x: 1000000000627937192491029810n, n: 86400n }, // ~2% APY for 1 day
      ]

      for (const { x, n } of testCases) {
        const refResult = rpow(x, n, RAY)
        const ourResult = rayPow(x, n)
        
        // Allow for tiny rounding differences (1 wei)
        const diff = refResult > ourResult ? refResult - ourResult : ourResult - refResult
        expect(diff).toBeLessThanOrEqual(1n)
      }
    })
  })

  // ============================================
  // RMUL REFERENCE TESTS
  // ============================================
  describe('rmul (reference implementation)', () => {
    it('should multiply two RAY values correctly', () => {
      expect(rmul(RAY, RAY)).toBe(RAY)
      expect(rmul(2n * RAY, RAY)).toBe(2n * RAY)
      expect(rmul(RAY, 2n * RAY)).toBe(2n * RAY)
      expect(rmul(2n * RAY, 2n * RAY)).toBe(4n * RAY)
    })

    it('should match our rayMul implementation', () => {
      const testCases = [
        { a: RAY, b: RAY },
        { a: 2n * RAY, b: 3n * RAY },
        { a: RAY / 2n, b: RAY / 2n },
        { a: 1000000000627937192491029810n, b: RAY },
        { a: 123456789n * RAY, b: 987654321n * RAY / 1000000000n },
      ]

      for (const { a, b } of testCases) {
        const refResult = rmul(a, b)
        const ourResult = rayMul(a, b)
        expect(refResult).toBe(ourResult)
      }
    })
  })

  // ============================================
  // SAFE MATH REFERENCE TESTS  
  // ============================================
  describe('safe math operations', () => {
    it('safeAdd should add correctly', () => {
      expect(safeAdd(1n, 2n)).toBe(3n)
      expect(safeAdd(RAY, RAY)).toBe(2n * RAY)
    })

    it('safeSub should subtract correctly', () => {
      expect(safeSub(3n, 1n)).toBe(2n)
      expect(safeSub(2n * RAY, RAY)).toBe(RAY)
    })

    it('safeMul should multiply correctly', () => {
      expect(safeMul(2n, 3n)).toBe(6n)
      expect(safeMul(0n, RAY)).toBe(0n)
    })
  })

  // ============================================
  // RATE ACCUMULATION TESTS
  // ============================================
  describe('calculateAccumulatedRate', () => {
    it('should calculate rate correctly for 2% APY', () => {
      const duty = 1000000000627937192491029810n // ~2% APY per second
      const base = 0n
      const elapsed = 86400n // 1 day
      const prevRate = RAY // Start at 1.0

      const newRate = calculateAccumulatedRate(duty, base, elapsed, prevRate)

      // After 1 day at 2% APY, rate should increase slightly
      expect(newRate).toBeGreaterThan(prevRate)

      // Daily increase for 2% APY = (1.02^(1/365) - 1) ≈ 0.0000542 = 0.00542%
      // In basis points (10000 = 100%), this is about 0.542 bps
      // Using 1000000 scale for more precision
      const dailyIncreasePPM = (newRate - prevRate) * 1000000n / prevRate
      // Expected: ~54 ppm (parts per million)
      expect(dailyIncreasePPM).toBeGreaterThanOrEqual(50n)
      expect(dailyIncreasePPM).toBeLessThanOrEqual(60n)
    })

    it('should calculate rate correctly for 1 year at 2% APY', () => {
      const duty = 1000000000627937192491029810n // ~2% APY per second
      const base = 0n
      const elapsed = 31536000n // 1 year
      const prevRate = RAY // Start at 1.0

      const newRate = calculateAccumulatedRate(duty, base, elapsed, prevRate)

      // After 1 year at 2% APY, rate should be ~1.02
      const yearlyIncrease = (newRate - prevRate) * 10000n / prevRate
      // Expected: ~200 bps (2%)
      expect(yearlyIncrease).toBeGreaterThanOrEqual(195n) // 1.95%
      expect(yearlyIncrease).toBeLessThanOrEqual(205n) // 2.05%
    })
  })
})

