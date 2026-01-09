/**
 * DEX Pair Hook
 * 
 * Hook for reading KUSD/USDC pair data from KalySwap (UniswapV2)
 */

import { useReadContract, useReadContracts } from 'wagmi'
import { type Address } from 'viem'
import UniswapV2PairABI from '@/abis/UniswapV2Pair.json'

// DEX pair address from environment
const PAIR_ADDRESS = process.env.NEXT_PUBLIC_DEX_PAIR_ADDRESS as Address | undefined

export function useDexPair() {
  /**
   * Read Functions
   */

  // Get reserves
  const useReserves = () => {
    return useReadContract({
      address: PAIR_ADDRESS,
      abi: UniswapV2PairABI.abi,
      functionName: 'getReserves',
      query: {
        enabled: !!PAIR_ADDRESS,
        refetchInterval: 10000, // Refetch every 10 seconds
      },
    })
  }

  // Get token0 address
  const useToken0 = () => {
    return useReadContract({
      address: PAIR_ADDRESS,
      abi: UniswapV2PairABI.abi,
      functionName: 'token0',
      query: {
        enabled: !!PAIR_ADDRESS,
      },
    })
  }

  // Get token1 address
  const useToken1 = () => {
    return useReadContract({
      address: PAIR_ADDRESS,
      abi: UniswapV2PairABI.abi,
      functionName: 'token1',
      query: {
        enabled: !!PAIR_ADDRESS,
      },
    })
  }

  return {
    address: PAIR_ADDRESS,
    useReserves,
    useToken0,
    useToken1,
  }
}

/**
 * Hook to get the current KUSD price from DEX
 * Returns price in USD (should be ~1.00 for a pegged stablecoin)
 */
export function useKusdPrice(kusdAddress: Address | undefined, usdcAddress: Address | undefined) {
  const { useReserves, useToken0 } = useDexPair()
  const { data: reserves } = useReserves()
  const { data: token0 } = useToken0()

  if (!reserves || !token0 || !kusdAddress || !usdcAddress) {
    return { price: null, deviation: null, status: 'loading' as const }
  }

  const [reserve0, reserve1] = reserves as [bigint, bigint, number]

  // Determine which reserve is USDC (6 decimals) and which is KUSD (18 decimals)
  const token0Address = token0 as Address
  const isUsdcToken0 = token0Address.toLowerCase() === usdcAddress.toLowerCase()
  
  const usdcReserve = isUsdcToken0 ? reserve0 : reserve1
  const kusdReserve = isUsdcToken0 ? reserve1 : reserve0

  if (usdcReserve === 0n || kusdReserve === 0n) {
    return { price: null, deviation: null, status: 'no-liquidity' as const }
  }

  // Normalize to same decimals for price calculation
  // USDC has 6 decimals, KUSD has 18 decimals
  // Price = USDC_reserve / KUSD_reserve (after normalizing)
  const usdcNormalized = Number(usdcReserve) * 1e12 // Convert to 18 decimals
  const kusdNormalized = Number(kusdReserve)

  const price = usdcNormalized / kusdNormalized
  const deviation = ((price - 1) * 100) // Percentage deviation from $1.00

  let status: 'on-peg' | 'above-peg' | 'below-peg' | 'critical'
  if (Math.abs(deviation) < 0.5) {
    status = 'on-peg'
  } else if (Math.abs(deviation) < 2) {
    status = deviation > 0 ? 'above-peg' : 'below-peg'
  } else {
    status = 'critical'
  }

  return { price, deviation, status }
}

