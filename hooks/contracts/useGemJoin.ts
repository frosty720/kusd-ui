/**
 * GemJoin Contract Hook
 *
 * Hook for interacting with GemJoin adapters (collateral deposit/withdrawal).
 */

import { type Address } from 'viem'
import { useReadContract, useWaitForTransactionReceipt, useWriteContract } from 'wagmi'
import GemJoinABI from '@/abis/GemJoin.json'
import GemJoin5ABI from '@/abis/GemJoin5.json'
import { type CollateralType, getCollateral } from '@/config/contracts'
import { getTransactionGasConfigWithOverrides } from '@/config/transaction'

export function useGemJoin(chainId: number, collateralType: CollateralType) {
  const collateral = getCollateral(chainId, collateralType)
  const joinAddress = collateral.join

  // Use GemJoin5 ABI for non-18-decimal tokens (WBTC, USDT, USDC)
  const isNon18Decimal = collateral.decimals !== 18
  const abi = isNon18Decimal ? GemJoin5ABI.abi : GemJoinABI.abi

  /**
   * Read Functions
   */

  // Get the ilk (collateral type identifier)
  const useIlk = () => {
    return useReadContract({
      chainId,
      address: joinAddress,
      abi,
      functionName: 'ilk',
    })
  }

  // Get the gem (collateral token address)
  const useGem = () => {
    return useReadContract({
      chainId,
      address: joinAddress,
      abi,
      functionName: 'gem',
    })
  }

  // Get the vat address
  const useVat = () => {
    return useReadContract({
      chainId,
      address: joinAddress,
      abi,
      functionName: 'vat',
    })
  }

  // Get decimals (only for GemJoin5)
  const useDecimals = () => {
    // Always called (hooks may not be conditional); only a GemJoin5 has dec(), so the read runs only there.
    const dec = useReadContract({
      chainId,
      address: joinAddress,
      abi: GemJoin5ABI.abi,
      functionName: 'dec',
      query: { enabled: isNon18Decimal },
    })
    return isNon18Decimal ? dec : { data: 18 }
  }

  /**
   * Write Functions
   */

  // Join (deposit collateral into the system)
  const useJoin = () => {
    const { data: hash, writeContract, isPending, error } = useWriteContract()

    const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({
      chainId,
      hash,
    })

    const join = (userAddress: Address, amount: bigint) => {
      writeContract({
        address: joinAddress,
        abi,
        functionName: 'join',
        args: [userAddress, amount],
        ...getTransactionGasConfigWithOverrides({ gas: 3000000n }),
      } as any)
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

  // Exit (withdraw collateral from the system)
  const useExit = () => {
    const { data: hash, writeContract, isPending, error } = useWriteContract()

    const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({
      chainId,
      hash,
    })

    const exit = (userAddress: Address, amount: bigint) => {
      console.log('GemJoin exit called with:', {
        joinAddress,
        userAddress,
        amount: amount.toString(),
      })

      writeContract({
        address: joinAddress,
        abi,
        functionName: 'exit',
        args: [userAddress, amount],
        ...getTransactionGasConfigWithOverrides({ gas: 3000000n }),
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
    address: joinAddress,
    collateral,
    useIlk,
    useGem,
    useVat,
    useDecimals,
    useJoin,
    useExit,
  }
}
