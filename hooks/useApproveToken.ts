/**
 * Token Approval Hook
 *
 * Hook for approving ERC20 token spending.
 */

import { type Address } from 'viem'
import { useWaitForTransactionReceipt, useWriteContract } from 'wagmi'
import ERC20ABI from '@/abis/ERC20.json'
import { APP_CHAIN_ID } from '@/config/networks'
import { getTransactionGasConfigWithOverrides } from '@/config/transaction'

export function useApproveToken() {
  const { data: hash, writeContract, isPending, error } = useWriteContract()

  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({
    chainId: APP_CHAIN_ID,
    hash,
  })

  const approve = (tokenAddress: Address, spenderAddress: Address, amount: bigint) => {
    writeContract({
      address: tokenAddress,
      abi: ERC20ABI.abi,
      functionName: 'approve',
      args: [spenderAddress, amount],
      ...getTransactionGasConfigWithOverrides({ gas: 100000n }),
    } as any)
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
