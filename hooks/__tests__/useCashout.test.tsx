/**
 * @vitest-environment happy-dom
 *
 * The cash-out's money-safety rules: nothing is sent while Polygon holds less USDT than the cash-out;
 * USDT that left the PSM but never crossed the bridge is reported as stranded (so it can be resumed),
 * and only when that is certain; and once the bridge transaction is broadcast nothing is reported as
 * stranded, because a resume there could send the same USDT twice.
 */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { cleanup, renderHook } from '@testing-library/react'
import type { ReactNode } from 'react'
import { encodeEventTopics } from 'viem'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mailboxAbi } from '@/abis/hyperlane'
import { kusdTrade } from '@/config/kusdTrade'
import { CashoutStrandedError } from '@/lib/cashout'
import { TransactionRevertedError } from '@/lib/kusdSteps'
import { UserError } from '@/lib/txError'

const OWNER = '0x1111111111111111111111111111111111111111'
const TREASURY = '0x3333333333333333333333333333333333333333'
const MAILBOX = '0x4444444444444444444444444444444444444444'
const MESSAGE_ID = `0x${'ab'.repeat(32)}` as const
const USDT = 10n ** 6n
const WAD = 10n ** 18n
const trade = kusdTrade(3890)!
const route = trade.cashout!
const plan = { gemAmt: 50n * USDT, cost: 50n * WAD }

let collateral = 194n * USDT
let walletUsdt: bigint[] = []
const polygonRead = vi.fn(async (_args: { functionName: string }) => collateral)
const kalyRead = vi.fn(async ({ functionName }: { functionName: string }) => {
  if (functionName === 'quoteGasPayment') return 0n
  if (functionName === 'mailbox') return MAILBOX
  return walletUsdt.shift() ?? 0n
})
const writeContractAsync = vi.fn(async (request: { functionName: string }) => `0x${request.functionName}` as `0x${string}`)
const waitForTransactionReceipt = vi.fn(async (_args: unknown) => ({ status: 'success' }))
const dispatchLog = { address: MAILBOX, topics: encodeEventTopics({ abi: mailboxAbi, eventName: 'DispatchId', args: { messageId: MESSAGE_ID } }), data: '0x' }
const getTransactionReceipt = vi.fn(async (_args: unknown) => ({ logs: [dispatchLog] }))

vi.mock('wagmi', () => ({
  useAccount: () => ({ address: OWNER }),
  usePublicClient: () => ({ readContract: kalyRead, waitForTransactionReceipt, getTransactionReceipt }),
  useWriteContract: () => ({ writeContractAsync }),
}))
vi.mock('@/config/polygon', () => ({ polygonClient: { readContract: (args: { functionName: string }) => polygonRead(args) } }))

import { useCashout } from '../useCashout'

function hook() {
  const client = new QueryClient()
  const wrapper = ({ children }: { children: ReactNode }) => <QueryClientProvider client={client}>{children}</QueryClientProvider>
  return renderHook(() => useCashout(trade, route), { wrapper }).result.current
}
const sent = () => writeContractAsync.mock.calls.map(([r]) => r.functionName)

/** Our server route for the limit (the paid RPC behind it); down by default, so the browser RPC answers. */
let capacityRoute: (() => Response) | null = null

beforeEach(() => {
  capacityRoute = null
  polygonRead.mockClear()
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: string | URL | Request) => {
      if (String(input) === '/api/ramp/cashout-capacity' && capacityRoute) return capacityRoute()
      throw new TypeError('fetch failed')
    }),
  )
  collateral = 194n * USDT
  walletUsdt = [0n, 50n * USDT]
  writeContractAsync.mockClear()
  waitForTransactionReceipt.mockReset()
  waitForTransactionReceipt.mockImplementation(async () => ({ status: 'success' }))
  getTransactionReceipt.mockClear()
})
afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

