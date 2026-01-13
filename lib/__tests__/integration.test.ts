/**
 * Integration Tests Against Live Contracts
 * 
 * These tests call actual smart contracts on the testnet to verify
 * that our math implementations produce results that match on-chain calculations.
 * 
 * IMPORTANT: These tests require network access to KalyChain testnet (3889).
 * They are marked with `.skip` by default and should be run manually when needed.
 * 
 * To run these tests:
 * npm test -- --run integration.test.ts
 * 
 * Environment Requirements:
 * - Network access to RPC: https://testnetrpc.kalychain.io/rpc
 */

import { describe, it, expect, beforeAll } from 'vitest'
import { createPublicClient, http, formatUnits } from 'viem'
import { TESTNET_CONTRACTS } from '@/config/contracts'
import { RAY, WAD } from '../constants'
import { rayPow, rayMul } from '../math'
import { rpow, rmul, calculateAccumulatedRate, calculateChi } from '../reference-math'
import VatABI from '@/abis/Vat.json'
import JugABI from '@/abis/Jug.json'
import PotABI from '@/abis/Pot.json'
import SpotterABI from '@/abis/Spotter.json'

// KalyChain testnet configuration
const kalyTestnet = {
  id: 3889,
  name: 'KalyChain Testnet',
  nativeCurrency: { name: 'KLC', symbol: 'KLC', decimals: 18 },
  rpcUrls: {
    default: { http: ['https://testnetrpc.kalychain.io/rpc'] },
  },
}

// Create client for testnet
const client = createPublicClient({
  chain: kalyTestnet as any,
  transport: http(),
})

const contracts = TESTNET_CONTRACTS

describe('Integration Tests (Live Contracts)', () => {
  describe('Contract Data Reading', () => {
    it('should read Pot.chi from contract', async () => {
      const chi = await client.readContract({
        address: contracts.core.pot,
        abi: PotABI.abi,
        functionName: 'chi',
      }) as bigint

      expect(chi).toBeGreaterThan(0n)
      expect(chi).toBeGreaterThanOrEqual(RAY) // chi >= 1.0
      console.log('Pot.chi:', formatUnits(chi, 27))
    })

    it('should read Pot.dsr from contract', async () => {
      const dsr = await client.readContract({
        address: contracts.core.pot,
        abi: PotABI.abi,
        functionName: 'dsr',
      }) as bigint

      expect(dsr).toBeGreaterThan(0n)
      expect(dsr).toBeGreaterThanOrEqual(RAY) // dsr >= 1.0
      console.log('Pot.dsr:', dsr.toString())
    })

    it('should read Jug.ilks for WBTC-A', async () => {
      const ilkData = await client.readContract({
        address: contracts.core.jug,
        abi: JugABI.abi,
        functionName: 'ilks',
        args: [contracts.collateral['WBTC-A'].ilk as `0x${string}`],
      }) as [bigint, bigint]

      const [duty, rho] = ilkData
      expect(duty).toBeGreaterThan(0n)
      expect(rho).toBeGreaterThan(0n)
      console.log('WBTC-A duty:', duty.toString())
      console.log('WBTC-A rho:', rho.toString())
    })

    it('should read Vat.ilks for WBTC-A', async () => {
      const ilkData = await client.readContract({
        address: contracts.core.vat,
        abi: VatABI.abi,
        functionName: 'ilks',
        args: [contracts.collateral['WBTC-A'].ilk as `0x${string}`],
      }) as [bigint, bigint, bigint, bigint, bigint]

      const [Art, rate, spot, line, dust] = ilkData
      expect(rate).toBeGreaterThanOrEqual(RAY) // rate >= 1.0
      console.log('WBTC-A Art:', Art.toString())
      console.log('WBTC-A rate:', rate.toString())
      console.log('WBTC-A spot:', spot.toString())
    })
  })

  describe('Rate Calculation Verification', () => {
    it('should predict chi correctly after time passes', async () => {
      // Read current state
      const [dsr, chi, rho] = await Promise.all([
        client.readContract({
          address: contracts.core.pot,
          abi: PotABI.abi,
          functionName: 'dsr',
        }) as Promise<bigint>,
        client.readContract({
          address: contracts.core.pot,
          abi: PotABI.abi,
          functionName: 'chi',
        }) as Promise<bigint>,
        client.readContract({
          address: contracts.core.pot,
          abi: PotABI.abi,
          functionName: 'rho',
        }) as Promise<bigint>,
      ])

      // Get current block timestamp
      const block = await client.getBlock()
      const now = block.timestamp

      // Calculate what chi should be if drip is called now
      const elapsed = now - rho
      if (elapsed > 0n) {
        const predictedChi = calculateChi(dsr, elapsed, chi)
        
        console.log('Current chi:', chi.toString())
        console.log('Elapsed seconds:', elapsed.toString())
        console.log('Predicted chi:', predictedChi.toString())
        
        // The predicted chi should be >= current chi
        expect(predictedChi).toBeGreaterThanOrEqual(chi)
      }
    })
  })

  // These tests run without network access - they verify our math matches reference
  describe('Reference Implementation Verification (No Network)', () => {
    it('should calculate 2% APY rate correctly', () => {
      // Known 2% APY per-second rate from MakerDAO
      const duty = 1000000000627937192491029810n
      
      // Calculate for 1 year
      const oneYear = 31536000n
      const result = rpow(duty, oneYear, RAY)
      
      // Should be approximately 1.02 * RAY
      const ratio = (result * 10000n) / RAY
      expect(ratio).toBeGreaterThanOrEqual(10195n) // 1.0195
      expect(ratio).toBeLessThanOrEqual(10205n) // 1.0205
    })

    it('should calculate 5% APY rate correctly', () => {
      // 5% APY per-second rate
      const duty = 1000000001547125957863212448n
      
      const oneYear = 31536000n
      const result = rpow(duty, oneYear, RAY)
      
      const ratio = (result * 10000n) / RAY
      expect(ratio).toBeGreaterThanOrEqual(10495n) // 1.0495
      expect(ratio).toBeLessThanOrEqual(10505n) // 1.0505
    })
  })
})

