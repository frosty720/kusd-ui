/**
 * End Contract Hook
 * 
 * Hook for interacting with the End (Emergency Shutdown) contract.
 * This contract handles global settlement of the KUSD system.
 */

import { useReadContract, useWriteContract, useWaitForTransactionReceipt } from 'wagmi'
import EndABI from '@/abis/End.json'
import { getContracts } from '@/config/contracts'

export function useEnd(chainId: number) {
  const contracts = getContracts(chainId)
  const endAddress = contracts.core.end

  /**
   * Read Functions
   */

  // Check if system is live (1 = live, 0 = caged/shutdown)
  const useLive = () => {
    return useReadContract({
      address: endAddress,
      abi: EndABI.abi,
      functionName: 'live',
      query: {
        refetchInterval: 10000,
      },
    })
  }

  // Get the timestamp when shutdown was triggered
  const useWhen = () => {
    return useReadContract({
      address: endAddress,
      abi: EndABI.abi,
      functionName: 'when',
      query: {
        refetchInterval: 30000,
      },
    })
  }

  // Get the wait period before thaw can be called
  const useWait = () => {
    return useReadContract({
      address: endAddress,
      abi: EndABI.abi,
      functionName: 'wait',
      query: {
        refetchInterval: 30000,
      },
    })
  }

  // Get total debt at shutdown
  const useDebt = () => {
    return useReadContract({
      address: endAddress,
      abi: EndABI.abi,
      functionName: 'debt',
      query: {
        refetchInterval: 30000,
      },
    })
  }

  // Check if caller is authorized (wards)
  const useWards = (address: `0x${string}` | undefined) => {
    return useReadContract({
      address: endAddress,
      abi: EndABI.abi,
      functionName: 'wards',
      args: address ? [address] : undefined,
      query: {
        enabled: !!address,
        refetchInterval: 30000,
      },
    })
  }

  /**
   * Write Functions
   */

  // Trigger global emergency shutdown
  const useCage = () => {
    const { data: hash, writeContract, isPending, error } = useWriteContract()

    const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({
      hash,
    })

    const cage = () => {
      writeContract({
        address: endAddress,
        abi: EndABI.abi,
        functionName: 'cage',
        args: [],
        type: 'legacy',
        gas: 500000n,
        gasPrice: 21000000000n,
      } as any)
    }

    return {
      cage,
      hash,
      isPending,
      isConfirming,
      isSuccess,
      error,
    }
  }

  return {
    address: endAddress,
    useLive,
    useWhen,
    useWait,
    useDebt,
    useWards,
    useCage,
  }
}

