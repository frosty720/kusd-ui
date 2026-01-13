/**
 * Comprehensive tests for calculations.ts
 * 100% coverage for all CDP and DeFi calculation functions
 */

import { describe, it, expect } from 'vitest'
import {
  calculateCollateralRatio,
  calculateLiquidationPrice,
  calculateMaxMint,
  calculateMaxWithdraw,
  calculateHealthFactor,
  calculateAccruedFees,
  calculateTotalDebt,
  calculateDSREarnings,
  calculateAuctionPrice,
  calculateRequiredCollateral,
  calculateCollateralValue,
  isPositionSafe,
  calculateLiquidationPenalty,
  calculateNormalizedDebt,
} from '../calculations'
import { WAD, RAY } from '../constants'

describe('calculations.ts', () => {
  // ============================================
  // COLLATERAL RATIO
  // ============================================
  describe('calculateCollateralRatio', () => {
    it('should calculate collateral ratio correctly', () => {
      // 10 ETH at $2000 = $20,000 collateral
      // $10,000 debt = 200% collateral ratio
      const collateral = 10n * WAD // 10 ETH
      const price = 2000n * WAD // $2000 per ETH
      const debt = 10000n * WAD // $10,000 debt

      const ratio = calculateCollateralRatio(collateral, price, debt)
      expect(ratio).toBe(2n * WAD) // 2.0 = 200%
    })

    it('should return 0 when debt is 0', () => {
      const collateral = 10n * WAD
      const price = 2000n * WAD
      const debt = 0n

      expect(calculateCollateralRatio(collateral, price, debt)).toBe(0n)
    })

    it('should handle 150% collateral ratio', () => {
      // $15,000 collateral / $10,000 debt = 150%
      const collateral = 75n * WAD / 10n // 7.5 ETH
      const price = 2000n * WAD // $2000 per ETH
      const debt = 10000n * WAD // $10,000 debt

      const ratio = calculateCollateralRatio(collateral, price, debt)
      expect(ratio).toBe((15n * WAD) / 10n) // 1.5 = 150%
    })

    it('should handle under-collateralized positions', () => {
      // $8,000 collateral / $10,000 debt = 80%
      const collateral = 4n * WAD // 4 ETH
      const price = 2000n * WAD // $2000 per ETH
      const debt = 10000n * WAD // $10,000 debt

      const ratio = calculateCollateralRatio(collateral, price, debt)
      expect(ratio).toBe((8n * WAD) / 10n) // 0.8 = 80%
    })

    it('should handle 0 collateral', () => {
      const collateral = 0n
      const price = 2000n * WAD
      const debt = 10000n * WAD

      expect(calculateCollateralRatio(collateral, price, debt)).toBe(0n)
    })
  })

  // ============================================
  // LIQUIDATION PRICE
  // ============================================
  describe('calculateLiquidationPrice', () => {
    it('should calculate liquidation price correctly', () => {
      // 10 ETH collateral, $10,000 debt, 150% liquidation ratio
      // Liquidation price = (debt * ratio) / collateral
      // = (10000 * 1.5) / 10 = $1500
      const collateral = 10n * WAD
      const debt = 10000n * WAD
      const liquidationRatio = (15n * WAD) / 10n // 1.5 = 150%

      const liqPrice = calculateLiquidationPrice(collateral, debt, liquidationRatio)
      expect(liqPrice).toBe(1500n * WAD)
    })

    it('should return 0 when collateral is 0', () => {
      const collateral = 0n
      const debt = 10000n * WAD
      const liquidationRatio = (15n * WAD) / 10n

      expect(calculateLiquidationPrice(collateral, debt, liquidationRatio)).toBe(0n)
    })

    it('should handle 0 debt (no liquidation risk)', () => {
      const collateral = 10n * WAD
      const debt = 0n
      const liquidationRatio = (15n * WAD) / 10n

      expect(calculateLiquidationPrice(collateral, debt, liquidationRatio)).toBe(0n)
    })

    it('should calculate for different liquidation ratios', () => {
      const collateral = 10n * WAD
      const debt = 10000n * WAD

      // 200% ratio -> $2000 liquidation price
      expect(calculateLiquidationPrice(collateral, debt, 2n * WAD)).toBe(2000n * WAD)

      // 110% ratio -> $1100 liquidation price
      expect(calculateLiquidationPrice(collateral, debt, (11n * WAD) / 10n)).toBe(1100n * WAD)
    })
  })

  // ============================================
  // MAX MINT
  // ============================================
  describe('calculateMaxMint', () => {
    it('should calculate max mintable amount', () => {
      // 10 ETH at $2000 = $20,000 collateral value
      // With 150% ratio, max debt = $20,000 / 1.5 = $13,333.33
      // Current debt = $5,000
      // Available = $13,333.33 - $5,000 = $8,333.33
      const collateral = 10n * WAD
      const price = 2000n * WAD
      const liquidationRatio = (15n * WAD) / 10n
      const currentDebt = 5000n * WAD

      const maxMint = calculateMaxMint(collateral, price, liquidationRatio, currentDebt)
      // 20000 / 1.5 - 5000 = 13333.33 - 5000 = 8333.33
      const expected = (((20000n * WAD) * WAD) / ((15n * WAD) / 10n)) - 5000n * WAD
      expect(maxMint).toBe(expected)
    })

    it('should return 0 when liquidation ratio is 0', () => {
      const collateral = 10n * WAD
      const price = 2000n * WAD
      const liquidationRatio = 0n
      const currentDebt = 5000n * WAD

      expect(calculateMaxMint(collateral, price, liquidationRatio, currentDebt)).toBe(0n)
    })

    it('should return 0 when already at max debt', () => {
      const collateral = 10n * WAD
      const price = 2000n * WAD
      const liquidationRatio = (15n * WAD) / 10n
      const currentDebt = 15000n * WAD // At max capacity

      expect(calculateMaxMint(collateral, price, liquidationRatio, currentDebt)).toBe(0n)
    })

    it('should respect debt ceiling constraint', () => {
      const collateral = 100n * WAD // Lots of collateral
      const price = 2000n * WAD
      const liquidationRatio = (15n * WAD) / 10n
      const currentDebt = 0n
      // Note: The function treats ceiling/total in the same units as collateral-based max (WAD)
      // In practice, the caller should convert RAD to WAD before passing
      const debtCeiling = 50000n * WAD // 50,000 ceiling in WAD
      const totalDebt = 40000n * WAD // 40,000 current in WAD

      // Only 10,000 available from ceiling, even though collateral allows more
      const maxMint = calculateMaxMint(collateral, price, liquidationRatio, currentDebt, debtCeiling, totalDebt)
      expect(maxMint).toBe(10000n * WAD) // Limited by ceiling
    })

    it('should return 0 when debt ceiling is reached', () => {
      const collateral = 100n * WAD
      const price = 2000n * WAD
      const liquidationRatio = (15n * WAD) / 10n
      const currentDebt = 0n
      const debtCeiling = 50000n * WAD
      const totalDebt = 50000n * WAD // At ceiling

      expect(calculateMaxMint(collateral, price, liquidationRatio, currentDebt, debtCeiling, totalDebt)).toBe(0n)
    })

    it('should ignore debt ceiling when set to 0', () => {
      const collateral = 10n * WAD
      const price = 2000n * WAD
      const liquidationRatio = (15n * WAD) / 10n
      const currentDebt = 0n
      const debtCeiling = 0n
      const totalDebt = 0n

      const maxMint = calculateMaxMint(collateral, price, liquidationRatio, currentDebt, debtCeiling, totalDebt)
      // Should use collateral-based calculation
      expect(maxMint).toBeGreaterThan(0n)
    })
  })

  // ============================================
  // MAX WITHDRAW
  // ============================================
  describe('calculateMaxWithdraw', () => {
    it('should calculate max withdrawable collateral', () => {
      // 10 ETH at $2000 = $20,000 collateral
      // $10,000 debt with 150% ratio requires $15,000 collateral (7.5 ETH)
      // Max withdraw = 10 - 7.5 = 2.5 ETH
      const collateral = 10n * WAD
      const debt = 10000n * WAD
      const price = 2000n * WAD
      const liquidationRatio = (15n * WAD) / 10n

      const maxWithdraw = calculateMaxWithdraw(collateral, debt, price, liquidationRatio)
      // Required value = 10000 * 1.5 = 15000
      // Required collateral = 15000 / 2000 = 7.5
      // Max withdraw = 10 - 7.5 = 2.5
      expect(maxWithdraw).toBe((25n * WAD) / 10n)
    })

    it('should return all collateral when no debt', () => {
      const collateral = 10n * WAD
      const debt = 0n
      const price = 2000n * WAD
      const liquidationRatio = (15n * WAD) / 10n

      expect(calculateMaxWithdraw(collateral, debt, price, liquidationRatio)).toBe(collateral)
    })

    it('should return 0 when price is 0', () => {
      const collateral = 10n * WAD
      const debt = 10000n * WAD
      const price = 0n
      const liquidationRatio = (15n * WAD) / 10n

      expect(calculateMaxWithdraw(collateral, debt, price, liquidationRatio)).toBe(0n)
    })

    it('should return 0 when at liquidation threshold', () => {
      // Exactly at 150% ratio - can't withdraw anything
      const collateral = 75n * WAD / 10n // 7.5 ETH
      const debt = 10000n * WAD
      const price = 2000n * WAD
      const liquidationRatio = (15n * WAD) / 10n

      expect(calculateMaxWithdraw(collateral, debt, price, liquidationRatio)).toBe(0n)
    })

    it('should return 0 when under-collateralized', () => {
      const collateral = 5n * WAD // Only $10,000 value
      const debt = 10000n * WAD // Needs $15,000 value at 150%
      const price = 2000n * WAD
      const liquidationRatio = (15n * WAD) / 10n

      expect(calculateMaxWithdraw(collateral, debt, price, liquidationRatio)).toBe(0n)
    })
  })

  // ============================================
  // HEALTH FACTOR
  // ============================================
  describe('calculateHealthFactor', () => {
    it('should calculate health factor correctly', () => {
      // 200% collateral ratio / 150% liquidation ratio = 1.33 health factor
      const collateralRatio = 2n * WAD // 200%
      const liquidationRatio = (15n * WAD) / 10n // 150%

      const healthFactor = calculateHealthFactor(collateralRatio, liquidationRatio)
      // 2 / 1.5 = 1.333...
      expect(healthFactor).toBe((4n * WAD) / 3n)
    })

    it('should return WAD when liquidation ratio is 0', () => {
      const collateralRatio = 2n * WAD
      const liquidationRatio = 0n

      expect(calculateHealthFactor(collateralRatio, liquidationRatio)).toBe(WAD)
    })

    it('should return 1 when at liquidation threshold', () => {
      const collateralRatio = (15n * WAD) / 10n // 150%
      const liquidationRatio = (15n * WAD) / 10n // 150%

      expect(calculateHealthFactor(collateralRatio, liquidationRatio)).toBe(WAD)
    })

    it('should return < 1 when under liquidation threshold', () => {
      const collateralRatio = (12n * WAD) / 10n // 120%
      const liquidationRatio = (15n * WAD) / 10n // 150%

      const healthFactor = calculateHealthFactor(collateralRatio, liquidationRatio)
      expect(healthFactor).toBeLessThan(WAD)
    })
  })

  // ============================================
  // ACCRUED FEES
  // ============================================
  describe('calculateAccruedFees', () => {
    it('should calculate accrued fees correctly', () => {
      // 10,000 normalized debt with 5% rate accumulator
      const normalizedDebt = 10000n * WAD
      const rate = RAY + (RAY * 5n) / 100n // 1.05 RAY

      const fees = calculateAccruedFees(normalizedDebt, rate)
      // Total debt = 10000 * 1.05 = 10500
      // Fees = 10500 - 10000 = 500
      expect(fees).toBe(500n * WAD)
    })

    it('should return 0 when rate is RAY (no fees)', () => {
      const normalizedDebt = 10000n * WAD
      const rate = RAY

      expect(calculateAccruedFees(normalizedDebt, rate)).toBe(0n)
    })

    it('should return 0 when rate is below RAY', () => {
      const normalizedDebt = 10000n * WAD
      const rate = RAY - 1n

      expect(calculateAccruedFees(normalizedDebt, rate)).toBe(0n)
    })

    it('should handle 0 debt', () => {
      const normalizedDebt = 0n
      const rate = RAY + (RAY * 5n) / 100n

      expect(calculateAccruedFees(normalizedDebt, rate)).toBe(0n)
    })
  })

  // ============================================
  // TOTAL DEBT
  // ============================================
  describe('calculateTotalDebt', () => {
    it('should calculate total debt correctly', () => {
      const normalizedDebt = 10000n * WAD
      const rate = RAY + (RAY * 5n) / 100n // 1.05 RAY

      const totalDebt = calculateTotalDebt(normalizedDebt, rate)
      expect(totalDebt).toBe(10500n * WAD)
    })

    it('should return normalized debt when rate is RAY', () => {
      const normalizedDebt = 10000n * WAD
      const rate = RAY

      expect(calculateTotalDebt(normalizedDebt, rate)).toBe(normalizedDebt)
    })

    it('should handle 0 debt', () => {
      const normalizedDebt = 0n
      const rate = RAY + (RAY * 5n) / 100n

      expect(calculateTotalDebt(normalizedDebt, rate)).toBe(0n)
    })
  })

  // ============================================
  // DSR EARNINGS
  // ============================================
  describe('calculateDSREarnings', () => {
    it('should calculate DSR earnings correctly', () => {
      // 10,000 deposit, chi went from 1.0 to 1.05
      const deposit = 10000n * WAD
      const initialChi = RAY // 1.0
      const currentChi = RAY + (RAY * 5n) / 100n // 1.05

      const earnings = calculateDSREarnings(deposit, currentChi, initialChi)
      // Current value = 10000 * 1.05 = 10500
      // Initial value = 10000 * 1.0 = 10000
      // Earnings = 500
      expect(earnings).toBe(500n * WAD)
    })

    it('should return 0 when chi has not increased', () => {
      const deposit = 10000n * WAD
      const initialChi = RAY
      const currentChi = RAY

      expect(calculateDSREarnings(deposit, currentChi, initialChi)).toBe(0n)
    })

    it('should return 0 when current chi is below initial', () => {
      const deposit = 10000n * WAD
      const initialChi = RAY
      const currentChi = RAY - 1n

      expect(calculateDSREarnings(deposit, currentChi, initialChi)).toBe(0n)
    })

    it('should handle 0 deposit', () => {
      const deposit = 0n
      const initialChi = RAY
      const currentChi = RAY + (RAY * 5n) / 100n

      expect(calculateDSREarnings(deposit, currentChi, initialChi)).toBe(0n)
    })
  })

  // ============================================
  // AUCTION PRICE
  // ============================================
  describe('calculateAuctionPrice', () => {
    it('should calculate auction price at start', () => {
      const startPrice = 2000n * RAY
      const elapsed = 0n
      const duration = 3600n // 1 hour

      expect(calculateAuctionPrice(startPrice, elapsed, duration)).toBe(startPrice)
    })

    it('should calculate auction price at halfway', () => {
      const startPrice = 2000n * RAY
      const elapsed = 1800n // 30 minutes
      const duration = 3600n // 1 hour

      const price = calculateAuctionPrice(startPrice, elapsed, duration)
      expect(price).toBe(1000n * RAY) // 50% of start price
    })

    it('should return 0 when auction expired', () => {
      const startPrice = 2000n * RAY
      const elapsed = 3600n // 1 hour
      const duration = 3600n // 1 hour

      expect(calculateAuctionPrice(startPrice, elapsed, duration)).toBe(0n)
    })

    it('should return 0 when elapsed exceeds duration', () => {
      const startPrice = 2000n * RAY
      const elapsed = 7200n // 2 hours
      const duration = 3600n // 1 hour

      expect(calculateAuctionPrice(startPrice, elapsed, duration)).toBe(0n)
    })

    it('should calculate price near end of auction', () => {
      const startPrice = 2000n * RAY
      const elapsed = 3500n // Near end
      const duration = 3600n // 1 hour

      const price = calculateAuctionPrice(startPrice, elapsed, duration)
      // Remaining: 100/3600 = ~2.78%
      const expected = (startPrice * 100n) / 3600n
      expect(price).toBe(expected)
    })
  })

  // ============================================
  // REQUIRED COLLATERAL
  // ============================================
  describe('calculateRequiredCollateral', () => {
    it('should calculate required collateral correctly', () => {
      // $10,000 debt at 150% ratio with $2000 ETH price
      // Required value = 10000 * 1.5 = 15000
      // Required collateral = 15000 / 2000 = 7.5 ETH
      const debt = 10000n * WAD
      const price = 2000n * WAD
      const liquidationRatio = (15n * WAD) / 10n

      const required = calculateRequiredCollateral(debt, price, liquidationRatio)
      expect(required).toBe((75n * WAD) / 10n)
    })

    it('should return 0 when price is 0', () => {
      const debt = 10000n * WAD
      const price = 0n
      const liquidationRatio = (15n * WAD) / 10n

      expect(calculateRequiredCollateral(debt, price, liquidationRatio)).toBe(0n)
    })

    it('should handle 0 debt', () => {
      const debt = 0n
      const price = 2000n * WAD
      const liquidationRatio = (15n * WAD) / 10n

      expect(calculateRequiredCollateral(debt, price, liquidationRatio)).toBe(0n)
    })
  })

  // ============================================
  // COLLATERAL VALUE
  // ============================================
  describe('calculateCollateralValue', () => {
    it('should calculate collateral value correctly', () => {
      const collateral = 10n * WAD // 10 ETH
      const price = 2000n * WAD // $2000 per ETH

      expect(calculateCollateralValue(collateral, price)).toBe(20000n * WAD)
    })

    it('should return 0 for 0 collateral', () => {
      const collateral = 0n
      const price = 2000n * WAD

      expect(calculateCollateralValue(collateral, price)).toBe(0n)
    })

    it('should return 0 for 0 price', () => {
      const collateral = 10n * WAD
      const price = 0n

      expect(calculateCollateralValue(collateral, price)).toBe(0n)
    })
  })

  // ============================================
  // POSITION SAFETY CHECK
  // ============================================
  describe('isPositionSafe', () => {
    it('should return true when above liquidation ratio', () => {
      const collateralRatio = 2n * WAD // 200%
      const liquidationRatio = (15n * WAD) / 10n // 150%

      expect(isPositionSafe(collateralRatio, liquidationRatio)).toBe(true)
    })

    it('should return true when at liquidation ratio', () => {
      const collateralRatio = (15n * WAD) / 10n // 150%
      const liquidationRatio = (15n * WAD) / 10n // 150%

      expect(isPositionSafe(collateralRatio, liquidationRatio)).toBe(true)
    })

    it('should return false when below liquidation ratio', () => {
      const collateralRatio = (12n * WAD) / 10n // 120%
      const liquidationRatio = (15n * WAD) / 10n // 150%

      expect(isPositionSafe(collateralRatio, liquidationRatio)).toBe(false)
    })
  })

  // ============================================
  // LIQUIDATION PENALTY
  // ============================================
  describe('calculateLiquidationPenalty', () => {
    it('should calculate liquidation penalty correctly', () => {
      // $10,000 debt with 13% penalty
      const debt = 10000n * WAD
      const penaltyBps = 1300n // 13%

      const penalty = calculateLiquidationPenalty(debt, penaltyBps)
      expect(penalty).toBe(1300n * WAD) // $1,300
    })

    it('should handle 0 penalty', () => {
      const debt = 10000n * WAD
      const penaltyBps = 0n

      expect(calculateLiquidationPenalty(debt, penaltyBps)).toBe(0n)
    })

    it('should handle 0 debt', () => {
      const debt = 0n
      const penaltyBps = 1300n

      expect(calculateLiquidationPenalty(debt, penaltyBps)).toBe(0n)
    })

    it('should calculate for different penalty rates', () => {
      const debt = 10000n * WAD

      // 5% penalty
      expect(calculateLiquidationPenalty(debt, 500n)).toBe(500n * WAD)

      // 10% penalty
      expect(calculateLiquidationPenalty(debt, 1000n)).toBe(1000n * WAD)
    })
  })

  // ============================================
  // NORMALIZED DEBT
  // ============================================
  describe('calculateNormalizedDebt', () => {
    it('should calculate normalized debt correctly', () => {
      // Total debt of 10,500 with 1.05 rate = 10,000 normalized
      const totalDebt = 10500n * WAD
      const rate = RAY + (RAY * 5n) / 100n // 1.05 RAY

      const normalized = calculateNormalizedDebt(totalDebt, rate)
      expect(normalized).toBe(10000n * WAD)
    })

    it('should return 0 when rate is 0', () => {
      const totalDebt = 10000n * WAD
      const rate = 0n

      expect(calculateNormalizedDebt(totalDebt, rate)).toBe(0n)
    })

    it('should return total debt when rate is RAY', () => {
      const totalDebt = 10000n * WAD
      const rate = RAY

      expect(calculateNormalizedDebt(totalDebt, rate)).toBe(totalDebt)
    })

    it('should handle 0 debt', () => {
      const totalDebt = 0n
      const rate = RAY + (RAY * 5n) / 100n

      expect(calculateNormalizedDebt(totalDebt, rate)).toBe(0n)
    })
  })
})
