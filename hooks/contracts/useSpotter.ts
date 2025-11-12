/**
 * Spotter Contract Hook
 * 
 * Hook for interacting with the Spotter (Oracle Price Feed) contract.
 */

import { useReadContract, useWriteContract, useWaitForTransactionReceipt } from 'wagmi'
import SpotterABI from '@/abis/Spotter.json'
import { getContracts } from '@/config/contracts'

export function useSpotter(chainId: number) {
  const contracts = getContracts(chainId)
  const spotterAddress = contracts.core.spotter
  
  /**
   * Read Functions
   */
  
  // Get collateral type (ilk) configuration
  const useIlk = (ilk: `0x${string}` | undefined) => {
    return useReadContract({
      address: spotterAddress,
      abi: SpotterABI.abi,
      functionName: 'ilks',
      args: ilk ? [ilk] : undefined,
      query: {
        enabled: !!ilk,
        refetchInterval: 10000,
      },
    })
  }
  
  // Get vat address
  const useVat = () => {
    return useReadContract({
      address: spotterAddress,
      abi: SpotterABI.abi,
      functionName: 'vat',
    })
  }
  
  // Get par (reference price, usually 1 RAY for $1)
  const usePar = () => {
    return useReadContract({
      address: spotterAddress,
      abi: SpotterABI.abi,
      functionName: 'par',
      query: {
        refetchInterval: 30000,
      },
    })
  }
  
  /**
   * Write Functions
   */
  
  // Poke (update spot price for a collateral type)
  const usePoke = () => {
    const { data: hash, writeContract, isPending, error } = useWriteContract()
    
    const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({
      hash,
    })
    
    const poke = (ilk: `0x${string}`) => {
      writeContract({
        address: spotterAddress,
        abi: SpotterABI.abi,
        functionName: 'poke',
        args: [ilk],
      })
    }
    
    return {
      poke,
      hash,
      isPending,
      isConfirming,
      isSuccess,
      error,
    }
  }
  
  return {
    address: spotterAddress,
    useIlk,
    useVat,
    usePar,
    usePoke,
  }
}

