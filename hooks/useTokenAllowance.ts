/**
 * Token Allowance Hook
 * 
 * Hook for reading ERC20 token allowances.
 */

import { useReadContract } from 'wagmi'
import { type Address } from 'viem'
import ERC20ABI from '@/abis/ERC20.json'

export function useTokenAllowance(
  tokenAddress: Address | undefined,
  ownerAddress: Address | undefined,
  spenderAddress: Address | undefined
) {
  return useReadContract({
    address: tokenAddress,
    abi: ERC20ABI.abi,
    functionName: 'allowance',
    args: ownerAddress && spenderAddress ? [ownerAddress, spenderAddress] : undefined,
    query: {
      enabled: !!tokenAddress && !!ownerAddress && !!spenderAddress,
      refetchInterval: 10000, // Refetch every 10 seconds
    },
  })
}

