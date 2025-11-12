/**
 * Pot Contract Hook
 * 
 * Hook for interacting with the Pot (KUSD Savings Rate / DSR) contract.
 */

import { useReadContract, useWriteContract, useWaitForTransactionReceipt } from 'wagmi'
import { type Address } from 'viem'
import PotABI from '@/abis/Pot.json'
import { getContracts } from '@/config/contracts'

export function usePot(chainId: number) {
  const contracts = getContracts(chainId)
  const potAddress = contracts.core.pot
  
  /**
   * Read Functions
   */
  
  // Get user's DSR deposit (pie)
  const usePie = (user: Address | undefined) => {
    return useReadContract({
      address: potAddress,
      abi: PotABI.abi,
      functionName: 'pie',
      args: user ? [user] : undefined,
      query: {
        enabled: !!user,
        refetchInterval: 10000,
      },
    })
  }
  
  // Get total DSR deposits (Pie)
  const useTotalPie = () => {
    return useReadContract({
      address: potAddress,
      abi: PotABI.abi,
      functionName: 'Pie',
      query: {
        refetchInterval: 10000,
      },
    })
  }
  
  // Get DSR accumulator (chi)
  const useChi = () => {
    return useReadContract({
      address: potAddress,
      abi: PotABI.abi,
      functionName: 'chi',
      query: {
        refetchInterval: 10000,
      },
    })
  }
  
  // Get DSR rate (dsr)
  const useDsr = () => {
    return useReadContract({
      address: potAddress,
      abi: PotABI.abi,
      functionName: 'dsr',
      query: {
        refetchInterval: 30000,
      },
    })
  }
  
  // Get last drip timestamp (rho)
  const useRho = () => {
    return useReadContract({
      address: potAddress,
      abi: PotABI.abi,
      functionName: 'rho',
      query: {
        refetchInterval: 3000, // Refetch every 3 seconds to catch drip updates quickly
      },
    })
  }
  
  // Get vat address
  const useVat = () => {
    return useReadContract({
      address: potAddress,
      abi: PotABI.abi,
      functionName: 'vat',
    })
  }
  
  /**
   * Write Functions
   */
  
  // Drip (update chi accumulator)
  const useDrip = () => {
    const { data: hash, writeContract, isPending, error } = useWriteContract()

    const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({
      hash,
    })

    const drip = () => {
      writeContract({
        address: potAddress,
        abi: PotABI.abi,
        functionName: 'drip',
        gas: 5000000n, // Increased from 3M to 5M
        gasPrice: 21000000000n,
      })
    }

    return {
      drip,
      hash,
      isPending,
      isConfirming,
      isSuccess,
      error,
    }
  }
  
  // Join (deposit KUSD into DSR)
  const useJoin = () => {
    const { data: hash, writeContract, isPending, error } = useWriteContract()

    const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({
      hash,
    })

    const join = (amount: bigint) => {
      writeContract({
        address: potAddress,
        abi: PotABI.abi,
        functionName: 'join',
        args: [amount],
        gas: 5000000n, // Increased from 3M to 5M
        gasPrice: 21000000000n,
      })
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
  
  // Exit (withdraw KUSD from DSR)
  const useExit = () => {
    const { data: hash, writeContract, isPending, error } = useWriteContract()

    const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({
      hash,
    })

    const exit = (amount: bigint) => {
      writeContract({
        address: potAddress,
        abi: PotABI.abi,
        functionName: 'exit',
        args: [amount],
        gas: 5000000n, // Increased from 3M to 5M
        gasPrice: 21000000000n,
      })
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
  
  // Exit All (withdraw all KUSD from DSR)
  const useExitAll = () => {
    const { data: hash, writeContract, isPending, error } = useWriteContract()

    const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({
      hash,
    })

    const exitAll = () => {
      writeContract({
        address: potAddress,
        abi: PotABI.abi,
        functionName: 'exit',
        args: [2n ** 256n - 1n], // Max uint256 to exit all
        gas: 5000000n, // Increased from 3M to 5M
        gasPrice: 21000000000n,
      })
    }

    return {
      exitAll,
      hash,
      isPending,
      isConfirming,
      isSuccess,
      error,
    }
  }
  
  return {
    address: potAddress,
    usePie,
    useTotalPie,
    useChi,
    useDsr,
    useRho,
    useVat,
    useDrip,
    useJoin,
    useExit,
    useExitAll,
  }
}

