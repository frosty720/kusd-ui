/**
 * Vow Contract Hook
 * 
 * Hook for interacting with the Vow (System Surplus/Debt) contract.
 * This contract manages system surplus and debt auctions.
 */

import { useReadContract } from 'wagmi'
import VowABI from '@/abis/Vow.json'
import { getContracts } from '@/config/contracts'

export function useVow(chainId: number) {
  const contracts = getContracts(chainId)
  const vowAddress = contracts.core.vow

  /**
   * Read Functions
   */

  // Check if system is live
  const useLive = () => {
    return useReadContract({
      address: vowAddress,
      abi: VowABI.abi,
      functionName: 'live',
      query: {
        refetchInterval: 10000,
      },
    })
  }

  // Get total queued debt (Sin)
  const useSin = () => {
    return useReadContract({
      address: vowAddress,
      abi: VowABI.abi,
      functionName: 'Sin',
      query: {
        refetchInterval: 10000,
      },
    })
  }

  // Get total debt being auctioned (Ash)
  const useAsh = () => {
    return useReadContract({
      address: vowAddress,
      abi: VowABI.abi,
      functionName: 'Ash',
      query: {
        refetchInterval: 10000,
      },
    })
  }

  // Get surplus buffer (hump)
  const useHump = () => {
    return useReadContract({
      address: vowAddress,
      abi: VowABI.abi,
      functionName: 'hump',
      query: {
        refetchInterval: 30000,
      },
    })
  }

  // Get surplus lot size (bump)
  const useBump = () => {
    return useReadContract({
      address: vowAddress,
      abi: VowABI.abi,
      functionName: 'bump',
      query: {
        refetchInterval: 30000,
      },
    })
  }

  // Get debt lot size (sump)
  const useSump = () => {
    return useReadContract({
      address: vowAddress,
      abi: VowABI.abi,
      functionName: 'sump',
      query: {
        refetchInterval: 30000,
      },
    })
  }

  // Get debt auction initial lot (dump)
  const useDump = () => {
    return useReadContract({
      address: vowAddress,
      abi: VowABI.abi,
      functionName: 'dump',
      query: {
        refetchInterval: 30000,
      },
    })
  }

  // Get debt queue wait time
  const useWait = () => {
    return useReadContract({
      address: vowAddress,
      abi: VowABI.abi,
      functionName: 'wait',
      query: {
        refetchInterval: 30000,
      },
    })
  }

  return {
    address: vowAddress,
    useLive,
    useSin,
    useAsh,
    useHump,
    useBump,
    useSump,
    useDump,
    useWait,
  }
}

