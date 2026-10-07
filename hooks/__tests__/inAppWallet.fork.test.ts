/**
 * The cash-out through a thirdweb wallet, on a fork of KalyChain 3890. The in-app (email) wallet
 * reaches wagmi through thirdweb's EIP-1193 adapter (config/thirdwebBridge.ts), so every write goes
 * viem → EIP1193.toProvider → thirdweb sendTransaction → the account. This runs that same path with a
 * thirdweb account and checks what lands on-chain: our gas limit and the 21 gwei tip (an EIP-1559
 * transaction, never re-priced by the wallet), the swap, and the USDT burned toward Polygon.
 *
 * Needs a fork: `anvil --fork-url https://mainrpc.kalychain.io/rpc --port 8547`, then
 * `KUSD_FORK_RPC=http://127.0.0.1:8547 npx vitest run hooks/__tests__/inAppWallet.fork.test.ts`.
 */
import { createThirdwebClient, defineChain } from 'thirdweb'
import { EIP1193, privateKeyToAccount } from 'thirdweb/wallets'
import { createPublicClient, createWalletClient, custom, erc20Abi, http, parseEventLogs, defineChain as viemChain } from 'viem'
import { describe, expect, it } from 'vitest'
import { mailboxAbi, warpRouteAbi } from '@/abis/hyperlane'
import { kusdTrade } from '@/config/kusdTrade'
import { getTransactionGasConfigWithOverrides } from '@/config/transaction'
import { dispatchedMessageId } from '@/lib/cashout'
import { bridgeToPolygonStep, cashoutSwapSteps, type KusdStep } from '@/lib/kusdSteps'
import { describeError } from '@/lib/txError'

const FORK = process.env.KUSD_FORK_RPC
const trade = kusdTrade(3890)!
const route = trade.cashout!
const TREASURY = '0xAc148dEe99DD80B054378993bb7259831C51dF05'
const USDT = 10n ** 6n
const WAD = 10n ** 18n
// anvil's default account #1 (a well-known test key, never used on a live chain)
const TEST_KEY = '0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d'

