/**
 * KusdJoin Contract Hook
 * 
 * Hook for interacting with the KusdJoin adapter (KUSD minting/burning).
 */

import { useReadContract, useWriteContract, useWaitForTransactionReceipt } from 'wagmi'
import { type Address } from 'viem'
import KusdJoinABI from '@/abis/KusdJoin.json'
import { getContracts } from '@/config/contracts'

export function useKusdJoin(chainId: number) {
  const contracts = getContracts(chainId)
  const kusdJoinAddress = contracts.core.kusdJoin
  
  /**
   * Read Functions
   */
  
  // Get the vat address
  const useVat = () => {
    return useReadContract({
      address: kusdJoinAddress,
      abi: KusdJoinABI.abi,
      functionName: 'vat',
    })
  }
  
  // Get the KUSD token address
  const useKusd = () => {
    return useReadContract({
      address: kusdJoinAddress,
      abi: KusdJoinABI.abi,
      functionName: 'kusd',
    })
  }
  
  /**
   * Write Functions
   */
  
  // Join (deposit KUSD into the system - burns from user, credits internal balance)
  const useJoin = () => {
    const { data: hash, writeContract, isPending, error } = useWriteContract()

    const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({
      hash,
    })

    const join = (userAddress: Address, amount: bigint) => {
      writeContract({
        address: kusdJoinAddress,
        abi: KusdJoinABI.abi,
        functionName: 'join',
        args: [userAddress, amount],
        gas: 3000000n,
        gasPrice: 21000000000n,
      })
    }

    return {
      join,
      hash,
      isPending,
      isConfirming,
      isSuccess,
      error,
    }
  }
  
  // Exit (withdraw KUSD from the system - mints to user, debits internal balance)
  const useExit = () => {
    const { data: hash, writeContract, isPending, error } = useWriteContract()

    const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({
      hash,
    })

    const exit = (userAddress: Address, amount: bigint) => {
      writeContract({
        address: kusdJoinAddress,
        abi: KusdJoinABI.abi,
        functionName: 'exit',
        args: [userAddress, amount],
        gas: 3000000n,
        gasPrice: 21000000000n,
        maxFeePerGas: undefined,
        maxPriorityFeePerGas: undefined,
      } as any)
    }

    return {
      exit,
      hash,
      isPending,
      isConfirming,
      isSuccess,
      error,
    }
  }
  
  return {
    address: kusdJoinAddress,
    useVat,
    useKusd,
    useJoin,
    useExit,
  }
}

