/**
 * GemJoin Contract Hook
 * 
 * Hook for interacting with GemJoin adapters (collateral deposit/withdrawal).
 */

import { useReadContract, useWriteContract, useWaitForTransactionReceipt } from 'wagmi'
import { type Address } from 'viem'
import GemJoinABI from '@/abis/GemJoin.json'
import GemJoin5ABI from '@/abis/GemJoin5.json'
import { getCollateral, type CollateralType } from '@/config/contracts'

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
      address: joinAddress,
      abi,
      functionName: 'ilk',
    })
  }
  
  // Get the gem (collateral token address)
  const useGem = () => {
    return useReadContract({
      address: joinAddress,
      abi,
      functionName: 'gem',
    })
  }
  
  // Get the vat address
  const useVat = () => {
    return useReadContract({
      address: joinAddress,
      abi,
      functionName: 'vat',
    })
  }
  
  // Get decimals (only for GemJoin5)
  const useDecimals = () => {
    if (!isNon18Decimal) return { data: 18 }
    
    return useReadContract({
      address: joinAddress,
      abi: GemJoin5ABI.abi,
      functionName: 'dec',
    })
  }
  
  /**
   * Write Functions
   */
  
  // Join (deposit collateral into the system)
  const useJoin = () => {
    const { data: hash, writeContract, isPending, error } = useWriteContract()
    
    const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({
      hash,
    })
    
    const join = (userAddress: Address, amount: bigint) => {
      writeContract({
        address: joinAddress,
        abi,
        functionName: 'join',
        args: [userAddress, amount],
        type: 'legacy',
        gas: 3000000n,
        gasPrice: 21000000000n,
        maxFeePerGas: undefined,
        maxPriorityFeePerGas: undefined,
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
        type: 'legacy',
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

