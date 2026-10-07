'use client'

import { useCallback } from 'react'
import { useAccount, usePublicClient, useWriteContract } from 'wagmi'
import { APP_CHAIN_ID } from '@/config/networks'
import { getTransactionGasConfigWithOverrides } from '@/config/transaction'
import { type KusdStep, TransactionRevertedError } from '@/lib/kusdSteps'
import { UserError } from '@/lib/txError'

/** `onHash` hears the hash as soon as the wallet broadcasts — before the receipt wait, which can still fail. */
export type KusdSend = (step: KusdStep, onHash?: (hash: `0x${string}`) => void) => Promise<`0x${string}`>

/**
 * Sends one step the way every KUSD write here goes out: the step's own gas limit, the KalyChain
 * 21 gwei fee floor pinned to the app's chain (config/transaction.ts), and a receipt check that throws
 * on a mined-but-reverted transaction.
 */
export function useKusdWriter(): KusdSend {
  const { writeContractAsync } = useWriteContract()
  const { address } = useAccount()
  const publicClient = usePublicClient({ chainId: APP_CHAIN_ID })

  return useCallback<KusdSend>(
    async ({ write, gas, action }, onHash) => {
      if (!address) throw new UserError('Connect your wallet first.')
      if (!publicClient) throw new UserError('Could not reach KalyChain. Please try again.')
      const hash = await writeContractAsync({ ...write, ...getTransactionGasConfigWithOverrides({ gas }) })
      onHash?.(hash)
      const receipt = await publicClient.waitForTransactionReceipt({ hash })
      if (receipt.status !== 'success') throw new TransactionRevertedError(hash, action)
      return hash
    },
    [writeContractAsync, address, publicClient],
  )
}

export type StepProgress = (index: number, total: number, step: KusdStep) => void

/**
 * Runs steps in order, each only after the previous one mined successfully; stops at the first
 * failure (the error propagates, later steps never send). Returns every hash.
 */
export function useKusdSteps(): (steps: KusdStep[], onStep?: StepProgress) => Promise<`0x${string}`[]> {
  const send = useKusdWriter()
  return useCallback(
    async (steps, onStep) => {
      const hashes: `0x${string}`[] = []
      for (const [index, step] of steps.entries()) {
        onStep?.(index, steps.length, step)
        hashes.push(await send(step))
      }
      return hashes
    },
    [send],
  )
}
