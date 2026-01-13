/**
 * Comprehensive tests for constants.ts
 * 100% coverage for all constants and the stringToBytes32 function
 */

import { describe, it, expect } from 'vitest'
import {
  WAD,
  RAY,
  RAD,
  ZERO,
  ONE_WAD,
  ONE_RAY,
  ONE_RAD,
  stringToBytes32,
  ILK_WBTC_A,
  ILK_WETH_A,
  ILK_USDT_A,
  ILK_USDC_A,
  ILK_DAI_A,
  COLLATERAL_ILKS,
  ILK_TO_SYMBOL,
  TOKEN_DECIMALS,
  MIN_VAULT_AMOUNT,
  SECONDS_PER_YEAR,
  BPS_BASE,
  PERCENT_BASE,
  DEFAULT_SLIPPAGE_BPS,
  DEFAULT_DEADLINE_MINUTES,
} from '../constants'

describe('constants.ts', () => {
  // ============================================
  // PRECISION CONSTANTS
  // ============================================
  describe('Precision Constants', () => {
    it('should have correct WAD value (10^18)', () => {
      expect(WAD).toBe(10n ** 18n)
      expect(WAD).toBe(1000000000000000000n)
    })

    it('should have correct RAY value (10^27)', () => {
      expect(RAY).toBe(10n ** 27n)
      expect(RAY).toBe(1000000000000000000000000000n)
    })

    it('should have correct RAD value (10^45)', () => {
      expect(RAD).toBe(10n ** 45n)
      expect(RAD).toBe(1000000000000000000000000000000000000000000000n)
    })

    it('should have ZERO equal to 0n', () => {
      expect(ZERO).toBe(0n)
    })

    it('should have ONE_WAD equal to WAD', () => {
      expect(ONE_WAD).toBe(WAD)
    })

    it('should have ONE_RAY equal to RAY', () => {
      expect(ONE_RAY).toBe(RAY)
    })

    it('should have ONE_RAD equal to RAD', () => {
      expect(ONE_RAD).toBe(RAD)
    })
  })

  // ============================================
  // STRING TO BYTES32
  // ============================================
  describe('stringToBytes32', () => {
    it('should convert short string to bytes32', () => {
      const result = stringToBytes32('WBTC-A')
      expect(result).toMatch(/^0x[0-9a-f]{64}$/)
      // First 6 characters should be 'WBTC-A' in hex
      expect(result.slice(2, 14)).toBe('574254432d41') // WBTC-A in hex
    })

    it('should pad with null bytes', () => {
      const result = stringToBytes32('A')
      // 'A' = 0x41, rest should be 0x00
      expect(result.slice(2, 4)).toBe('41')
      expect(result.slice(4)).toBe('00'.repeat(31))
    })

    it('should handle empty string', () => {
      const result = stringToBytes32('')
      expect(result).toBe('0x' + '00'.repeat(32))
    })

    it('should handle 32 character string', () => {
      const str = 'A'.repeat(32)
      const result = stringToBytes32(str)
      expect(result).toBe('0x' + '41'.repeat(32))
    })
  })

  // ============================================
  // COLLATERAL TYPE IDENTIFIERS
  // ============================================
  describe('Collateral Type Identifiers', () => {
    it('should have correct ILK_WBTC_A', () => {
      expect(ILK_WBTC_A).toMatch(/^0x[0-9a-f]{64}$/)
      expect(ILK_WBTC_A).toBe(stringToBytes32('WBTC-A'))
    })

    it('should have correct ILK_WETH_A', () => {
      expect(ILK_WETH_A).toBe(stringToBytes32('WETH-A'))
    })

    it('should have correct ILK_USDT_A', () => {
      expect(ILK_USDT_A).toBe(stringToBytes32('USDT-A'))
    })

    it('should have correct ILK_USDC_A', () => {
      expect(ILK_USDC_A).toBe(stringToBytes32('USDC-A'))
    })

    it('should have correct ILK_DAI_A', () => {
      expect(ILK_DAI_A).toBe(stringToBytes32('DAI-A'))
    })
  })

  // ============================================
  // COLLATERAL MAPPINGS
  // ============================================
  describe('Collateral Mappings', () => {
    it('should have correct COLLATERAL_ILKS mapping', () => {
      expect(COLLATERAL_ILKS['WBTC-A']).toBe(ILK_WBTC_A)
      expect(COLLATERAL_ILKS['WETH-A']).toBe(ILK_WETH_A)
      expect(COLLATERAL_ILKS['USDT-A']).toBe(ILK_USDT_A)
      expect(COLLATERAL_ILKS['USDC-A']).toBe(ILK_USDC_A)
      expect(COLLATERAL_ILKS['DAI-A']).toBe(ILK_DAI_A)
    })

    it('should have correct ILK_TO_SYMBOL reverse mapping', () => {
      expect(ILK_TO_SYMBOL[ILK_WBTC_A]).toBe('WBTC-A')
      expect(ILK_TO_SYMBOL[ILK_WETH_A]).toBe('WETH-A')
      expect(ILK_TO_SYMBOL[ILK_USDT_A]).toBe('USDT-A')
      expect(ILK_TO_SYMBOL[ILK_USDC_A]).toBe('USDC-A')
      expect(ILK_TO_SYMBOL[ILK_DAI_A]).toBe('DAI-A')
    })
  })

  // ============================================
  // TOKEN DECIMALS
  // ============================================
  describe('Token Decimals', () => {
    it('should have correct decimals for each token', () => {
      expect(TOKEN_DECIMALS['WBTC']).toBe(8)
      expect(TOKEN_DECIMALS['WETH']).toBe(18)
      expect(TOKEN_DECIMALS['USDT']).toBe(6)
      expect(TOKEN_DECIMALS['USDC']).toBe(6)
      expect(TOKEN_DECIMALS['DAI']).toBe(18)
      expect(TOKEN_DECIMALS['KUSD']).toBe(18)
      expect(TOKEN_DECIMALS['sKLC']).toBe(18)
      expect(TOKEN_DECIMALS['KLC']).toBe(18)
    })
  })

  // ============================================
  // OTHER CONSTANTS
  // ============================================
  describe('Other Constants', () => {
    it('should have correct MIN_VAULT_AMOUNT', () => {
      expect(MIN_VAULT_AMOUNT).toBe(100n * WAD)
    })

    it('should have correct SECONDS_PER_YEAR', () => {
      expect(SECONDS_PER_YEAR).toBe(365n * 24n * 60n * 60n)
      expect(SECONDS_PER_YEAR).toBe(31536000n)
    })

    it('should have correct BPS_BASE', () => {
      expect(BPS_BASE).toBe(10000n)
    })

    it('should have correct PERCENT_BASE', () => {
      expect(PERCENT_BASE).toBe(100n)
    })

    it('should have correct DEFAULT_SLIPPAGE_BPS', () => {
      expect(DEFAULT_SLIPPAGE_BPS).toBe(50n)
    })

    it('should have correct DEFAULT_DEADLINE_MINUTES', () => {
      expect(DEFAULT_DEADLINE_MINUTES).toBe(20n)
    })
  })
})

