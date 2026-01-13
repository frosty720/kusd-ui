/**
 * Contract Configuration Tests
 */

import { describe, it, expect } from 'vitest'
import {
  TESTNET_CONTRACTS,
  MAINNET_CONTRACTS,
  getContracts,
  getCollateral,
  getAllCollateralTypes,
  getCollateralDisplayName,
  areContractsDeployed,
  type CollateralType,
} from '../contracts'

describe('Contract Configuration', () => {
  describe('TESTNET_CONTRACTS', () => {
    it('should have all core contract addresses', () => {
      expect(TESTNET_CONTRACTS.core.vat).toBeDefined()
      expect(TESTNET_CONTRACTS.core.kusd).toBeDefined()
      expect(TESTNET_CONTRACTS.core.sklc).toBeDefined()
      expect(TESTNET_CONTRACTS.core.spotter).toBeDefined()
      expect(TESTNET_CONTRACTS.core.jug).toBeDefined()
      expect(TESTNET_CONTRACTS.core.pot).toBeDefined()
      expect(TESTNET_CONTRACTS.core.dog).toBeDefined()
      expect(TESTNET_CONTRACTS.core.vow).toBeDefined()
      expect(TESTNET_CONTRACTS.core.flapper).toBeDefined()
      expect(TESTNET_CONTRACTS.core.flopper).toBeDefined()
      expect(TESTNET_CONTRACTS.core.end).toBeDefined()
      expect(TESTNET_CONTRACTS.core.cure).toBeDefined()
      expect(TESTNET_CONTRACTS.core.kusdJoin).toBeDefined()
      expect(TESTNET_CONTRACTS.core.proxyRegistry).toBeDefined()
      expect(TESTNET_CONTRACTS.core.proxyFactory).toBeDefined()
      expect(TESTNET_CONTRACTS.core.proxyActions).toBeDefined()
    })

    it('should have valid address format for all core contracts', () => {
      const addressRegex = /^0x[a-fA-F0-9]{40}$/
      for (const [name, address] of Object.entries(TESTNET_CONTRACTS.core)) {
        expect(address).toMatch(addressRegex)
      }
    })

    it('should have all collateral types configured', () => {
      expect(TESTNET_CONTRACTS.collateral['WBTC-A']).toBeDefined()
      expect(TESTNET_CONTRACTS.collateral['WETH-A']).toBeDefined()
      expect(TESTNET_CONTRACTS.collateral['USDT-A']).toBeDefined()
      expect(TESTNET_CONTRACTS.collateral['USDC-A']).toBeDefined()
      expect(TESTNET_CONTRACTS.collateral['DAI-A']).toBeDefined()
    })

    it('should have correct decimals for each collateral', () => {
      expect(TESTNET_CONTRACTS.collateral['WBTC-A'].decimals).toBe(8)
      expect(TESTNET_CONTRACTS.collateral['WETH-A'].decimals).toBe(18)
      expect(TESTNET_CONTRACTS.collateral['USDT-A'].decimals).toBe(6)
      expect(TESTNET_CONTRACTS.collateral['USDC-A'].decimals).toBe(6)
      expect(TESTNET_CONTRACTS.collateral['DAI-A'].decimals).toBe(18)
    })

    it('should have valid ilk bytes32 for each collateral', () => {
      const ilkRegex = /^0x[a-fA-F0-9]{64}$/
      for (const [type, config] of Object.entries(TESTNET_CONTRACTS.collateral)) {
        expect(config.ilk).toMatch(ilkRegex)
      }
    })
  })

  describe('MAINNET_CONTRACTS', () => {
    it('should have all core contract addresses', () => {
      expect(MAINNET_CONTRACTS.core.vat).toBeDefined()
      expect(MAINNET_CONTRACTS.core.kusd).toBeDefined()
      expect(MAINNET_CONTRACTS.core.pot).toBeDefined()
    })

    it('should have different addresses from testnet', () => {
      expect(MAINNET_CONTRACTS.core.vat).not.toBe(TESTNET_CONTRACTS.core.vat)
      expect(MAINNET_CONTRACTS.core.kusd).not.toBe(TESTNET_CONTRACTS.core.kusd)
    })
  })

  describe('getContracts', () => {
    it('should return testnet contracts for chain ID 3889', () => {
      const contracts = getContracts(3889)
      expect(contracts).toBe(TESTNET_CONTRACTS)
    })

    it('should return mainnet contracts for chain ID 3888', () => {
      const contracts = getContracts(3888)
      expect(contracts).toBe(MAINNET_CONTRACTS)
    })

    it('should throw for unsupported chain ID', () => {
      expect(() => getContracts(1)).toThrow('Unsupported chain ID: 1')
      expect(() => getContracts(0)).toThrow('Unsupported chain ID: 0')
    })
  })

  describe('getCollateral', () => {
    it('should return correct collateral config', () => {
      const wbtc = getCollateral(3889, 'WBTC-A')
      expect(wbtc.symbol).toBe('WBTC')
      expect(wbtc.name).toBe('Wrapped Bitcoin')
      expect(wbtc.decimals).toBe(8)
    })

    it('should work for all collateral types', () => {
      const types: CollateralType[] = ['WBTC-A', 'WETH-A', 'USDT-A', 'USDC-A', 'DAI-A']
      for (const type of types) {
        const config = getCollateral(3889, type)
        expect(config.token).toBeDefined()
        expect(config.join).toBeDefined()
        expect(config.clipper).toBeDefined()
        expect(config.oracle).toBeDefined()
      }
    })
  })

  describe('getAllCollateralTypes', () => {
    it('should return all 5 collateral types', () => {
      const types = getAllCollateralTypes()
      expect(types).toHaveLength(5)
      expect(types).toContain('WBTC-A')
      expect(types).toContain('WETH-A')
      expect(types).toContain('USDT-A')
      expect(types).toContain('USDC-A')
      expect(types).toContain('DAI-A')
    })
  })

  describe('getCollateralDisplayName', () => {
    it('should extract symbol from collateral type', () => {
      expect(getCollateralDisplayName('WBTC-A')).toBe('WBTC')
      expect(getCollateralDisplayName('WETH-A')).toBe('WETH')
      expect(getCollateralDisplayName('USDT-A')).toBe('USDT')
      expect(getCollateralDisplayName('USDC-A')).toBe('USDC')
      expect(getCollateralDisplayName('DAI-A')).toBe('DAI')
    })
  })

  describe('areContractsDeployed', () => {
    it('should return true for testnet', () => {
      expect(areContractsDeployed(3889)).toBe(true)
    })

    it('should return true for mainnet', () => {
      expect(areContractsDeployed(3888)).toBe(true)
    })
  })
})

