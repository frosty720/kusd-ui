/**
 * Auction Contracts Hook
 * 
 * Hook for interacting with auction contracts (Clipper, Flapper, Flopper).
 */

import { useReadContract, useWriteContract, useWaitForTransactionReceipt } from 'wagmi'
import { type Address } from 'viem'
import ClipperABI from '@/abis/Clipper.json'
import FlapperABI from '@/abis/Flapper.json'
import FlopperABI from '@/abis/Flopper.json'
import { getCollateral, type CollateralType } from '@/config/contracts'
import { getContracts } from '@/config/contracts'

/**
 * Clipper (Collateral Liquidation Auctions)
 */
export function useClipper(chainId: number, collateralType: CollateralType) {
  const collateral = getCollateral(chainId, collateralType)
  const clipperAddress = collateral.clipper
  
  /**
   * Read Functions
   */
  
  // Get auction data
  const useSale = (auctionId: bigint | undefined) => {
    return useReadContract({
      address: clipperAddress,
      abi: ClipperABI.abi,
      functionName: 'sales',
      args: auctionId !== undefined ? [auctionId] : undefined,
      query: {
        enabled: auctionId !== undefined,
        refetchInterval: 5000,
      },
    })
  }
  
  // Get active auction count
  const useKicks = () => {
    return useReadContract({
      address: clipperAddress,
      abi: ClipperABI.abi,
      functionName: 'kicks',
      query: {
        refetchInterval: 10000,
      },
    })
  }
  
  // Get current price for an auction
  const useStatus = (auctionId: bigint | undefined) => {
    return useReadContract({
      address: clipperAddress,
      abi: ClipperABI.abi,
      functionName: 'status',
      args: auctionId !== undefined ? [auctionId] : undefined,
      query: {
        enabled: auctionId !== undefined,
        refetchInterval: 5000,
      },
    })
  }
  
  /**
   * Write Functions
   */
  
  // Take (buy collateral from auction)
  const useTake = () => {
    const { data: hash, writeContract, isPending, error } = useWriteContract()
    
    const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({
      hash,
    })
    
    const take = (
      auctionId: bigint,
      amount: bigint,
      maxPrice: bigint,
      recipient: Address,
      data: `0x${string}`
    ) => {
      writeContract({
        address: clipperAddress,
        abi: ClipperABI.abi,
        functionName: 'take',
        args: [auctionId, amount, maxPrice, recipient, data],
        type: 'legacy',
        gas: 5000000n,
        gasPrice: 21000000000n,
        maxFeePerGas: undefined,
        maxPriorityFeePerGas: undefined,
      } as any)
    }
    
    return {
      take,
      hash,
      isPending,
      isConfirming,
      isSuccess,
      error,
    }
  }
  
  return {
    address: clipperAddress,
    collateral,
    useSale,
    useKicks,
    useStatus,
    useTake,
  }
}

/**
 * Flapper (Surplus Auctions - sell KUSD for sKLC)
 */
