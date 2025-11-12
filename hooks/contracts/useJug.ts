/**
 * Jug Contract Hook
 * 
 * Hook for reading stability fees from the Jug contract.
 */

import { useReadContract } from 'wagmi'
import { type Address } from 'viem'
import JugABI from '@/abis/Jug.json'
import { getContracts } from '@/config/contracts'

export function useJug(chainId: number) {
  const contracts = getContracts(chainId)
  const jugAddress = contracts.core.jug as Address

  /**
   * Read Functions
   */
  
  // Get ilk data (duty, rho)
  const useIlk = (ilk: `0x${string}` | undefined) => {
    return useReadContract({
      address: jugAddress,
      abi: JugABI.abi,
      functionName: 'ilks',
      args: ilk ? [ilk] : undefined,
      query: {
        enabled: !!ilk,
        refetchInterval: 10000, // Refetch every 10 seconds
      },
    })
  }
  
  // Get base rate
  const useBase = () => {
    return useReadContract({
      address: jugAddress,
      abi: JugABI.abi,
      functionName: 'base',
    })
  }
  
  return {
    address: jugAddress,
    useIlk,
    useBase,
  }
}

