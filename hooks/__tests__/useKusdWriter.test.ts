/**
 * @vitest-environment happy-dom
 *
 * Every buy, sell and cash-out write goes through useKusdWriter: it must carry the KalyChain 21 gwei
 * floor on the app's chain and the step's own gas limit, treat a mined-but-reverted transaction as a
 * failure, and the step runner must stop at the first failed step so a later step never goes out.
 */
import { cleanup, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { kusdTrade } from '@/config/kusdTrade'
import { approveStep, psmSwapStep, TransactionRevertedError } from '@/lib/kusdSteps'
import { UserError } from '@/lib/txError'

const OWNER = '0x1111111111111111111111111111111111111111'
const trade = kusdTrade(3890)!
const writeContractAsync = vi.fn(async (_request: Record<string, unknown>) => '0xhash' as `0x${string}`)
const waitForTransactionReceipt = vi.fn(async (_args: unknown) => ({ status: 'success' }))
let account: string | undefined = OWNER

vi.mock('wagmi', () => ({
  useAccount: () => ({ address: account }),
  usePublicClient: () => ({ waitForTransactionReceipt }),
  useWriteContract: () => ({ writeContractAsync }),
}))

import { useKusdSteps, useKusdWriter } from '../useKusdWriter'

beforeEach(() => {
  account = OWNER
  writeContractAsync.mockClear()
  waitForTransactionReceipt.mockReset()
  waitForTransactionReceipt.mockImplementation(async () => ({ status: 'success' }))
})
afterEach(cleanup)

describe('useKusdWriter', () => {
  it('sends on KalyChain 3890 with the 21 gwei tip and the step gas limit', async () => {
    const send = renderHook(() => useKusdWriter()).result.current
    const step = psmSwapStep(trade.psm, 'sell', OWNER, 1_000_000n)
    await send(step)
    const request = writeContractAsync.mock.calls[0][0]
    expect(request).toMatchObject({ address: trade.psm, functionName: 'sellGem', args: [OWNER, 1_000_000n], chainId: 3890 })
    expect(request.maxPriorityFeePerGas).toBe(21_000_000_000n)
    expect(request.maxFeePerGas).toBe(26_000_000_000n)
    expect(request.gas).toBe(step.gas)
  })

  it('reports the hash as soon as the wallet broadcasts, before waiting for the receipt', async () => {
    const seen: string[] = []
    waitForTransactionReceipt.mockImplementationOnce(async () => {
      seen.push('receipt')
      return { status: 'success' }
    })
    const send = renderHook(() => useKusdWriter()).result.current
    await send(psmSwapStep(trade.psm, 'buy', OWNER, 1n), (hash) => seen.push(hash))
    expect(seen).toEqual(['0xhash', 'receipt'])
  })

  it('reports no hash when the wallet never broadcasts', async () => {
    writeContractAsync.mockRejectedValueOnce(new Error('User rejected the request.'))
    const onHash = vi.fn()
    const send = renderHook(() => useKusdWriter()).result.current
    await expect(send(psmSwapStep(trade.psm, 'buy', OWNER, 1n), onHash)).rejects.toThrow()
    expect(onHash).not.toHaveBeenCalled()
  })

  it('throws on a mined-but-reverted transaction', async () => {
    waitForTransactionReceipt.mockImplementationOnce(async () => ({ status: 'reverted' }))
    const send = renderHook(() => useKusdWriter()).result.current
    await expect(send(psmSwapStep(trade.psm, 'sell', OWNER, 1n))).rejects.toBeInstanceOf(TransactionRevertedError)
  })

  it('refuses to send without a connected wallet', async () => {
    account = undefined
    const send = renderHook(() => useKusdWriter()).result.current
    await expect(send(psmSwapStep(trade.psm, 'sell', OWNER, 1n))).rejects.toBeInstanceOf(UserError)
    expect(writeContractAsync).not.toHaveBeenCalled()
  })
})

describe('useKusdSteps', () => {
  it('runs steps in order and reports progress', async () => {
    const run = renderHook(() => useKusdSteps()).result.current
    const progress: Array<[number, number]> = []
    await run([approveStep(trade.gem.address, trade.psm, 5n), psmSwapStep(trade.psm, 'sell', OWNER, 5n)], (i, total) => progress.push([i, total]))
    expect(writeContractAsync.mock.calls.map(([r]) => r.functionName)).toEqual(['approve', 'sellGem'])
    expect(progress).toEqual([
      [0, 2],
      [1, 2],
    ])
  })

  it('stops at the first failed step — later steps are never sent', async () => {
    waitForTransactionReceipt.mockImplementationOnce(async () => ({ status: 'reverted' }))
    const run = renderHook(() => useKusdSteps()).result.current
    await expect(run([approveStep(trade.gem.address, trade.psm, 5n), psmSwapStep(trade.psm, 'sell', OWNER, 5n)])).rejects.toBeInstanceOf(
      TransactionRevertedError,
    )
    expect(writeContractAsync).toHaveBeenCalledTimes(1)
  })
})
