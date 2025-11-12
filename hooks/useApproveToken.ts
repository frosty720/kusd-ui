/**
 * Token Approval Hook
 * 
 * Hook for approving ERC20 token spending.
 */

import { useWriteContract, useWaitForTransactionReceipt } from 'wagmi'
import { type Address } from 'viem'
import ERC20ABI from '@/abis/ERC20.json'

export function useApproveToken() {
  const { data: hash, writeContract, isPending, error } = useWriteContract()
  
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({
    hash,
  })
  
  const approve = (
    tokenAddress: Address,
    spenderAddress: Address,
    amount: bigint
  ) => {
    writeContract({
      address: tokenAddress,
      abi: ERC20ABI.abi,
      functionName: 'approve',
      args: [spenderAddress, amount],
      gas: 100000n,
      gasPrice: 21000000000n,
    })
  }
  
  return {
    approve,
    hash,
    isPending,
    isConfirming,
    isSuccess,
    error,
  }
}

/**
 * Hook for approving maximum amount (infinite approval)
 */
export function useApproveTokenMax() {
  const { approve, ...rest } = useApproveToken()
  
  const approveMax = (tokenAddress: Address, spenderAddress: Address) => {
    // Max uint256 value for infinite approval
    const maxAmount = 2n ** 256n - 1n
    approve(tokenAddress, spenderAddress, maxAmount)
  }
  
  return {
    approveMax,
    ...rest,
  }
}