export function useFlapper(chainId: number) {
  const contracts = getContracts(chainId)
  const flapperAddress = contracts.core.flapper
  
  /**
   * Read Functions
   */
  
  // Get auction data
  const useBid = (auctionId: bigint | undefined) => {
    return useReadContract({
      address: flapperAddress,
      abi: FlapperABI.abi,
      functionName: 'bids',
      args: auctionId !== undefined ? [auctionId] : undefined,
      query: {
        enabled: auctionId !== undefined,
        refetchInterval: 5000,
      },
    })
  }
  
  // Get active auction count
  const useKicks = () => {
    return useReadContract({
      address: flapperAddress,
      abi: FlapperABI.abi,
      functionName: 'kicks',
      query: {
        refetchInterval: 10000,
      },
    })
  }
  
  /**
   * Write Functions
   */
  
  // Tend (bid sKLC for KUSD)
  const useTend = () => {
    const { data: hash, writeContract, isPending, error } = useWriteContract()
    
    const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({
      hash,
    })
    
    const tend = (auctionId: bigint, lot: bigint, bid: bigint) => {
      writeContract({
        address: flapperAddress,
        abi: FlapperABI.abi,
        functionName: 'tend',
        args: [auctionId, lot, bid],
        type: 'legacy',
        gas: 3000000n,
        gasPrice: 21000000000n,
        maxFeePerGas: undefined,
        maxPriorityFeePerGas: undefined,
      } as any)
    }
    
    return {
      tend,
      hash,
      isPending,
      isConfirming,
      isSuccess,
      error,
    }
  }
  
  // Deal (claim won auction)
  const useDeal = () => {
    const { data: hash, writeContract, isPending, error } = useWriteContract()
    
    const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({
      hash,
    })
    
    const deal = (auctionId: bigint) => {
      writeContract({
        address: flapperAddress,
        abi: FlapperABI.abi,
        functionName: 'deal',
        args: [auctionId],
        type: 'legacy',
        gas: 3000000n,
        gasPrice: 21000000000n,
        maxFeePerGas: undefined,
        maxPriorityFeePerGas: undefined,
      } as any)
    }
    
    return {
      deal,
      hash,
      isPending,
      isConfirming,
      isSuccess,
      error,
    }
  }
  
  return {
    address: flapperAddress,
    useBid,
    useKicks,
    useTend,
    useDeal,
  }
}

/**
 * Flopper (Debt Auctions - sell sKLC for KUSD)
 */
export function useFlopper(chainId: number) {
  const contracts = getContracts(chainId)
  const flopperAddress = contracts.core.flopper
  
  /**
   * Read Functions
   */
  
  // Get auction data
  const useBid = (auctionId: bigint | undefined) => {
    return useReadContract({
      address: flopperAddress,
      abi: FlopperABI.abi,
      functionName: 'bids',
      args: auctionId !== undefined ? [auctionId] : undefined,
      query: {
        enabled: auctionId !== undefined,
        refetchInterval: 5000,
      },
    })
  }
  
  // Get active auction count
  const useKicks = () => {
    return useReadContract({
      address: flopperAddress,
      abi: FlopperABI.abi,
      functionName: 'kicks',
      query: {
        refetchInterval: 10000,
      },
    })
  }
  
  /**
   * Write Functions
   */
  
  // Dent (bid KUSD for sKLC)
  const useDent = () => {
    const { data: hash, writeContract, isPending, error } = useWriteContract()
    
    const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({
      hash,
    })
    
    const dent = (auctionId: bigint, lot: bigint, bid: bigint) => {
      writeContract({
        address: flopperAddress,
        abi: FlopperABI.abi,
        functionName: 'dent',
        args: [auctionId, lot, bid],
        type: 'legacy',
        gas: 3000000n,
        gasPrice: 21000000000n,
        maxFeePerGas: undefined,
        maxPriorityFeePerGas: undefined,
      } as any)
    }
    
    return {
      dent,
      hash,
      isPending,
      isConfirming,
      isSuccess,
      error,
    }
  }
  
  // Deal (claim won auction)
  const useDeal = () => {
    const { data: hash, writeContract, isPending, error } = useWriteContract()

    const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({
      hash,
    })

    const deal = (auctionId: bigint) => {
      writeContract({
        address: flopperAddress,
        abi: FlopperABI.abi,
        functionName: 'deal',
        args: [auctionId],
        type: 'legacy',
        gas: 3000000n,
        gasPrice: 21000000000n,
        maxFeePerGas: undefined,
        maxPriorityFeePerGas: undefined,
      } as any)
    }

    return {
      deal,
      hash,
      isPending,
      isConfirming,
      isSuccess,
      error,
    }
  }
  
  return {
    address: flopperAddress,
    useBid,
    useKicks,
    useDent,
    useDeal,
  }
}

