/**
 * sKLC Contract Hook
 * 
 * Hook for interacting with the sKLC (wrapped KLC) contract.
 */

import { useReadContract, useWriteContract, useWaitForTransactionReceipt } from 'wagmi'
import { type Address } from 'viem'
import sKLCABI from '@/abis/sKLC.json'
import { getContracts } from '@/config/contracts'

export function useSKLC(chainId: number) {
  const contracts = getContracts(chainId)
  const sklcAddress = contracts.core.sklc
  
  /**
   * Read Functions
   */
  
  // Get sKLC balance
  const useBalance = (address: Address | undefined) => {
    return useReadContract({
      address: sklcAddress,
      abi: sKLCABI.abi,
      functionName: 'balanceOf',
      args: address ? [address] : undefined,
      query: {
        enabled: !!address,
        refetchInterval: 10000,
      },
    })
  }
  
  // Get total supply
  const useTotalSupply = () => {
    return useReadContract({
      address: sklcAddress,
      abi: sKLCABI.abi,
      functionName: 'totalSupply',
      query: {
        refetchInterval: 10000,
      },
    })
  }
  
  // Get allowance
  const useAllowance = (owner: Address | undefined, spender: Address | undefined) => {
    return useReadContract({
      address: sklcAddress,
      abi: sKLCABI.abi,
      functionName: 'allowance',
      args: owner && spender ? [owner, spender] : undefined,
      query: {
        enabled: !!owner && !!spender,
        refetchInterval: 10000,
      },
    })
  }
  
  /**
   * Write Functions
   */
  
  // Wrap KLC to sKLC
  const useWrap = () => {
    const { data: hash, writeContract, isPending, error } = useWriteContract()
    
    const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({
      hash,
    })
    
    const wrap = (amount: bigint) => {
      writeContract({
        address: sklcAddress,
        abi: sKLCABI.abi,
        functionName: 'wrap',
        value: amount,
      })
    }
    
    return {
      wrap,
      hash,
      isPending,
      isConfirming,
      isSuccess,
      error,
    }
  }
  
  // Unwrap sKLC to KLC
  const useUnwrap = () => {
    const { data: hash, writeContract, isPending, error } = useWriteContract()
    
    const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({
      hash,
    })
    
    const unwrap = (amount: bigint) => {
      writeContract({
        address: sklcAddress,
        abi: sKLCABI.abi,
        functionName: 'unwrap',
        args: [amount],
      })
    }
    
    return {
      unwrap,
      hash,
      isPending,
      isConfirming,
      isSuccess,
      error,
    }
  }
  
  // Approve sKLC spending
  const useApprove = () => {
    const { data: hash, writeContract, isPending, error } = useWriteContract()
    
    const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({
      hash,
    })
    
    const approve = (spender: Address, amount: bigint) => {
      writeContract({
        address: sklcAddress,
        abi: sKLCABI.abi,
        functionName: 'approve',
        args: [spender, amount],
        type: 'legacy',
        gas: 3000000n,
        gasPrice: 21000000000n,
        maxFeePerGas: undefined,
        maxPriorityFeePerGas: undefined,
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
  
  // Transfer sKLC
  const useTransfer = () => {
    const { data: hash, writeContract, isPending, error } = useWriteContract()
    
    const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({
      hash,
    })
    
    const transfer = (to: Address, amount: bigint) => {
      writeContract({
        address: sklcAddress,
        abi: sKLCABI.abi,
        functionName: 'transfer',
        args: [to, amount],
      })
    }
    
    return {
      transfer,
      hash,
      isPending,
      isConfirming,
      isSuccess,
      error,
    }
  }
  
  return {
    address: sklcAddress,
    useBalance,
    useTotalSupply,
    useAllowance,
    useWrap,
    useUnwrap,
    useApprove,
    useTransfer,
  }
}

