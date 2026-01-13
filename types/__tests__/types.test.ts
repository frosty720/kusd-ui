/**
 * Type Definition Tests
 * 
 * These tests verify that type definitions are correctly structured
 * and can be used as expected.
 */

import { describe, it, expect } from 'vitest'
import type {
  Urn,
  Ilk,
  SpotIlk,
  PotData,
  Sale,
  AuctionStatus,
  FlapBid,
  FlopBid,
  TransactionStatus,
  TokenInfo,
  TokenBalance,
  CollateralSymbol,
  CollateralVariant,
  CollateralIlk,
  NetworkConfig,
  OraclePrice,
  SystemState,
} from '../contracts'
import type {
  CDPPosition,
  CDPActionType,
  CDPAction,
  CDPTransaction,
  CDPSummary,
  CollateralTypeInfo,
  CDPOperationResult,
  CDPValidation,
  DSRPosition,
  DSRAction,
  CollateralAuction,
  SurplusAuction,
  DebtAuction,
  UserPortfolio,
} from '../cdp'

describe('Type Definitions', () => {
  describe('Contract Types', () => {
    it('should create valid Urn object', () => {
      const urn: Urn = {
        ink: 1000000000000000000n,
        art: 500000000000000000n,
      }
      expect(urn.ink).toBe(1000000000000000000n)
      expect(urn.art).toBe(500000000000000000n)
    })

    it('should create valid Ilk object', () => {
      const ilk: Ilk = {
        Art: 1000n,
        rate: 10n ** 27n,
        spot: 10n ** 27n,
        line: 10n ** 45n,
        dust: 10n ** 45n,
      }
      expect(ilk.Art).toBe(1000n)
      expect(ilk.rate).toBe(10n ** 27n)
    })

    it('should create valid PotData object', () => {
      const pot: PotData = {
        pie: 100n,
        Pie: 1000000n,
        dsr: 10n ** 27n,
        chi: 10n ** 27n,
        rho: BigInt(Math.floor(Date.now() / 1000)),
      }
      expect(pot.dsr).toBeGreaterThan(0n)
    })

    it('should create valid TransactionStatus object', () => {
      const status: TransactionStatus = {
        hash: '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
        isPending: false,
        isConfirming: false,
        isSuccess: true,
        error: null,
      }
      expect(status.isSuccess).toBe(true)
    })

    it('should create valid TokenInfo object', () => {
      const token: TokenInfo = {
        address: '0x1234567890123456789012345678901234567890',
        symbol: 'WBTC',
        name: 'Wrapped Bitcoin',
        decimals: 8,
      }
      expect(token.symbol).toBe('WBTC')
    })

    it('should validate CollateralIlk type combinations', () => {
      const validIlks: CollateralIlk[] = ['WBTC-A', 'WETH-A', 'USDT-A', 'USDC-A', 'DAI-A']
      expect(validIlks).toHaveLength(5)
    })
  })

  describe('CDP Types', () => {
    it('should create valid CDPPosition object', () => {
      const position: CDPPosition = {
        owner: '0x1234567890123456789012345678901234567890',
        ilk: 'WBTC-A',
        collateral: 10n ** 18n,
        collateralValue: 50000n * 10n ** 18n,
        normalizedDebt: 10n ** 18n,
        totalDebt: 10n ** 18n,
        accruedFees: 0n,
        collateralRatio: 15n * 10n ** 17n,
        liquidationRatio: 15n * 10n ** 26n,
        liquidationPrice: 30000n * 10n ** 18n,
        currentPrice: 50000n * 10n ** 18n,
        healthFactor: 10n ** 18n,
        isSafe: true,
        isLiquidatable: false,
        maxMint: 10000n * 10n ** 18n,
        maxWithdraw: 5n * 10n ** 17n,
        minDebt: 100n * 10n ** 45n,
        hasPosition: true,
        isLoading: false,
      }
      expect(position.isSafe).toBe(true)
      expect(position.hasPosition).toBe(true)
    })

    it('should validate CDPActionType values', () => {
      const actions: CDPActionType[] = [
        'deposit',
        'withdraw',
        'mint',
        'repay',
        'depositAndMint',
        'repayAndWithdraw',
      ]
      expect(actions).toHaveLength(6)
    })

    it('should create valid DSRPosition object', () => {
      const dsr: DSRPosition = {
        owner: '0x1234567890123456789012345678901234567890',
        deposit: 1000n * 10n ** 18n,
        currentValue: 1050n * 10n ** 18n,
        earnings: 50n * 10n ** 18n,
        apy: 5.0,
        isLoading: false,
      }
      expect(dsr.earnings).toBe(50n * 10n ** 18n)
    })

    it('should create valid UserPortfolio object', () => {
      const portfolio: UserPortfolio = {
        address: '0x1234567890123456789012345678901234567890',
        klcBalance: 10n ** 18n,
        sklcBalance: 0n,
        kusdBalance: 1000n * 10n ** 18n,
        cdps: [],
        totalCollateralValue: 50000n * 10n ** 18n,
        totalDebt: 20000n * 10n ** 18n,
        dsrDeposit: 1000n * 10n ** 18n,
        dsrValue: 1050n * 10n ** 18n,
        dsrEarnings: 50n * 10n ** 18n,
        overallCollateralRatio: 25n * 10n ** 17n,
        overallHealthFactor: 10n ** 18n,
        isHealthy: true,
      }
      expect(portfolio.isHealthy).toBe(true)
    })
  })
})

