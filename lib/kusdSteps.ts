/**
 * Every write buying, selling or cashing out KUSD makes, as pure steps: which contract, which call,
 * which arguments, in which order, with its gas limit. The hooks only run these.
 */
import { type Abi, erc20Abi, pad } from 'viem'
import { psmAbi, warpRouteAbi } from '@/abis/hyperlane'
import type { CashoutRoute } from '@/config/contracts'
import type { KusdTrade } from '@/config/kusdTrade'
import { TRANSACTION_GAS_CONFIG } from '@/config/transaction'
import type { CashoutPlan } from './cashout'
import type { PsmDirection } from './psm'

/**
 * Gas limits, measured on 3890 with headroom: an ERC-20 approve, KssLitePsm sellGem 77,240 / buyGem
 * 60,562 (KalySwap's fork test), and the USDT route's transferRemote 119,549. A limit is also the
 * wallet's spend ceiling (limit × maxFeePerGas), so none is larger than it needs to be.
 */
const APPROVE_GAS = 100_000n
const PSM_SWAP_GAS = 200_000n
const BRIDGE_TRANSFER_REMOTE_GAS = 250_000n

export type StepAction = 'approve' | 'swap' | 'bridge'

const ACTION_NAMES: Record<StepAction, string> = { approve: 'Approval', swap: 'Swap', bridge: 'Bridge transfer' }

export interface KusdWrite {
  address: `0x${string}`
  abi: Abi
  functionName: string
  args?: readonly unknown[]
  value?: bigint
}

export interface KusdStep {
  write: KusdWrite
  gas: bigint
  action: StepAction
}

/** An exact ERC-20 approval (never unlimited): the spender can pull `amount` and nothing more. */
export function approveStep(token: `0x${string}`, spender: `0x${string}`, amount: bigint): KusdStep {
  return { write: { address: token, abi: erc20Abi, functionName: 'approve', args: [spender, amount] }, gas: APPROVE_GAS, action: 'approve' }
}

/** sellGem (USDT → KUSD) or buyGem (KUSD → USDT) to `owner`; the argument is the USDT amount both ways. */
export function psmSwapStep(psm: `0x${string}`, direction: PsmDirection, owner: `0x${string}`, gemAmt: bigint): KusdStep {
  return {
    write: { address: psm, abi: psmAbi, functionName: direction === 'sell' ? 'sellGem' : 'buyGem', args: [owner, gemAmt] },
    gas: PSM_SWAP_GAS,
    action: 'swap',
  }
}

/**
 * Send `gemAmt` USDT from KalyChain to `recipient` on Polygon over the USDT warp route. USDT on
 * KalyChain is the route's synthetic (`usdt` is the route itself), so transferRemote burns it from the
 * sender with no approval; the Polygon router releases real USDT once the message is relayed. `fee`
 * is the route's quoteGasPayment, read live (0 today). A zero fee sends no `value` at all: thirdweb
 * wallets (the in-app wallet's path) sign viem's "0x0" into a transaction the node cannot decode.
 */
export function bridgeToPolygonStep(usdt: `0x${string}`, route: CashoutRoute, recipient: `0x${string}`, gemAmt: bigint, fee: bigint): KusdStep {
  return {
    write: {
      address: usdt,
      abi: warpRouteAbi,
      functionName: 'transferRemote',
      args: [route.destinationDomain, pad(recipient, { size: 32 }), gemAmt],
      ...(fee > 0n ? { value: fee } : {}),
    },
    gas: BRIDGE_TRANSFER_REMOTE_GAS,
    action: 'bridge',
  }
}

/** The swap half of a cash-out: KUSD → USDT at the PSM, into the owner's wallet (exact approval first if needed). */
export function cashoutSwapSteps(trade: KusdTrade, owner: `0x${string}`, plan: CashoutPlan, kusdAllowance: bigint): KusdStep[] {
  const approve = kusdAllowance >= plan.cost ? [] : [approveStep(trade.kusd.address, trade.psm, plan.cost)]
  return [...approve, psmSwapStep(trade.psm, 'buy', owner, plan.gemAmt)]
}

/**
 * The most KMT `steps` can cost: each gas limit at the max fee. A wallet refuses a step unless the
 * balance covers its share, so a balance below this can strand the cash-out halfway.
 */
export function feeCeiling(steps: KusdStep[]): bigint {
  return steps.reduce((sum, step) => sum + step.gas, 0n) * TRANSACTION_GAS_CONFIG.maxFeePerGas
}

/** A transaction that was mined but reverted. */
export class TransactionRevertedError extends Error {
  readonly hash: string
  readonly action: StepAction

  constructor(hash: string, action: StepAction) {
    super(`${ACTION_NAMES[action]} failed: the transaction was reverted on-chain.`)
    this.name = 'TransactionRevertedError'
    this.hash = hash
    this.action = action
  }
}
