import { useReadContract, useWriteContract, useWaitForTransactionReceipt } from 'wagmi'
import { type Address, encodeFunctionData } from 'viem'
import { getContracts } from '@/config/contracts'
import ProxyRegistryABI from '@/abis/ProxyRegistry.json'
import DSProxyABI from '@/abis/DSProxy.json'
import KssProxyActionsABI from '@/abis/KssProxyActions.json'

/**
 * Hook for interacting with DSProxy infrastructure
 * Provides functions to check, deploy, and execute actions through user's proxy
 */
export function useDSProxy(chainId: number = 3889) {
  const contracts = getContracts(chainId)
  const { writeContract, data: hash, error, isPending } = useWriteContract()
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash })

  /**
   * Check if user has a proxy deployed
   */
  const useHasProxy = (userAddress: Address | undefined) => {
    return useReadContract({
      address: contracts.core.proxyRegistry,
      abi: ProxyRegistryABI,
      functionName: 'proxies',
      args: userAddress ? [userAddress] : undefined,
      query: {
        enabled: !!userAddress,
        refetchInterval: 2000, // Refetch every 2 seconds to catch new deployments
      },
    })
  }

  /**
   * Deploy a new proxy for the user
   */
  const buildProxy = () => {
    writeContract({
      address: contracts.core.proxyRegistry,
      abi: ProxyRegistryABI,
      functionName: 'build',
      args: [],
      gas: 3000000n,
      gasPrice: 21000000000n,
    })
  }

  /**
   * Execute an action through the user's proxy using DELEGATECALL
   * @param proxyAddress - User's DSProxy address
   * @param actionData - Encoded function call data for KssProxyActions
   */
  const executeAction = (proxyAddress: Address, actionData: `0x${string}`) => {
    // Use the execute(address,bytes) overload by specifying the exact ABI item
    const executeAbi = DSProxyABI.find(
      (item: any) =>
        item.type === 'function' &&
        item.name === 'execute' &&
        item.inputs.length === 2 &&
        item.inputs[0].type === 'address'
    )

    writeContract({
      address: proxyAddress,
      abi: executeAbi ? [executeAbi] : DSProxyABI,
      functionName: 'execute',
      args: [contracts.core.proxyActions, actionData],
      gas: 5000000n,
      gasPrice: 21000000000n,
      maxFeePerGas: undefined,
      maxPriorityFeePerGas: undefined,
    } as any)
  }

  /**
   * Encode DSR deposit action (join)
   * This calls drip() and join() in the same transaction via DELEGATECALL
   */
  const encodeJoinAction = (wad: bigint): `0x${string}` => {
    return encodeFunctionData({
      abi: KssProxyActionsABI,
      functionName: 'join',
      args: [contracts.core.kusdJoin, contracts.core.pot, wad],
    })
  }

  /**
   * Encode DSR withdrawal action (exit)
   */
  const encodeExitAction = (wad: bigint): `0x${string}` => {
    return encodeFunctionData({
      abi: KssProxyActionsABI,
      functionName: 'exit',
      args: [contracts.core.kusdJoin, contracts.core.pot, wad],
    })
  }

  /**
   * Encode DSR withdraw all action (exitAll)
   */
  const encodeExitAllAction = (): `0x${string}` => {
    return encodeFunctionData({
      abi: KssProxyActionsABI,
      functionName: 'exitAll',
      args: [contracts.core.kusdJoin, contracts.core.pot],
    })
  }

  return {
    // Proxy management
    useHasProxy,
    buildProxy,
    executeAction,
    
    // Action encoders
    encodeJoinAction,
    encodeExitAction,
    encodeExitAllAction,
    
    // Transaction state
    isPending,
    isConfirming,
    isSuccess,
    error,
    hash,
  }
}

