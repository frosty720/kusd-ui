/**
 * Oracle Contract Hook
 * 
 * Hook for reading prices from KUSDOracle contracts.
 */

import { useReadContract } from 'wagmi'
import { type Address } from 'viem'
import KUSDOracleABI from '@/abis/KUSDOracle.json'

export function useOracle(oracleAddress: Address | undefined) {
  /**
   * Read Functions
   */
  
  // Get current price and validity
  const usePeek = () => {
    return useReadContract({
      address: oracleAddress,
      abi: KUSDOracleABI,
      functionName: 'peek',
      query: {
        enabled: !!oracleAddress,
        refetchInterval: 10000, // Refetch every 10 seconds
      },
    })
  }
  
  // Get price data (price, timestamp, valid)
  const useGetPriceData = () => {
    return useReadContract({
      address: oracleAddress,
      abi: KUSDOracleABI,
      functionName: 'getPriceData',
      query: {
        enabled: !!oracleAddress,
        refetchInterval: 10000,
      },
    })
  }
  
  return {
    address: oracleAddress,
    usePeek,
    useGetPriceData,
  }
}