describe.skipIf(!FORK)('cash-out through a thirdweb wallet (3890 fork)', { timeout: 120_000 }, () => {
  // A skipped describe still builds its clients (no request is made), so they need some URL.
  const rpc = FORK ?? 'http://127.0.0.1:8547'
  const chain = viemChain({
    id: 3890,
    name: 'KalyChain fork',
    nativeCurrency: { name: 'KMT', symbol: 'KMT', decimals: 18 },
    rpcUrls: { default: { http: [rpc] } },
  })
  const kaly = createPublicClient({ chain, transport: http(rpc), pollingInterval: 250 })
  const client = createThirdwebClient({ clientId: 'fork-test' })
  const twChain = defineChain({ id: 3890, rpc })
  const account = privateKeyToAccount({ client, privateKey: TEST_KEY })
  // The wallet surface EIP1193.toProvider uses; the in-app wallet supplies the same account interface.
  const wallet = { getAccount: () => account, subscribe: () => () => undefined, switchChain: async () => undefined } as unknown as Parameters<
    typeof EIP1193.toProvider
  >[0]['wallet']
  const provider = EIP1193.toProvider({ wallet, chain: twChain, client })
  const owner = account.address as `0x${string}`
  const signer = createWalletClient({ chain, transport: custom(provider), account: owner })

  const testRpc = (method: string, params: unknown[]) => kaly.request({ method, params } as never)
  const send = async (step: KusdStep) => {
    // What useKusdWriter sends through wagmi: the step plus config/transaction.ts gas settings.
    const hash = await signer.writeContract({ ...step.write, ...getTransactionGasConfigWithOverrides({ gas: step.gas }) } as never)
    const receipt = await kaly.waitForTransactionReceipt({ hash })
    return { hash, receipt, tx: await kaly.getTransaction({ hash }) }
  }

  it('approves, swaps KUSD → USDT and bridges it toward Polygon as EIP-1559 transactions at our gas and 21 gwei tip', async () => {
    await testRpc('anvil_setBalance', [owner, '0x16345785D8A0000']) // 0.1 KMT for gas
    await testRpc('anvil_impersonateAccount', [trade.psm])
    await testRpc('anvil_setBalance', [trade.psm, '0xDE0B6B3A7640000'])
    const fund = await createWalletClient({ chain, transport: http(rpc), account: trade.psm }).writeContract({
      address: trade.kusd.address,
      abi: erc20Abi,
      functionName: 'transfer',
      args: [owner, 20n * WAD],
    })
    await kaly.waitForTransactionReceipt({ hash: fund })

    const balances = () =>
      Promise.all([
        kaly.readContract({ address: trade.kusd.address, abi: erc20Abi, functionName: 'balanceOf', args: [owner] }),
        kaly.readContract({ address: trade.gem.address, abi: erc20Abi, functionName: 'balanceOf', args: [owner] }),
      ])
    const [kusdBefore, usdtBefore] = await balances()
    const plan = { gemAmt: 10n * USDT, cost: 10n * WAD }
    const fee = await kaly.readContract({ address: trade.gem.address, abi: warpRouteAbi, functionName: 'quoteGasPayment', args: [route.destinationDomain] })
    const mailbox = await kaly.readContract({ address: trade.gem.address, abi: warpRouteAbi, functionName: 'mailbox' })
    const steps = [...cashoutSwapSteps(trade, owner, plan, 0n), bridgeToPolygonStep(trade.gem.address, route, TREASURY, plan.gemAmt, fee)]
    expect(steps.map((s) => s.write.functionName)).toEqual(['approve', 'buyGem', 'transferRemote'])

    const sent = []
    for (const step of steps) sent.push(await send(step))
    for (const [i, { receipt, tx }] of sent.entries()) {
      expect(receipt.status).toBe('success')
      expect(tx.type).toBe('eip1559')
      expect(tx.maxPriorityFeePerGas).toBe(21_000_000_000n)
      expect(tx.maxFeePerGas).toBe(26_000_000_000n)
      expect(tx.gas).toBe(steps[i].gas)
      expect(receipt.gasUsed < steps[i].gas).toBe(true)
    }

    // 10 KUSD left the wallet; the 10 USDT it bought was burned by the bridge (the synthetic's transferRemote).
    const [kusdAfter, usdtAfter] = await balances()
    expect(kusdBefore - kusdAfter).toBe(10n * WAD)
    expect(usdtAfter).toBe(usdtBefore)
    const bridgeLogs = sent[2].receipt.logs
    const dispatch = parseEventLogs({ abi: mailboxAbi, eventName: 'Dispatch', logs: bridgeLogs })[0]
    expect(dispatch.args.destination).toBe(137)
    expect(dispatch.args.recipient.toLowerCase()).toBe(route.polygonRouter.toLowerCase().replace('0x', `0x${'0'.repeat(24)}`))
    expect(dispatch.args.message.toLowerCase()).toContain(TREASURY.slice(2).toLowerCase())
    expect(dispatchedMessageId(bridgeLogs, mailbox)).toMatch(/^0x[0-9a-f]{64}$/)
  })

  it('a wallet with no KMT for gas is refused before anything is sent, in words the user understands', async () => {
    await testRpc('anvil_setBalance', [owner, '0x0'])
    const nonce = await kaly.getTransactionCount({ address: owner })
    const error = await send(cashoutSwapSteps(trade, owner, { gemAmt: USDT, cost: WAD }, 0n)[0]).catch((e) => e)
    expect(error).toBeInstanceOf(Error)
    expect(describeError(error)).toBe('You do not have enough funds for this transaction.')
    expect(await kaly.getTransactionCount({ address: owner })).toBe(nonce)
  })
})
