/**
 * Token Balance Hook
 * 
 * Hook for reading ERC20 token balances.
 */

import { useReadContract } from 'wagmi'
import { type Address } from 'viem'
import ERC20ABI from '@/abis/ERC20.json'

export function useTokenBalance(
  tokenAddress: Address | undefined,
  userAddress: Address | undefined
) {
  return useReadContract({
    address: tokenAddress,
    abi: ERC20ABI.abi,
    functionName: 'balanceOf',
    args: userAddress ? [userAddress] : undefined,
    query: {
      enabled: !!tokenAddress && !!userAddress,
      refetchInterval: 10000, // Refetch every 10 seconds
    },
  })
}

/**
 * Hook for reading native KLC balance
 */
export function useNativeBalance(userAddress: Address | undefined) {
  return useReadContract({
    address: userAddress,
    abi: [],
    functionName: 'balance',
    query: {
      enabled: !!userAddress,
      refetchInterval: 10000,
    },
  })
}

