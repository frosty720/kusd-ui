/**
 * PSM (Peg Stability Module) Contract Hook
 * 
 * Hook for reading PSM contract data like tin/tout fees and balances.
 */

import { useReadContract } from 'wagmi'
import { type Address } from 'viem'
import KssLitePsmABI from '@/abis/KssLitePsm.json'

// PSM address from environment
const PSM_ADDRESS = process.env.NEXT_PUBLIC_PSM_ADDRESS as Address | undefined

export function usePSM() {
  /**
   * Read Functions
   */

  // Get sell fee (tin) - fee for selling gems (USDC -> KUSD)
  const useTin = () => {
    return useReadContract({
      address: PSM_ADDRESS,
      abi: KssLitePsmABI.abi,
      functionName: 'tin',
      query: {
        enabled: !!PSM_ADDRESS,
        refetchInterval: 30000,
      },
    })
  }

  // Get buy fee (tout) - fee for buying gems (KUSD -> USDC)
  const useTout = () => {
    return useReadContract({
      address: PSM_ADDRESS,
      abi: KssLitePsmABI.abi,
      functionName: 'tout',
      query: {
        enabled: !!PSM_ADDRESS,
        refetchInterval: 30000,
      },
    })
  }

  // Get buffer amount (buf) - pre-minted KUSD buffer
  const useBuf = () => {
    return useReadContract({
      address: PSM_ADDRESS,
      abi: KssLitePsmABI.abi,
      functionName: 'buf',
      query: {
        enabled: !!PSM_ADDRESS,
        refetchInterval: 30000,
      },
    })
  }

  // Get pocket address
  const usePocket = () => {
    return useReadContract({
      address: PSM_ADDRESS,
      abi: KssLitePsmABI.abi,
      functionName: 'pocket',
      query: {
        enabled: !!PSM_ADDRESS,
      },
    })
  }

  // Get gem (USDC) address
  const useGem = () => {
    return useReadContract({
      address: PSM_ADDRESS,
      abi: KssLitePsmABI.abi,
      functionName: 'gem',
      query: {
        enabled: !!PSM_ADDRESS,
      },
    })
  }

  return {
    address: PSM_ADDRESS,
    useTin,
    useTout,
    useBuf,
    usePocket,
    useGem,
  }
}

