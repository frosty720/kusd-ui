/**
 * Comprehensive tests for formatting.ts
 * 100% coverage for all formatting functions
 */

import { describe, it, expect } from 'vitest'
import {
  formatWAD,
  formatRAY,
  formatRAD,
  parseWAD,
  parseRAY,
  parseRAD,
  formatTokenAmount,
  parseTokenAmount,
  formatCurrency,
  formatCurrencyFromWAD,
  formatPercent,
  formatPercentFromBps,
  formatAPYFromRate,
  formatCollateralRatio,
  formatCompact,
  formatCompactFromWAD,
  formatAddress,
  formatTxHash,
  formatDuration,
  formatDate,
  formatDateTime,
  formatNumber,
  formatNumberFromWAD,
  truncateDecimals,
  formatInputValue,
} from '../formatting'
import { WAD, RAY, RAD } from '../constants'

describe('formatting.ts', () => {
  // ============================================
  // FORMAT WAD/RAY/RAD
  // ============================================
  describe('formatWAD', () => {
    it('should format WAD values correctly with default 2 decimals', () => {
      expect(formatWAD(1000n * WAD)).toBe('1000.00')
      expect(formatWAD(WAD)).toBe('1.00')
      expect(formatWAD(0n)).toBe('0.00')
    })

    it('should format with specified decimals', () => {
      expect(formatWAD(WAD / 2n, 2)).toBe('0.50')
      expect(formatWAD((15n * WAD) / 10n, 2)).toBe('1.50')
      expect(formatWAD(1000n * WAD, 0)).toBe('1000')
    })

    it('should handle negative values', () => {
      expect(formatWAD(-1000n * WAD)).toBe('-1000.00')
    })
  })

  describe('formatRAY', () => {
    it('should format RAY values correctly with default 4 decimals', () => {
      expect(formatRAY(1000n * RAY)).toBe('1000.0000')
      expect(formatRAY(RAY)).toBe('1.0000')
      expect(formatRAY(0n)).toBe('0.0000')
    })

    it('should format with specified decimals', () => {
      expect(formatRAY(RAY / 2n, 2)).toBe('0.50')
    })
  })

  describe('formatRAD', () => {
    it('should format RAD values correctly with default 2 decimals', () => {
      expect(formatRAD(1000n * RAD)).toBe('1000.00')
      expect(formatRAD(RAD)).toBe('1.00')
      expect(formatRAD(0n)).toBe('0.00')
    })

    it('should format with specified decimals', () => {
      expect(formatRAD(RAD / 2n, 2)).toBe('0.50')
    })
  })

  // ============================================
  // PARSE WAD/RAY/RAD
  // ============================================
  describe('parseWAD', () => {
    it('should parse string to WAD', () => {
      expect(parseWAD('1000')).toBe(1000n * WAD)
      expect(parseWAD('1')).toBe(WAD)
      expect(parseWAD('0')).toBe(0n)
    })

    it('should parse decimals', () => {
      expect(parseWAD('0.5')).toBe(WAD / 2n)
      expect(parseWAD('1.5')).toBe((15n * WAD) / 10n)
    })

    it('should handle empty string', () => {
      expect(parseWAD('')).toBe(0n)
    })
  })

  describe('parseRAY', () => {
    it('should parse string to RAY', () => {
      expect(parseRAY('1000')).toBe(1000n * RAY)
      expect(parseRAY('1')).toBe(RAY)
      expect(parseRAY('0')).toBe(0n)
    })

    it('should handle empty string', () => {
      expect(parseRAY('')).toBe(0n)
    })
  })

  describe('parseRAD', () => {
    it('should parse string to RAD', () => {
      expect(parseRAD('1000')).toBe(1000n * RAD)
      expect(parseRAD('1')).toBe(RAD)
      expect(parseRAD('0')).toBe(0n)
    })

    it('should handle empty string', () => {
      expect(parseRAD('')).toBe(0n)
    })
  })

  // ============================================
  // TOKEN AMOUNT FORMATTING
  // ============================================
  describe('formatTokenAmount', () => {
    it('should format token amounts with default 2 decimals', () => {
      expect(formatTokenAmount(1000n * WAD, 'WETH')).toBe('1000.00')
      expect(formatTokenAmount(WAD, 'KUSD')).toBe('1.00')
    })

    it('should format with specified decimals', () => {
      expect(formatTokenAmount(WAD / 2n, 'WETH', 2)).toBe('0.50')
    })

    it('should handle 0 amount', () => {
      expect(formatTokenAmount(0n, 'WETH')).toBe('0.00')
    })

    it('should fallback to 18 decimals for unknown tokens', () => {
      // Unknown token should use 18 decimals (WAD)
      expect(formatTokenAmount(WAD, 'UNKNOWN_TOKEN')).toBe('1.00')
    })
  })

  describe('parseTokenAmount', () => {
    it('should parse token amounts', () => {
      expect(parseTokenAmount('1000', 'WETH')).toBe(1000n * WAD)
      expect(parseTokenAmount('1', 'KUSD')).toBe(WAD)
    })

    it('should handle empty string', () => {
      expect(parseTokenAmount('', 'WETH')).toBe(0n)
    })

    it('should fallback to 18 decimals for unknown tokens', () => {
      // Unknown token should use 18 decimals (WAD)
      expect(parseTokenAmount('1', 'UNKNOWN_TOKEN')).toBe(WAD)
    })
  })

  // ============================================
  // CURRENCY FORMATTING
  // ============================================
  describe('formatCurrency', () => {
    it('should format currency values', () => {
      expect(formatCurrency(1000)).toBe('$1,000.00')
      expect(formatCurrency(1234.56)).toBe('$1,234.56')
    })

    it('should handle 0', () => {
      expect(formatCurrency(0)).toBe('$0.00')
    })
  })

  describe('formatCurrencyFromWAD', () => {
    it('should format WAD to currency', () => {
      expect(formatCurrencyFromWAD(1000n * WAD)).toBe('$1,000.00')
      expect(formatCurrencyFromWAD(WAD)).toBe('$1.00')
    })

    it('should handle 0', () => {
      expect(formatCurrencyFromWAD(0n)).toBe('$0.00')
    })
  })

  // ============================================
  // PERCENT FORMATTING
  // ============================================
  describe('formatPercent', () => {
    it('should format percent values with default 2 decimals', () => {
      expect(formatPercent(50)).toBe('50.00%')
      expect(formatPercent(100)).toBe('100.00%')
    })

    it('should format with specified decimals', () => {
      expect(formatPercent(50.5, 1)).toBe('50.5%')
    })

    it('should handle 0', () => {
      expect(formatPercent(0)).toBe('0.00%')
    })
  })

  describe('formatPercentFromBps', () => {
    it('should format basis points to percent with default 2 decimals', () => {
      expect(formatPercentFromBps(5000n)).toBe('50.00%')
      expect(formatPercentFromBps(10000n)).toBe('100.00%')
    })

    it('should handle 0', () => {
      expect(formatPercentFromBps(0n)).toBe('0.00%')
    })
  })

  describe('formatAPYFromRate', () => {
    it('should format rate to APY with default 2 decimals', () => {
      // RAY = 0% APY
      expect(formatAPYFromRate(RAY)).toBe('0.00%')
    })

    it('should handle 0 rate', () => {
      expect(formatAPYFromRate(0n)).toBe('-100.00%')
    })
  })

  describe('formatCollateralRatio', () => {
    it('should format collateral ratio from basis points', () => {
      // formatCollateralRatio expects basis points (15000 = 150%)
      expect(formatCollateralRatio(20000n)).toBe('200.00%')
      expect(formatCollateralRatio(15000n)).toBe('150.00%')
    })

    it('should handle 0', () => {
      expect(formatCollateralRatio(0n)).toBe('0.00%')
    })
  })

  // ============================================
  // COMPACT FORMATTING
  // ============================================
  describe('formatCompact', () => {
    it('should format large numbers compactly with 2 decimals', () => {
      expect(formatCompact(1000)).toBe('1.00K')
      expect(formatCompact(1000000)).toBe('1.00M')
      expect(formatCompact(1000000000)).toBe('1.00B')
    })

    it('should handle small numbers with 2 decimals', () => {
      expect(formatCompact(100)).toBe('100.00')
      expect(formatCompact(0)).toBe('0.00')
    })
  })

  describe('formatCompactFromWAD', () => {
    it('should format WAD values compactly', () => {
      expect(formatCompactFromWAD(1000n * WAD)).toBe('1.00K')
      expect(formatCompactFromWAD(1000000n * WAD)).toBe('1.00M')
    })

    it('should handle 0', () => {
      expect(formatCompactFromWAD(0n)).toBe('0.00')
    })
  })

  // ============================================
  // ADDRESS/TX FORMATTING
  // ============================================
  describe('formatAddress', () => {
    it('should truncate address', () => {
      const addr = '0x1234567890abcdef1234567890abcdef12345678'
      expect(formatAddress(addr)).toBe('0x1234...5678')
    })

    it('should handle short addresses', () => {
      expect(formatAddress('0x1234')).toBe('0x1234')
    })
  })

  describe('formatTxHash', () => {
    it('should truncate transaction hash with 10 start and 8 end chars', () => {
      const hash = '0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890'
      expect(formatTxHash(hash)).toBe('0xabcdef12...34567890')
    })
  })

  // ============================================
  // DURATION FORMATTING
  // ============================================
  describe('formatDuration', () => {
    it('should format seconds to duration', () => {
      expect(formatDuration(60)).toBe('1m')
      expect(formatDuration(3600)).toBe('1h 0m')
      expect(formatDuration(86400)).toBe('1d 0h')
    })

    it('should handle 0', () => {
      expect(formatDuration(0)).toBe('0m')
    })

    it('should handle complex durations', () => {
      // Function only shows days+hours or hours+minutes, not seconds
      expect(formatDuration(3661)).toBe('1h 1m')
    })
  })

  // ============================================
  // DATE/TIME FORMATTING
  // ============================================
  describe('formatDate', () => {
    it('should format timestamp to date', () => {
      // formatDate takes a Unix timestamp (seconds), not a Date object
      const timestamp = 1705276800 // 2024-01-15 00:00:00 UTC
      const formatted = formatDate(timestamp)
      expect(formatted).toContain('2024')
    })
  })

  describe('formatDateTime', () => {
    it('should format timestamp to date and time', () => {
      // formatDateTime takes a Unix timestamp (seconds), not a Date object
      const timestamp = 1705321800 // 2024-01-15 12:30:00 UTC
      const formatted = formatDateTime(timestamp)
      expect(formatted).toContain('2024')
    })
  })

  // ============================================
  // NUMBER FORMATTING
  // ============================================
  describe('formatNumber', () => {
    it('should format numbers with commas and default 2 decimals', () => {
      expect(formatNumber(1000)).toBe('1,000.00')
      expect(formatNumber(1234567)).toBe('1,234,567.00')
    })

    it('should format with specified decimals', () => {
      expect(formatNumber(1234.56, 2)).toBe('1,234.56')
    })

    it('should handle 0', () => {
      expect(formatNumber(0)).toBe('0.00')
    })
  })

  describe('formatNumberFromWAD', () => {
    it('should format WAD to number string with default 2 decimals', () => {
      expect(formatNumberFromWAD(1000n * WAD)).toBe('1,000.00')
      expect(formatNumberFromWAD(WAD)).toBe('1.00')
    })

    it('should handle 0', () => {
      expect(formatNumberFromWAD(0n)).toBe('0.00')
    })
  })

  // ============================================
  // UTILITY FUNCTIONS
  // ============================================
  describe('truncateDecimals', () => {
    it('should truncate decimals', () => {
      expect(truncateDecimals('1.123456789', 4)).toBe('1.1234')
      expect(truncateDecimals('1.12', 4)).toBe('1.12')
    })

    it('should handle no decimals', () => {
      expect(truncateDecimals('1000', 4)).toBe('1000')
    })
  })

  describe('formatInputValue', () => {
    it('should format input values', () => {
      expect(formatInputValue('1000')).toBe('1000')
      expect(formatInputValue('1.5')).toBe('1.5')
    })

    it('should handle empty string', () => {
      expect(formatInputValue('')).toBe('')
    })

    it('should handle invalid input', () => {
      expect(formatInputValue('abc')).toBe('')
    })

    it('should handle multiple decimal points', () => {
      // Line 261: multiple decimal points
      expect(formatInputValue('1.2.3')).toBe('1.23')
      expect(formatInputValue('1.2.3.4')).toBe('1.234')
    })

    it('should limit decimal places', () => {
      // Line 266: limit decimal places
      expect(formatInputValue('1.12345678901234567890', 4)).toBe('1.1234')
    })

    it('should remove leading zeros', () => {
      // Line 271: remove leading zeros
      expect(formatInputValue('007')).toBe('7')
      expect(formatInputValue('00123')).toBe('123')
    })

    it('should preserve 0. prefix', () => {
      expect(formatInputValue('0.5')).toBe('0.5')
      expect(formatInputValue('0.123')).toBe('0.123')
    })
  })
})

