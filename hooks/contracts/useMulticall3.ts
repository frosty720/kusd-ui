import { useWriteContract, useWaitForTransactionReceipt } from 'wagmi'
import { encodeFunctionData } from 'viem'

// Multicall3 standard address (deployed on 250+ chains)
// If not deployed on your chain, deploy it yourself and set NEXT_PUBLIC_MULTICALL3_ADDRESS in .env
const MULTICALL3_ADDRESS = (process.env.NEXT_PUBLIC_MULTICALL3_ADDRESS || '0xcA11bde05977b3631167028862bE2a173976CA11') as `0x${string}`

// Multicall3 ABI (only the functions we need)
const MULTICALL3_ABI = [
  {
    inputs: [
      {
        components: [
          { name: 'target', type: 'address' },
          { name: 'allowFailure', type: 'bool' },
          { name: 'callData', type: 'bytes' },
        ],
        name: 'calls',
        type: 'tuple[]',
      },
    ],
    name: 'aggregate3',
    outputs: [
      {
        components: [
          { name: 'success', type: 'bool' },
          { name: 'returnData', type: 'bytes' },
        ],
        name: 'returnData',
        type: 'tuple[]',
      },
    ],
    stateMutability: 'payable',
    type: 'function',
  },
] as const

export const useMulticall3 = () => {
  const { data: hash, writeContract, isPending, error } = useWriteContract()

  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({
    hash,
  })

  /**
   * Execute multiple contract calls in a single transaction
   * @param calls Array of { target, allowFailure, callData }
   */
  const aggregate3 = (
    calls: Array<{
      target: `0x${string}`
      allowFailure: boolean
      callData: `0x${string}`
    }>
  ) => {
    writeContract({
      address: MULTICALL3_ADDRESS,
      abi: MULTICALL3_ABI,
      functionName: 'aggregate3',
      args: [calls],
      gas: 5000000n,
      gasPrice: 21000000000n,
    })
  }

  return {
    aggregate3,
    hash,
    isPending,
    isConfirming,
    isSuccess,
    error,
  }
}

/**
 * Helper function to encode a function call
 * @param abi Contract ABI
 * @param functionName Function name to call
 * @param args Function arguments
 */
export const encodeCall = (
  abi: any,
  functionName: string,
  args?: any[]
): `0x${string}` => {
  return encodeFunctionData({
    abi,
    functionName,
    args,
  })
}

