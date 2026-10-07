/**
 * DEX Pair Hook
 *
 * Hook for reading KUSD/USDC pair data from KalySwap (UniswapV2)
 */

import { type Address, parseAbi, zeroAddress } from 'viem'
import { useReadContract, useReadContracts } from 'wagmi'
import UniswapV2PairABI from '@/abis/UniswapV2Pair.json'
import { getContracts, getNetworkSettings } from '@/config/contracts'
import { APP_CHAIN_ID } from '@/config/networks'
import { deepestPool, kusdPriceFromSqrt, type PegPool, pegStatus } from '@/lib/peg'

// DEX pair address from environment
const PAIR_ADDRESS = process.env.NEXT_PUBLIC_DEX_PAIR_ADDRESS as Address | undefined

export function useDexPair() {
  /**
   * Read Functions
   */

  // Get reserves
  const useReserves = () => {
    return useReadContract({
      chainId: APP_CHAIN_ID,
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
      chainId: APP_CHAIN_ID,
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
      chainId: APP_CHAIN_ID,
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
  const deviation = (price - 1) * 100 // Percentage deviation from $1.00

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

const v3FactoryAbi = parseAbi(['function getPool(address, address, uint24) view returns (address)'])
const v3PoolAbi = parseAbi([
  'function slot0() view returns (uint160 sqrtPriceX96, int24 tick, uint16 a, uint16 b, uint16 c, uint8 d, bool e)',
  'function liquidity() view returns (uint128)',
  'function token0() view returns (address)',
])

type KusdPrice =
  | { price: number; deviation: number; status: ReturnType<typeof pegStatus> }
  | { price: null; deviation: null; status: 'loading' | 'no-liquidity' }

/**
 * KUSD price from the deepest KUSD/stable KalySwap V3 pool across the configured fee tiers (3890),
 * in the same shape as useKusdPrice. Pools are found through the factory, so a new pool shows up
 * without a config change.
 */
function useKusdV3Price(factory: Address | undefined, feeTiers: readonly number[], kusd: Address, stable: { token: Address; decimals: number }): KusdPrice {
  const { data: pools } = useReadContracts({
    contracts: factory
      ? feeTiers.map((fee) => ({
          chainId: APP_CHAIN_ID,
          address: factory,
          abi: v3FactoryAbi,
          functionName: 'getPool' as const,
          args: [kusd, stable.token, fee] as const,
        }))
      : [],
    query: { enabled: Boolean(factory), refetchInterval: 60000 },
  })
  const found = (pools ?? []).map((r) => r.result).filter((p): p is Address => typeof p === 'string' && p !== zeroAddress)
  const { data: state } = useReadContracts({
    contracts: found.flatMap((pool) => [
      { chainId: APP_CHAIN_ID, address: pool, abi: v3PoolAbi, functionName: 'liquidity' as const },
      { chainId: APP_CHAIN_ID, address: pool, abi: v3PoolAbi, functionName: 'slot0' as const },
      { chainId: APP_CHAIN_ID, address: pool, abi: v3PoolAbi, functionName: 'token0' as const },
    ]),
    query: { enabled: found.length > 0, refetchInterval: 10000 },
  })

  if (!factory || !pools) return { price: null, deviation: null, status: 'loading' }
  if (found.length === 0) return { price: null, deviation: null, status: 'no-liquidity' }
  if (!state) return { price: null, deviation: null, status: 'loading' }
  const read: PegPool[] = found.map((pool, i) => ({
    pool,
    liquidity: (state[i * 3]?.result as bigint | undefined) ?? 0n,
    sqrtPriceX96: (state[i * 3 + 1]?.result as readonly [bigint, ...unknown[]] | undefined)?.[0] ?? 0n,
    token0: (state[i * 3 + 2]?.result as Address | undefined) ?? zeroAddress,
  }))
  const best = deepestPool(read)
  if (!best) return { price: null, deviation: null, status: 'no-liquidity' }
  const price = kusdPriceFromSqrt(best.sqrtPriceX96, best.token0.toLowerCase() === kusd.toLowerCase(), 18, stable.decimals)
  return { price, deviation: (price - 1) * 100, status: pegStatus(price) }
}

/**
 * KUSD market price on the app's network: the V2 KUSD/stable pair on the legacy chains, the
 * deepest KUSD/USDT V3 pool on 3890. Both hooks are always called (rules of hooks); the one the
 * network does not use stays disabled.
 */
export function useKusdPegPrice(): KusdPrice {
  const settings = getNetworkSettings(APP_CHAIN_ID)
  const contracts = getContracts(APP_CHAIN_ID)
  const stable = contracts.collateral[settings.pegStable]
  const isV3 = settings.peg.kind === 'v3'
  const v2 = useKusdPrice(isV3 ? undefined : contracts.core.kusd, isV3 ? undefined : stable.token)
  const v3 = useKusdV3Price(
    settings.peg.kind === 'v3' ? settings.peg.factory : undefined,
    settings.peg.kind === 'v3' ? settings.peg.feeTiers : [],
    contracts.core.kusd,
    stable,
  )
  return isV3 ? v3 : (v2 as KusdPrice)
}
