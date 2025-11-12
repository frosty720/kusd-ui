/**
 * Vat Contract Hook
 * 
 * Hook for interacting with the Vat (CDP Engine) contract.
 * This is the core contract that manages all CDPs (Vaults).
 */

import { useReadContract, useWriteContract, useWaitForTransactionReceipt } from 'wagmi'
import { type Address } from 'viem'
import VatABI from '@/abis/Vat.json'
import { getContracts } from '@/config/contracts'

export function useVat(chainId: number) {
  const contracts = getContracts(chainId)
  const vatAddress = contracts.core.vat
  
  /**
   * Read Functions
   */
  
  // Get user's CDP (urn) data for a specific collateral type
  const useUrn = (ilk: `0x${string}` | undefined, user: Address | undefined) => {
    return useReadContract({
      address: vatAddress,
      abi: VatABI.abi,
      functionName: 'urns',
      args: ilk && user ? [ilk, user] : undefined,
      query: {
        enabled: !!ilk && !!user,
        refetchInterval: 10000,
      },
    })
  }
  
  // Get collateral type (ilk) configuration
  const useIlk = (ilk: `0x${string}` | undefined) => {
    return useReadContract({
      address: vatAddress,
      abi: VatABI.abi,
      functionName: 'ilks',
      args: ilk ? [ilk] : undefined,
      query: {
        enabled: !!ilk,
        refetchInterval: 10000,
      },
    })
  }
  
  // Get user's internal KUSD balance
  const useKusd = (user: Address | undefined) => {
    return useReadContract({
      address: vatAddress,
      abi: VatABI.abi,
      functionName: 'kusd',
      args: user ? [user] : undefined,
      query: {
        enabled: !!user,
        refetchInterval: 10000,
      },
    })
  }
  
  // Get user's collateral balance in the Vat
  const useGem = (ilk: `0x${string}` | undefined, user: Address | undefined) => {
    return useReadContract({
      address: vatAddress,
      abi: VatABI.abi,
      functionName: 'gem',
      args: ilk && user ? [ilk, user] : undefined,
      query: {
        enabled: !!ilk && !!user,
        refetchInterval: 10000,
      },
    })
  }
  
  // Check if an address can modify another address's CDP
  const useCan = (owner: Address | undefined, operator: Address | undefined) => {
    return useReadContract({
      address: vatAddress,
      abi: VatABI.abi,
      functionName: 'can',
      args: owner && operator ? [owner, operator] : undefined,
      query: {
        enabled: !!owner && !!operator,
        refetchInterval: 5000, // Refetch every 5 seconds to catch permission changes
      },
    })
  }
  
  // Get global debt ceiling
  const useLine = () => {
    return useReadContract({
      address: vatAddress,
      abi: VatABI.abi,
      functionName: 'Line',
      query: {
        refetchInterval: 30000,
      },
    })
  }
  
  // Get total system debt
  const useDebt = () => {
    return useReadContract({
      address: vatAddress,
      abi: VatABI.abi,
      functionName: 'debt',
      query: {
        refetchInterval: 10000,
      },
    })
  }
  
  /**
   * Write Functions
   */
  
  // Hope (grant permission to an address to modify your CDP)
  const useHope = () => {
    const { data: hash, writeContract, isPending, error } = useWriteContract()

    const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({
      hash,
    })

    const hope = (operator: Address) => {
      writeContract({
        address: vatAddress,
        abi: VatABI.abi,
        functionName: 'hope',
        args: [operator],
        type: 'legacy',
        gas: 3000000n,
        gasPrice: 21000000000n,
        maxFeePerGas: undefined,
        maxPriorityFeePerGas: undefined,
      } as any)
    }

    return {
      hope,
      hash,
      isPending,
      isConfirming,
      isSuccess,
      error,
    }
  }
  
  // Nope (revoke permission from an address)
  const useNope = () => {
    const { data: hash, writeContract, isPending, error } = useWriteContract()
    
    const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({
      hash,
    })
    
    const nope = (operator: Address) => {
      writeContract({
        address: vatAddress,
        abi: VatABI.abi,
        functionName: 'nope',
        args: [operator],
      })
    }
    
    return {
      nope,
      hash,
      isPending,
      isConfirming,
      isSuccess,
      error,
    }
  }
  
  // Frob (modify CDP - lock/free collateral and draw/wipe debt)
  const useFrob = () => {
    const { data: hash, writeContract, isPending, error } = useWriteContract()
    
    const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({
      hash,
    })
    
    const frob = (
      ilk: `0x${string}`,
      u: Address,
      v: Address,
      w: Address,
      dink: bigint,
      dart: bigint
    ) => {
      writeContract({
        address: vatAddress,
        abi: VatABI.abi,
        functionName: 'frob',
        args: [ilk, u, v, w, dink, dart],
      })
    }
    
    return {
      frob,
      hash,
      isPending,
      isConfirming,
      isSuccess,
      error,
    }
  }
  
  return {
    address: vatAddress,
    useUrn,
    useIlk,
    useKusd,
    useGem,
    useCan,
    useLine,
    useDebt,
    useHope,
    useNope,
    useFrob,
  }
}

