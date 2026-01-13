/**
 * Network Configuration Tests
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  kalyChainTestnet,
  kalyChainMainnet,
  NETWORKS,
  DEFAULT_NETWORK,
  getCurrentNetwork,
} from '../networks'

describe('Network Configuration', () => {
  describe('kalyChainTestnet', () => {
    it('should have correct chain ID', () => {
      expect(kalyChainTestnet.id).toBe(3889)
    })

    it('should have correct name', () => {
      expect(kalyChainTestnet.name).toBe('KalyChain Testnet')
    })

    it('should have correct native currency', () => {
      expect(kalyChainTestnet.nativeCurrency.name).toBe('KLC')
      expect(kalyChainTestnet.nativeCurrency.symbol).toBe('KLC')
      expect(kalyChainTestnet.nativeCurrency.decimals).toBe(18)
    })

    it('should have RPC URLs configured', () => {
      expect(kalyChainTestnet.rpcUrls.default.http).toContain('https://testnetrpc.kalychain.io/rpc')
    })

    it('should have block explorer configured', () => {
      expect(kalyChainTestnet.blockExplorers?.default.url).toBe('https://testnet.kalyscan.io')
    })

    it('should be marked as testnet', () => {
      expect(kalyChainTestnet.testnet).toBe(true)
    })
  })

  describe('kalyChainMainnet', () => {
    it('should have correct chain ID', () => {
      expect(kalyChainMainnet.id).toBe(3888)
    })

    it('should have correct name', () => {
      expect(kalyChainMainnet.name).toBe('KalyChain')
    })

    it('should have correct native currency', () => {
      expect(kalyChainMainnet.nativeCurrency.name).toBe('KLC')
      expect(kalyChainMainnet.nativeCurrency.symbol).toBe('KLC')
      expect(kalyChainMainnet.nativeCurrency.decimals).toBe(18)
    })

    it('should have RPC URLs configured', () => {
      expect(kalyChainMainnet.rpcUrls.default.http).toContain('https://rpc.kalychain.io/rpc')
    })

    it('should have block explorer configured', () => {
      expect(kalyChainMainnet.blockExplorers?.default.url).toBe('https://kalyscan.io')
    })

    it('should not be marked as testnet', () => {
      expect(kalyChainMainnet.testnet).toBe(false)
    })
  })

  describe('NETWORKS', () => {
    it('should have testnet', () => {
      expect(NETWORKS.testnet).toBe(kalyChainTestnet)
    })

    it('should have mainnet', () => {
      expect(NETWORKS.mainnet).toBe(kalyChainMainnet)
    })
  })

  describe('DEFAULT_NETWORK', () => {
    it('should be testnet by default', () => {
      expect(DEFAULT_NETWORK).toBe(kalyChainTestnet)
    })
  })

  describe('getCurrentNetwork', () => {
    const originalEnv = process.env.NEXT_PUBLIC_NETWORK

    afterEach(() => {
      if (originalEnv === undefined) {
        delete process.env.NEXT_PUBLIC_NETWORK
      } else {
        process.env.NEXT_PUBLIC_NETWORK = originalEnv
      }
    })

    it('should return testnet when env is testnet', () => {
      process.env.NEXT_PUBLIC_NETWORK = 'testnet'
      expect(getCurrentNetwork()).toBe(kalyChainTestnet)
    })

    it('should return mainnet when env is mainnet', () => {
      process.env.NEXT_PUBLIC_NETWORK = 'mainnet'
      expect(getCurrentNetwork()).toBe(kalyChainMainnet)
    })

    it('should return default network for unknown env', () => {
      process.env.NEXT_PUBLIC_NETWORK = 'unknown'
      expect(getCurrentNetwork()).toBe(DEFAULT_NETWORK)
    })

    it('should return default network when env is not set', () => {
      delete process.env.NEXT_PUBLIC_NETWORK
      expect(getCurrentNetwork()).toBe(DEFAULT_NETWORK)
    })
  })
})

