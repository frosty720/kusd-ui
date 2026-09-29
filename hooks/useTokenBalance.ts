/**
 * Token Balance Hook
 * 
 * Hook for reading ERC20 token balances.
 */

import { useReadContract } from 'wagmi'
import { type Address } from 'viem'
import ERC20ABI from '@/abis/ERC20.json'
import { APP_CHAIN_ID } from '@/config/networks'

export function useTokenBalance(
  tokenAddress: Address | undefined,
  userAddress: Address | undefined
) {
  return useReadContract({
    chainId: APP_CHAIN_ID,
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