describe('useCashout', () => {
  it('approves the exact KUSD, swaps, then bridges the same USDT to the recipient, and reads the message id', async () => {
    const result = await hook().cashout({ plan, recipient: TREASURY, kusdAllowance: 0n })
    expect(sent()).toEqual(['approve', 'buyGem', 'transferRemote'])
    expect(writeContractAsync.mock.calls[2][0]).toMatchObject({ args: [137, `0x000000000000000000000000${TREASURY.slice(2)}`, plan.gemAmt] })
    expect(result).toEqual({ gemAmt: plan.gemAmt, recipient: TREASURY, hash: '0xtransferRemote', messageId: MESSAGE_ID })
  })

  it("takes the limit from our server route (the paid RPC) and skips the browser's Polygon RPC", async () => {
    capacityRoute = () => new Response(JSON.stringify({ collateral: String(194n * USDT) }), { status: 200 })
    await hook().cashout({ plan, recipient: TREASURY, kusdAllowance: 0n })
    expect(sent()).toEqual(['approve', 'buyGem', 'transferRemote'])
    expect(polygonRead).not.toHaveBeenCalled()
  })

  it("still blocks on the route's limit, and falls back to the browser RPC when the route is down or answers nonsense", async () => {
    capacityRoute = () => new Response(JSON.stringify({ collateral: String(49n * USDT) }), { status: 200 })
    await expect(hook().cashout({ plan, recipient: TREASURY, kusdAllowance: 0n })).rejects.toBeInstanceOf(UserError)
    expect(writeContractAsync).not.toHaveBeenCalled()

    capacityRoute = () => new Response(JSON.stringify({ error: 'unavailable' }), { status: 503 })
    await hook().resumeBridge({ gemAmt: plan.gemAmt, recipient: TREASURY })
    capacityRoute = () => new Response(JSON.stringify({ collateral: '-1' }), { status: 200 })
    await hook().resumeBridge({ gemAmt: plan.gemAmt, recipient: TREASURY })
    expect(polygonRead).toHaveBeenCalledTimes(2)
  })

  it('sends nothing when Polygon holds less USDT than the cash-out', async () => {
    collateral = 49n * USDT
    await expect(hook().cashout({ plan, recipient: TREASURY, kusdAllowance: 0n })).rejects.toBeInstanceOf(UserError)
    expect(writeContractAsync).not.toHaveBeenCalled()
  })

  it('re-checks Polygon right before the bridge: USDT swapped but not bridged is stranded', async () => {
    polygonRead.mockResolvedValueOnce(194n * USDT).mockResolvedValueOnce(10n * USDT)
    const error = await hook()
      .cashout({ plan, recipient: TREASURY, kusdAllowance: plan.cost })
      .catch((e) => e)
    expect(sent()).toEqual(['buyGem'])
    expect(error).toBeInstanceOf(CashoutStrandedError)
    expect(error).toMatchObject({ gemAmt: plan.gemAmt, recipient: TREASURY })
  })

  it('reports the USDT as stranded when the wallet refuses the bridge after the swap mined', async () => {
    writeContractAsync.mockImplementation(async (request) => {
      if (request.functionName === 'transferRemote') throw new Error('User rejected the request.')
      return `0x${request.functionName}` as `0x${string}`
    })
    await expect(hook().cashout({ plan, recipient: TREASURY, kusdAllowance: plan.cost })).rejects.toBeInstanceOf(CashoutStrandedError)
    writeContractAsync.mockImplementation(async (request) => `0x${request.functionName}` as `0x${string}`)
  })

  it('reports the USDT as stranded when the bridge reverted on-chain (the burn rolled back)', async () => {
    waitForTransactionReceipt.mockImplementation(async (args) =>
      (args as { hash: string }).hash === '0xtransferRemote' ? { status: 'reverted' } : { status: 'success' },
    )
    const error = await hook()
      .cashout({ plan, recipient: TREASURY, kusdAllowance: plan.cost })
      .catch((e) => e)
    expect(error).toBeInstanceOf(CashoutStrandedError)
    expect((error as CashoutStrandedError).cause).toBeInstanceOf(TransactionRevertedError)
  })

  it('never reports a broadcast bridge as stranded: an unknown outcome comes back as sent, without a message id', async () => {
    waitForTransactionReceipt.mockImplementation(async (args) => {
      if ((args as { hash: string }).hash === '0xtransferRemote') throw new Error('timed out waiting for the receipt')
      return { status: 'success' }
    })
    getTransactionReceipt.mockRejectedValueOnce(new Error('not found'))
    const result = await hook().cashout({ plan, recipient: TREASURY, kusdAllowance: plan.cost })
    expect(result).toEqual({ gemAmt: plan.gemAmt, recipient: TREASURY, hash: '0xtransferRemote', messageId: null })
  })

  it('a swap whose receipt wait failed is stranded only if its USDT reached the wallet', async () => {
    waitForTransactionReceipt.mockImplementationOnce(async () => {
      throw new Error('timed out')
    })
    await expect(hook().cashout({ plan, recipient: TREASURY, kusdAllowance: plan.cost })).rejects.toBeInstanceOf(CashoutStrandedError)
    expect(sent()).toEqual(['buyGem'])

    writeContractAsync.mockClear()
    walletUsdt = [0n, 0n]
    waitForTransactionReceipt.mockImplementationOnce(async () => {
      throw new Error('timed out')
    })
    const error = await hook()
      .cashout({ plan, recipient: TREASURY, kusdAllowance: plan.cost })
      .catch((e) => e)
    expect(error).not.toBeInstanceOf(CashoutStrandedError)
    expect(sent()).toEqual(['buyGem'])
  })

  it('resumes with the bridge step alone', async () => {
    const result = await hook().resumeBridge({ gemAmt: plan.gemAmt, recipient: TREASURY })
    expect(sent()).toEqual(['transferRemote'])
    expect(result.messageId).toBe(MESSAGE_ID)
  })
})
