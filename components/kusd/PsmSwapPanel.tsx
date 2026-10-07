'use client'

import { type ReactNode, useState } from 'react'
import { useAccount } from 'wagmi'
import { WalletButton } from '@/components/WalletButton'
import type { KusdTrade } from '@/config/kusdTrade'
import { APP_CHAIN_ID } from '@/config/networks'
import { psmPayToken, useApprovePsm, usePsmState, usePsmSwap, usePsmWallet } from '@/hooks/usePsmTrade'
import { exactAmount, parseAmount, showAmount } from '@/lib/amounts'
import { getExplorerTxUrl } from '@/lib/explorer'
import { PSM_HALTED, type PsmDirection, psmFeeLabel, quotePsm } from '@/lib/psm'
import { describeError } from '@/lib/txError'
import { useToast } from '@/providers/ToastProvider'
import { ArrowDivider, primaryButtonClass, Row, Spinner } from './ui'

/**
 * Swap USDT ⇄ KUSD 1:1 through the Peg Stability Module (sellGem / buyGem), as on KalySwap. `direction`
 * comes from the Buy/Sell card: 'sell' sells USDT for KUSD (buying KUSD), 'buy' buys USDT back with
 * KUSD (selling it).
 */
export default function PsmSwapPanel({ trade, direction }: { trade: KusdTrade; direction: PsmDirection }) {
  const { showToast } = useToast()
  const { address } = useAccount()
  const [input, setInput] = useState('')
  const [pending, setPending] = useState<'approve' | 'swap' | null>(null)
  const { data: psm } = usePsmState(trade)
  const { data: wallet } = usePsmWallet(trade, address)
  const approve = useApprovePsm(trade)
  const swap = usePsmSwap(trade)

  const pay = psmPayToken(trade, direction)
  const receive = direction === 'sell' ? trade.kusd : trade.gem
  const fee = psm ? (direction === 'sell' ? psm.tin : psm.tout) : 0n
  const halted = fee === PSM_HALTED
  const quote = psm && !halted ? quotePsm(direction, input, psm.tin, psm.tout, trade.gem.decimals) : null
  const invalid = input.trim() !== '' && !quote && !halted

  const balance = wallet ? (direction === 'sell' ? wallet.gemBalance : wallet.kusdBalance) : undefined
  const allowance = wallet ? (direction === 'sell' ? wallet.gemAllowance : wallet.kusdAllowance) : undefined
  const capacity = psm ? (direction === 'sell' ? psm.kusdCash : psm.pocketGem) : undefined
  const insufficient = Boolean(quote && balance !== undefined && quote.pay > balance)
  const overCapacity = Boolean(quote && capacity !== undefined && quote.receive > capacity)
  const needsApproval = Boolean(quote && allowance !== undefined && allowance < quote.pay)
  const kusdTyped = direction === 'buy' ? parseAmount(input, trade.kusd.decimals) : null
  const rounded = Boolean(quote && kusdTyped !== null && quote.pay < kusdTyped)

  const run = async (step: 'approve' | 'swap') => {
    if (!quote) return
    setPending(step)
    try {
      if (step === 'approve') {
        await approve(direction, quote.pay)
      } else {
        const hash = await swap({ direction, gemAmt: quote.gemAmt })
        showToast({
          type: 'success',
          message: `Swapped ${showAmount(quote.pay, pay.decimals, 6)} ${pay.symbol} for ${showAmount(quote.receive, receive.decimals, 6)} ${receive.symbol}`,
          href: getExplorerTxUrl(APP_CHAIN_ID, hash),
        })
        setInput('')
      }
    } catch (error) {
      showToast({ type: 'error', message: `${step === 'approve' ? 'Approval failed' : 'Swap failed'}: ${describeError(error)}` })
    } finally {
      setPending(null)
    }
  }

  let problem: string | null = null
  if (halted) problem = 'Swaps in this direction are paused.'
  else if (invalid) problem = 'Enter a valid amount'
  else if (insufficient) problem = `Insufficient ${pay.symbol} balance`
  else if (overCapacity && capacity !== undefined)
    problem = `The PSM has only ${showAmount(capacity, receive.decimals, 2)} ${receive.symbol} available for this swap right now.`

  let action: ReactNode
  if (!address) {
    action = <WalletButton />
  } else if (!quote || problem) {
    action = (
      <button type="button" className={primaryButtonClass} disabled>
        {problem ? 'Swap' : 'Enter an amount'}
      </button>
    )
  } else if (needsApproval) {
    action = (
      <button type="button" className={primaryButtonClass} disabled={pending !== null} onClick={() => run('approve')}>
        {pending === 'approve' && <Spinner />}
        {pending === 'approve' ? 'Approving…' : `Approve ${showAmount(quote.pay, pay.decimals, 6)} ${pay.symbol}`}
      </button>
    )
  } else {
    action = (
      <button type="button" className={primaryButtonClass} disabled={pending !== null || allowance === undefined} onClick={() => run('swap')}>
        {pending === 'swap' && <Spinner />}
        {pending === 'swap' ? 'Swapping…' : 'Swap'}
      </button>
    )
  }

  return (
    <div>
      <p className="mb-5 text-sm text-[#9ca3af]">The Peg Stability Module swaps at exactly $1 per KUSD — no slippage and no price impact.</p>

      <div className="rounded-xl border border-[#262626] bg-[#0a0a0a]/50 p-4">
        <div className="mb-2 flex items-center justify-between text-xs text-[#6b7280]">
          <label htmlFor="psm-amount" className="font-semibold uppercase tracking-wider">
            You pay
          </label>
          {balance !== undefined && (
            <span className="flex items-center gap-2">
              Balance: {showAmount(balance, pay.decimals)} {pay.symbol}
              <button type="button" className="font-semibold text-[#F59E0B] hover:underline" onClick={() => setInput(exactAmount(balance, pay.decimals))}>
                Max
              </button>
            </span>
          )}
        </div>
        <div className="flex items-center gap-3">
          <input
            id="psm-amount"
            inputMode="decimal"
            placeholder="0.0"
            value={input}
            aria-invalid={invalid}
            onChange={(e) => setInput(e.target.value)}
            className="min-w-0 flex-1 bg-transparent text-2xl font-semibold text-white placeholder:text-[#6b7280] focus:outline-none"
          />
          <span className="text-lg font-semibold text-white">{pay.symbol}</span>
        </div>
      </div>

      <ArrowDivider />

      <div className="rounded-xl border border-[#262626] bg-[#0a0a0a]/50 p-4">
        <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-[#6b7280]">You receive</div>
        <div className="flex items-center gap-3">
          <span className="min-w-0 flex-1 truncate text-2xl font-semibold tabular-nums text-white">
            {quote ? showAmount(quote.receive, receive.decimals, 6) : '0.0'}
          </span>
          <span className="text-lg font-semibold text-white">{receive.symbol}</span>
        </div>
      </div>

      <dl className="mt-4 space-y-2 text-sm">
        <Row label="Rate" value={`1 ${pay.symbol} = 1 ${receive.symbol}`} />
        <Row label="Fee" value={halted ? 'No fee' : psmFeeLabel(fee)} />
        <Row label="Available in the PSM" value={capacity !== undefined ? `${showAmount(capacity, receive.decimals, 2)} ${receive.symbol}` : '—'} />
      </dl>

      {(problem || rounded) && (
        <p role={problem ? 'alert' : undefined} className={problem ? 'mt-3 text-sm text-red-400' : 'mt-3 text-sm text-[#6b7280]'}>
          {problem ?? `USDT has 6 decimals, so ${quote ? showAmount(quote.pay, trade.kusd.decimals, 6) : ''} KUSD will be used.`}
        </p>
      )}

      <div className="mt-5">{action}</div>
    </div>
  )
}
