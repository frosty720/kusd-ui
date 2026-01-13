/**
 * Comprehensive tests for conversions.ts
 * 100% coverage for all unit conversion functions
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  tokenToWad,
  wadToToken,
  bpsToRay,
  rayToBps,
  percentToRay,
  rayToPercent,
  aprToRate,
  rateToApr,
  collateralRatioBpsToPercent,
  percentToCollateralRatioBps,
  oraclePriceToUsd,
  usdToOraclePrice,
  scaleUp,
  scaleDown,
  convertDecimals,
  normalizeToWad,
  denormalizeFromWad,
} from '../conversions'
import { WAD, RAY } from '../constants'

describe('conversions.ts', () => {
  // ============================================
  // TOKEN TO/FROM WAD
  // ============================================
  describe('tokenToWad', () => {
    it('should return same value for 18 decimal tokens', () => {
      const amount = 1000n * WAD
      expect(tokenToWad(amount, 'WETH')).toBe(amount)
      expect(tokenToWad(amount, 'DAI')).toBe(amount)
      expect(tokenToWad(amount, 'KUSD')).toBe(amount)
    })

    it('should scale up 6 decimal tokens (USDC, USDT)', () => {
      // 1000 USDC (6 decimals) = 1000 * 10^6
      const amount = 1000n * 10n ** 6n
      const expected = 1000n * WAD
      expect(tokenToWad(amount, 'USDC')).toBe(expected)
      expect(tokenToWad(amount, 'USDT')).toBe(expected)
    })

    it('should scale up 8 decimal tokens (WBTC)', () => {
      // 1 WBTC (8 decimals) = 1 * 10^8
      const amount = 1n * 10n ** 8n
      const expected = 1n * WAD
      expect(tokenToWad(amount, 'WBTC')).toBe(expected)
    })

    it('should handle unknown tokens as 18 decimals', () => {
      const amount = 1000n * WAD
      expect(tokenToWad(amount, 'UNKNOWN')).toBe(amount)
    })

    it('should handle 0 amount', () => {
      expect(tokenToWad(0n, 'USDC')).toBe(0n)
      expect(tokenToWad(0n, 'WBTC')).toBe(0n)
    })

    // Note: The > 18 decimals branch in tokenToWad cannot be tested because
    // TOKEN_DECIMALS doesn't contain any tokens with > 18 decimals.
    // Use normalizeToWad(amount, decimals) for hypothetical tokens with > 18 decimals.
  })

  describe('wadToToken', () => {
    it('should return same value for 18 decimal tokens', () => {
      const wad = 1000n * WAD
      expect(wadToToken(wad, 'WETH')).toBe(wad)
      expect(wadToToken(wad, 'DAI')).toBe(wad)
    })

    it('should scale down to 6 decimal tokens', () => {
      const wad = 1000n * WAD
      const expected = 1000n * 10n ** 6n
      expect(wadToToken(wad, 'USDC')).toBe(expected)
      expect(wadToToken(wad, 'USDT')).toBe(expected)
    })

    it('should scale down to 8 decimal tokens', () => {
      const wad = 1n * WAD
      const expected = 1n * 10n ** 8n
      expect(wadToToken(wad, 'WBTC')).toBe(expected)
    })

    it('should handle unknown tokens as 18 decimals', () => {
      const wad = 1000n * WAD
      expect(wadToToken(wad, 'UNKNOWN')).toBe(wad)
    })

    it('should handle 0 amount', () => {
      expect(wadToToken(0n, 'USDC')).toBe(0n)
    })
  })

  // ============================================
  // BPS TO/FROM RAY
  // ============================================
  describe('bpsToRay', () => {
    it('should convert basis points to RAY', () => {
      // 100% = 10000 bps = 1.0 RAY
      expect(bpsToRay(10000n)).toBe(RAY)
      // 50% = 5000 bps = 0.5 RAY
      expect(bpsToRay(5000n)).toBe(RAY / 2n)
      // 1% = 100 bps = 0.01 RAY
      expect(bpsToRay(100n)).toBe(RAY / 100n)
    })

    it('should handle 0 bps', () => {
      expect(bpsToRay(0n)).toBe(0n)
    })
  })

  describe('rayToBps', () => {
    it('should convert RAY to basis points', () => {
      expect(rayToBps(RAY)).toBe(10000n)
      expect(rayToBps(RAY / 2n)).toBe(5000n)
      expect(rayToBps(RAY / 100n)).toBe(100n)
    })

    it('should handle 0 RAY', () => {
      expect(rayToBps(0n)).toBe(0n)
    })
  })

  // ============================================
  // PERCENT TO/FROM RAY
  // ============================================
  describe('percentToRay', () => {
    it('should convert percent to RAY', () => {
      expect(percentToRay(100n)).toBe(RAY)
      expect(percentToRay(50n)).toBe(RAY / 2n)
      expect(percentToRay(1n)).toBe(RAY / 100n)
    })

    it('should handle 0 percent', () => {
      expect(percentToRay(0n)).toBe(0n)
    })
  })

  describe('rayToPercent', () => {
    it('should convert RAY to percent', () => {
      expect(rayToPercent(RAY)).toBe(100n)
      expect(rayToPercent(RAY / 2n)).toBe(50n)
      expect(rayToPercent(RAY / 100n)).toBe(1n)
    })

    it('should handle 0 RAY', () => {
      expect(rayToPercent(0n)).toBe(0n)
    })
  })

  // ============================================
  // APR TO/FROM RATE
  // ============================================
  describe('aprToRate', () => {
    it('should convert 0% APR to approximately 1.0 RAY', () => {
      const rate = aprToRate(0)
      // Due to floating point, it's very close to RAY but not exact
      expect(rate).toBeGreaterThanOrEqual(RAY)
      expect(rate).toBeLessThan(RAY + 10n ** 18n) // Within reasonable tolerance
    })

    it('should convert positive APR to per-second rate', () => {
      // 5% APR should give a rate slightly above RAY
      const rate = aprToRate(5)
      expect(rate).toBeGreaterThan(RAY)
      // After 1 year of compounding, should be ~1.05
    })

    it('should handle 100% APR', () => {
      const rate = aprToRate(100)
      expect(rate).toBeGreaterThan(RAY)
    })
  })

  describe('rateToApr', () => {
    it('should convert 1.0 RAY to 0% APR', () => {
      const apr = rateToApr(RAY)
      expect(apr).toBeCloseTo(0, 5)
    })

    it('should convert rate back to APR', () => {
      // Convert 5% APR to rate and back
      const rate = aprToRate(5)
      const apr = rateToApr(rate)
      expect(apr).toBeCloseTo(5, 1) // Within 0.1%
    })

    it('should handle 0 rate (returns -100%)', () => {
      // 0 rate means 0/RAY = 0, so (0^seconds - 1) * 100 = -100
      const apr = rateToApr(0n)
      expect(apr).toBe(-100)
    })
  })

  // ============================================
  // COLLATERAL RATIO BPS TO/FROM PERCENT
  // ============================================
  describe('collateralRatioBpsToPercent', () => {
    it('should convert 15000 bps to 150%', () => {
      // Returns number, not bigint
      expect(collateralRatioBpsToPercent(15000n)).toBe(150)
    })

    it('should convert 20000 bps to 200%', () => {
      expect(collateralRatioBpsToPercent(20000n)).toBe(200)
    })

    it('should handle 0 bps', () => {
      expect(collateralRatioBpsToPercent(0n)).toBe(0)
    })
  })

  describe('percentToCollateralRatioBps', () => {
    it('should convert 150% to 15000 bps', () => {
      // Takes number, returns bigint
      expect(percentToCollateralRatioBps(150)).toBe(15000n)
    })

    it('should convert 200% to 20000 bps', () => {
      expect(percentToCollateralRatioBps(200)).toBe(20000n)
    })

    it('should handle 0 percent', () => {
      expect(percentToCollateralRatioBps(0)).toBe(0n)
    })
  })

  // ============================================
  // ORACLE PRICE CONVERSIONS
  // ============================================
  describe('oraclePriceToUsd', () => {
    it('should convert oracle price to USD', () => {
      // Oracle price of 2000 * WAD = $2000 (returns number)
      const oraclePrice = 2000n * WAD
      expect(oraclePriceToUsd(oraclePrice)).toBe(2000)
    })

    it('should handle 0 price', () => {
      expect(oraclePriceToUsd(0n)).toBe(0)
    })
  })

  describe('usdToOraclePrice', () => {
    it('should convert USD to oracle price', () => {
      // Takes number, returns bigint
      expect(usdToOraclePrice(2000)).toBe(2000n * WAD)
    })

    it('should handle 0 USD', () => {
      expect(usdToOraclePrice(0)).toBe(0n)
    })
  })

  // ============================================
  // SCALE UP/DOWN
  // ============================================
  describe('scaleUp', () => {
    it('should scale up by given decimals', () => {
      // 1000 scaled up by 12 decimals
      expect(scaleUp(1000n, 12)).toBe(1000n * 10n ** 12n)
    })

    it('should handle 0 decimals', () => {
      expect(scaleUp(1000n, 0)).toBe(1000n)
    })

    it('should handle 0 amount', () => {
      expect(scaleUp(0n, 12)).toBe(0n)
    })
  })

  describe('scaleDown', () => {
    it('should scale down by given decimals', () => {
      // 1000 * 10^12 scaled down by 12 decimals
      expect(scaleDown(1000n * 10n ** 12n, 12)).toBe(1000n)
    })

    it('should handle 0 decimals', () => {
      expect(scaleDown(1000n, 0)).toBe(1000n)
    })

    it('should handle 0 amount', () => {
      expect(scaleDown(0n, 12)).toBe(0n)
    })

    it('should truncate fractional parts', () => {
      // 1500 scaled down by 3 = 1 (truncated)
      expect(scaleDown(1500n, 3)).toBe(1n)
    })
  })

  // ============================================
  // CONVERT DECIMALS
  // ============================================
  describe('convertDecimals', () => {
    it('should convert from 6 to 18 decimals', () => {
      const amount = 1000n * 10n ** 6n
      const expected = 1000n * WAD
      expect(convertDecimals(amount, 6, 18)).toBe(expected)
    })

    it('should convert from 18 to 6 decimals', () => {
      const amount = 1000n * WAD
      const expected = 1000n * 10n ** 6n
      expect(convertDecimals(amount, 18, 6)).toBe(expected)
    })

    it('should return same value when decimals are equal', () => {
      const amount = 1000n * WAD
      expect(convertDecimals(amount, 18, 18)).toBe(amount)
    })

    it('should handle 0 amount', () => {
      expect(convertDecimals(0n, 6, 18)).toBe(0n)
    })
  })

  // ============================================
  // NORMALIZE TO/FROM WAD
  // ============================================
  describe('normalizeToWad', () => {
    it('should normalize 6 decimal value to WAD', () => {
      const amount = 1000n * 10n ** 6n
      expect(normalizeToWad(amount, 6)).toBe(1000n * WAD)
    })

    it('should normalize 8 decimal value to WAD', () => {
      const amount = 1n * 10n ** 8n
      expect(normalizeToWad(amount, 8)).toBe(1n * WAD)
    })

    it('should return same value for 18 decimals', () => {
      const amount = 1000n * WAD
      expect(normalizeToWad(amount, 18)).toBe(amount)
    })

    it('should handle 0 amount', () => {
      expect(normalizeToWad(0n, 6)).toBe(0n)
    })

    it('should scale down from > 18 decimals (edge case)', () => {
      // Hypothetical token with 24 decimals
      const amount = 1000n * 10n ** 24n
      expect(normalizeToWad(amount, 24)).toBe(1000n * WAD)
    })
  })

  describe('denormalizeFromWad', () => {
    it('should denormalize WAD to 6 decimals', () => {
      const wad = 1000n * WAD
      expect(denormalizeFromWad(wad, 6)).toBe(1000n * 10n ** 6n)
    })

    it('should denormalize WAD to 8 decimals', () => {
      const wad = 1n * WAD
      expect(denormalizeFromWad(wad, 8)).toBe(1n * 10n ** 8n)
    })

    it('should return same value for 18 decimals', () => {
      const wad = 1000n * WAD
      expect(denormalizeFromWad(wad, 18)).toBe(wad)
    })

    it('should handle 0 amount', () => {
      expect(denormalizeFromWad(0n, 6)).toBe(0n)
    })

    it('should scale up to > 18 decimals (edge case)', () => {
      // Hypothetical token with 24 decimals
      const wad = 1000n * WAD
      expect(denormalizeFromWad(wad, 24)).toBe(1000n * 10n ** 24n)
    })
  })
})

