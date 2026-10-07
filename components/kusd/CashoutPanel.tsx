'use client'

import { useEffect, useRef, useState } from 'react'
import { formatUnits, parseUnits } from 'viem'
import { useAccount } from 'wagmi'
import { WalletButton } from '@/components/WalletButton'
import type { CashoutRoute } from '@/config/contracts'
import type { KusdTrade } from '@/config/kusdTrade'
import { APP_CHAIN_ID } from '@/config/networks'
import { type CashoutSent, useBridgeDelivery, useCashout, usePolygonCollateral } from '@/hooks/useCashout'
import { usePsmState, usePsmWallet } from '@/hooks/usePsmTrade'
import { useRampWithdrawal, useRampWithdrawChannels } from '@/hooks/useRampWithdraw'
import { exactAmount, parseAmount, showAmount } from '@/lib/amounts'
import { type CashoutPlan, CashoutStrandedError, cashoutProblem, parseRecipient, planCashout } from '@/lib/cashout'
import { getExplorerTxUrl } from '@/lib/explorer'
import { bridgeToPolygonStep, cashoutSwapSteps, feeCeiling, type KusdStep } from '@/lib/kusdSteps'
import { PSM_HALTED, psmBuyCost, psmFeeLabel } from '@/lib/psm'
import {
  COUNTRY_KYC_EXTRAS,
  countryDisplayName,
  createRampWithdrawal,
  dedupeNetworksByName,
  fetchRampWithdrawQuote,
  isInternationalPhone,
  makeIdempotencyKey,
  normalizePhoneForCountry,
  RampApiError,
  type RampCorridor,
  type RampCustomer,
  type RampWithdrawal,
  type RampWithdrawQuote,
} from '@/lib/ramp'
import { describeError, UserError } from '@/lib/txError'
import { useToast } from '@/providers/ToastProvider'
import { ArrowDivider, Field, inputClass, outlineButtonClass, primaryButtonClass, Row, Spinner } from './ui'

const STEP_LABEL: Record<KusdStep['action'], string> = {
  approve: 'Approve KUSD',
  swap: 'Swap KUSD for USDT',
  bridge: 'Send USDT to Yellow Card',
}

const DELIVERY_TEXT = {
  untracked: 'On its way to Yellow Card — usually 8–10 minutes. Use the links below to follow it.',
  pending: 'On its way to Yellow Card — usually 8–10 minutes. You can close this page; the payout continues.',
  delivered: 'Arrived at Yellow Card — paying your mobile money now.',
  slow: 'Still on its way. You can close this page; the payout continues.',
} as const

/** The bridge must start within this long of opening the payout. */
const PAYOUT_SEND_WINDOW_MS = 30 * 60_000

/** The keeper's answer is not an open payout for the amount asked at a real address: nothing may be sent on it. */
class UnexpectedPayoutError extends Error {}

/** The keeper is still opening the payout (a retry after a timeout): ask again with the same key. */
class PayoutPendingError extends Error {}

/** A ramp failure in cash-out words. */
function cashoutErrorText(error: unknown): string {
  if (error instanceof UnexpectedPayoutError) return 'The cash-out service sent back an unexpected answer. Nothing was sent — please try again.'
  if (error instanceof PayoutPendingError) return 'The cash-out is still being set up. Try again in a few seconds.'
  if (error instanceof RampApiError) {
    if (!error.outcomeUnknown && error.code === 'paused') return 'Cash-outs are temporarily paused. Please try again later.'
    if (!error.outcomeUnknown && error.code === 'not_found') return 'Cash-out not found.'
    return error.message
  }
  return 'Could not reach the payment service. Check your connection and try again.'
}

/** Where the money goes, in the form Yellow Card takes it (E.164 numbers). */
interface Destination {
  corridor: RampCorridor
  payoutNumber: string
  contactPhone: string
}

interface OpenPayout {
  withdrawal: RampWithdrawal
  recipient: `0x${string}`
  /** performance.now() when the keeper answered: the bridge must start within PAYOUT_SEND_WINDOW_MS. */
  openedAt: number
}

/**
 * Cash out KUSD to mobile money, the KalySwap flow. The fiat-ramp keeper opens the payout and returns
 * the Polygon address to send to (its treasury). The wallet then runs the cash-out: buyGem swaps KUSD →
 * USDT 1:1 into the wallet, and the USDT warp route carries that USDT to the address (~8–10 min). Once
 * it lands, the keeper has Yellow Card pay the mobile money number; if Yellow Card cannot, the keeper
 * sends the USDT back to the seller's own address on Polygon.
 *
 * The Polygon side can only release the USDT it holds, so a larger cash-out is blocked before anything
 * is sent. One flow runs at a time. If the USDT is stranded in the wallet (swap mined, bridge not
 * sent), resuming opens a fresh payout for it and bridges there.
 */
export default function CashoutPanel({ trade, route, onBusyChange }: { trade: KusdTrade; route: CashoutRoute; onBusyChange?: (busy: boolean) => void }) {
  const { showToast } = useToast()
  const GEM = trade.gem
  const KUSD = trade.kusd
  /** A cash-out goes in whole cents of USDT: how Yellow Card treats a sub-cent amount is unverified. */
  const CENT_USDT = 10n ** BigInt(GEM.decimals - 2)
  const CENT_KUSD = 10n ** BigInt(KUSD.decimals - 2)
  const { address } = useAccount()
  const [input, setInput] = useState('')
  const [corridorId, setCorridorId] = useState('')
  const [networkId, setNetworkId] = useState('')
  const [momoNumber, setMomoNumber] = useState('')
  const [accountName, setAccountName] = useState('')
  const [customer, setCustomer] = useState<RampCustomer>({ name: '', country: '' })
  const [quote, setQuote] = useState<RampWithdrawQuote | null>(null)
  const [formError, setFormError] = useState('')
  const [progress, setProgress] = useState<{ index: number; total: number; step: KusdStep } | null>(null)
  const [stranded, setStranded] = useState<{ gemAmt: bigint } | null>(null)
  const [pending, setPending] = useState(false)
  const inFlight = useRef(false)
  // One idempotency key per payout request: kept while the keeper's answer is unknown, dropped once it
  // answers, and never reused for a different request (the keeper replays by key alone).
  const idemKeyRef = useRef<{ key: string; fingerprint: string } | null>(null)
  const quoteSeqRef = useRef(0)
  const [sent, setSent] = useState<CashoutSent | null>(null)
  const [withdrawal, setWithdrawal] = useState<RampWithdrawal | null>(null)
  const { data: psm } = usePsmState(trade)
  const { data: wallet } = usePsmWallet(trade, address)
  const { data: collateral } = usePolygonCollateral(route)
  const channels = useRampWithdrawChannels()
  const { cashout, resumeBridge } = useCashout(trade, route)
  const delivery = useBridgeDelivery(route, sent?.messageId ?? null)
  const { data: liveWithdrawal } = useRampWithdrawal(withdrawal?.withdrawalId ?? null)

  // A payout needs an operator (Yellow Card's networkId), so corridors without one are not offered.
  const corridors = channels.data ? channels.data.corridors.filter((x) => x.networks.length > 0) : null
  const corridor = corridors?.find((x) => x.channelId === corridorId) ?? null
  const operators = corridor ? dedupeNetworksByName(corridor.networks) : []
  const minUsd = channels.data?.minUsd
  const maxUsd = channels.data?.maxUsd

  // The KYC country follows the corridor; operators belong to it (a lone one is preselected).
  useEffect(() => {
    if (corridor) setCustomer((x) => ({ ...x, country: corridor.country }))
    const ops = corridor ? dedupeNetworksByName(corridor.networks) : []
    setNetworkId(ops.length === 1 ? ops[0].id : '')
  }, [corridor])

  /** The plan rounded down to whole cents of USDT, or null when that leaves nothing. */
  const toCents = (plan: CashoutPlan, tout: bigint): CashoutPlan | null => {
    const gemAmt = plan.gemAmt - (plan.gemAmt % CENT_USDT)
    return gemAmt === 0n ? null : { gemAmt, cost: psmBuyCost(gemAmt, GEM.decimals, tout) }
  }
  /** A USDT limit, rounded DOWN to cents: typing the number shown must always go through. */
  const usdtLimit = (value: bigint) => `${showAmount(value - (value % CENT_USDT), GEM.decimals, 2)} ${GEM.symbol}`
  const halted = psm?.tout === PSM_HALTED
  const kusdIn = parseAmount(input, KUSD.decimals)
  const exactPlan = psm && !halted ? planCashout(kusdIn, psm.tout, GEM.decimals) : null
  const plan = psm && exactPlan ? toCents(exactPlan, psm.tout) : null
  const problem = cashoutProblem({ plan, halted, kusdBalance: wallet?.kusdBalance, pocketGem: psm?.pocketGem, collateral })
  const invalidAmount = input.trim() !== '' && !plan && !halted
  const rounded = Boolean(plan && kusdIn !== null && plan.cost < kusdIn)
  const available = psm && collateral !== undefined ? (psm.pocketGem < collateral ? psm.pocketGem : collateral) : undefined
  const busy = pending
  /** The most KUSD that can go out now: the wallet balance, capped by what the PSM and Polygon can pay. */
  const capKusd = psm && available !== undefined ? psmBuyCost(available, GEM.decimals, psm.tout) : undefined
  const maxKusd = wallet && capKusd !== undefined && capKusd < wallet.kusdBalance ? capKusd : wallet?.kusdBalance
  const feeLabel = !psm || halted ? '—' : psmFeeLabel(psm.tout)
  /** KMT the cash-out's transactions can cost; a new in-app wallet holds none. */
  const kmtNeeded =
    plan && wallet && address
      ? feeCeiling([...cashoutSwapSteps(trade, address, plan, wallet.kusdAllowance), bridgeToPolygonStep(GEM.address, route, address, plan.gemAmt, 0n)])
      : undefined

  let message: string | null = null
  if (problem?.key === 'halted') message = 'Cash-outs are paused.'
  else if (invalidAmount) message = 'Enter a valid amount'
  else if (problem?.key === 'insufficient') message = 'Insufficient KUSD balance'
  else if (problem?.key === 'pocket') message = `The PSM can pay out only ${usdtLimit(problem.limit)} right now.`
  else if (problem?.key === 'collateral') message = `Only ${usdtLimit(problem.limit)} can be cashed out right now. Try a smaller amount, or try again later.`
  else if (plan && minUsd && plan.gemAmt < parseUnits(minUsd, GEM.decimals)) message = `The minimum cash-out is $${minUsd}.`
  else if (plan && maxUsd && plan.gemAmt > parseUnits(maxUsd, GEM.decimals)) message = `The maximum cash-out is $${maxUsd}.`
  else if (wallet && kmtNeeded !== undefined && wallet.kmtBalance < kmtNeeded)
    message = `Network fees need up to ${showAmount(kmtNeeded, 18)} KMT, and this wallet has ${showAmount(wallet.kmtBalance, 18)} KMT. Add a little KMT to this wallet to cash out.`
  const shown = message ?? (formError || null)

  const ready = Boolean(plan && corridor && networkId && !message && wallet && collateral !== undefined)
  const strandedHeld = Boolean(stranded && wallet && wallet.gemBalance >= stranded.gemAmt)
  const canResume = Boolean(stranded && corridor && networkId && strandedHeld && !busy)
  const onStep = (index: number, total: number, step: KusdStep) => setProgress({ index, total, step })
  /**
   * Progress, plus the rule that the bridge only starts while the payout opened at `openedAt` is fresh:
   * wallet prompts can stay open for any length of time. useCashout strands the USDT in the wallet when
   * this throws before the bridge is sent, and the resume opens a fresh payout for it.
   */
  const stepWithin = (openedAt: number) => (index: number, total: number, step: KusdStep) => {
    if (step.action === 'bridge' && performance.now() - openedAt > PAYOUT_SEND_WINDOW_MS) {
      throw new UserError('This cash-out waited too long for your wallet, so the USDT was not sent. It is in your wallet: send it to a fresh payout below.')
    }
    onStep(index, total, step)
  }
  const label = progress ? `${STEP_LABEL[progress.step.action]} (${progress.index + 1}/${progress.total})…` : null

  /** One flow at a time: the ref blocks a second click synchronously, before the first await. */
  const exclusive = async (work: () => Promise<void>) => {
    if (inFlight.current) return
    inFlight.current = true
    setPending(true)
    onBusyChange?.(true)
    try {
      await work()
    } finally {
      inFlight.current = false
      setPending(false)
      onBusyChange?.(false)
      setProgress(null)
    }
  }

  const failed = (error: unknown) =>
    showToast({ type: 'error', message: `Cash-out failed: ${describeError(error instanceof CashoutStrandedError ? error.cause : error)}` })

  /** The destination as Yellow Card takes it, or why it cannot go yet. Shows normalised numbers as sent. */
  const destination = (): Destination | string => {
    if (!corridor) return 'Select your country first'
    if (!networkId) return 'Select your mobile money operator'
    const payoutNumber = normalizePhoneForCountry(momoNumber, corridor.country)
    if (!isInternationalPhone(payoutNumber)) return 'Enter a valid mobile money number — your local number or international format (e.g. +2250701234567)'
    if (!accountName.trim()) return 'Enter the name on the mobile money account'
    if (!customer.name.trim()) return 'Enter your full name'
    const contactPhone = normalizePhoneForCountry(customer.phone ?? '', corridor.country)
    if (!isInternationalPhone(contactPhone)) return 'Enter a valid phone number — your local number or international format (e.g. +2250701234567)'
    if (payoutNumber !== momoNumber) setMomoNumber(payoutNumber)
    if (contactPhone !== customer.phone) setCustomer((x) => ({ ...x, phone: contactPhone }))
    return { corridor, payoutNumber, contactPhone }
  }

  /**
   * Opens the payout for exactly `gemAmt` USDT and returns where to send it. Otherwise it shows why and
   * returns null. Nothing is sent unless the answer is an open payout for that amount at a real address.
   */
  const openPayout = async (gemAmt: bigint, owner: `0x${string}`): Promise<OpenPayout | null> => {
    setFormError('')
    const dest = destination()
    if (typeof dest === 'string') {
      setFormError(dest)
      return null
    }
    const request = {
      userWallet: owner,
      usdAmount: formatUnits(gemAmt, GEM.decimals),
      channelId: dest.corridor.channelId,
      country: dest.corridor.country,
      currency: dest.corridor.currency,
      networkId,
      momoNumber: dest.payoutNumber,
      accountName: accountName.trim(),
      sender: { ...customer, country: dest.corridor.country, phone: dest.contactPhone },
    }
    // A pending key is reused only for the very same request: a corrected number or amount after a
    // timeout gets a new key, or the keeper would answer with the payout for the old one.
    const fingerprint = JSON.stringify(request)
    if (idemKeyRef.current?.fingerprint !== fingerprint) idemKeyRef.current = { key: makeIdempotencyKey(owner), fingerprint }
    try {
      const w = await createRampWithdrawal({ idempotencyKey: idemKeyRef.current.key, ...request })
      if (w.state === 'created') throw new PayoutPendingError()
      idemKeyRef.current = null // answered: the next payout gets a fresh key
      const recipient = w.depositAddress ? parseRecipient(w.depositAddress) : null
      const sameAmount = /^\d+(\.\d{1,6})?$/.test(w.usdAmount) && parseUnits(w.usdAmount, GEM.decimals) === gemAmt
      if (w.state !== 'awaiting_funds' || !recipient || !sameAmount || w.currency !== dest.corridor.currency) throw new UnexpectedPayoutError()
      return { withdrawal: w, recipient, openedAt: performance.now() }
    } catch (error) {
      // A definitive rejection ends this attempt; an unknown outcome keeps the key for the retry.
      if (error instanceof RampApiError && !error.outcomeUnknown) idemKeyRef.current = null
      setFormError(cashoutErrorText(error))
      return null
    }
  }

  const run = () =>
    exclusive(async () => {
      if (!plan || !wallet || !address) return
      const open = await openPayout(plan.gemAmt, address)
      if (!open) return
      try {
        const result = await cashout({ plan, recipient: open.recipient, kusdAllowance: wallet.kusdAllowance }, stepWithin(open.openedAt))
        setWithdrawal(open.withdrawal)
        setSent(result)
        setInput('')
      } catch (error) {
        // Added to any earlier stranded USDT: one resume sends all of it.
        if (error instanceof CashoutStrandedError) setStranded((prev) => ({ gemAmt: (prev?.gemAmt ?? 0n) + error.gemAmt }))
        failed(error)
      }
    })

  const resume = () =>
    exclusive(async () => {
      if (!stranded || !address) return
      // A fresh payout for the stranded USDT: the earlier one was never funded and simply expires.
      const open = await openPayout(stranded.gemAmt, address)
      if (!open) return
      try {
        const result = await resumeBridge({ gemAmt: stranded.gemAmt, recipient: open.recipient }, stepWithin(open.openedAt))
        setStranded(null)
        setWithdrawal(open.withdrawal)
        setSent(result)
        setInput('')
      } catch (error) {
        failed(error)
      }
    })

  /** The local-currency estimate for the planned USDT; an estimate only, so a failed quote just shows none. */
  const quoteFor = async (cor: RampCorridor | null) => {
    setQuote(null)
    if (!cor || !plan) return
    const seq = ++quoteSeqRef.current
    try {
      const q = await fetchRampWithdrawQuote(cor.country, cor.currency, formatUnits(plan.gemAmt, GEM.decimals))
      if (seq === quoteSeqRef.current) setQuote(q)
    } catch {
      // the create call reports real errors
    }
  }

  const startOver = () => {
    setSent(null)
    setWithdrawal(null)
    setInput('')
    setQuote(null)
    setFormError('')
    setCorridorId('')
    setNetworkId('')
    setMomoNumber('')
    setAccountName('')
    setCustomer({ name: '', country: '' })
  }

  const setCust = (patch: Partial<RampCustomer>) => setCustomer((x) => ({ ...x, ...patch }))
  const kycExtra = corridor ? COUNTRY_KYC_EXTRAS[corridor.country] : undefined

  if (sent) {
    const payout = liveWithdrawal ?? withdrawal
    const state = String(payout?.state ?? 'awaiting_funds')
    const paid = state === 'paid'
    const lost = state === 'failed' || state === 'expired'
    const headline = paid
      ? payout?.localAmount && payout.currency
        ? `Paid to your mobile money: ${Number(payout.localAmount).toLocaleString('en-US')} ${payout.currency} sent to ${momoNumber}`
        : `Paid to your mobile money (${momoNumber})`
      : state === 'failed'
        ? 'Yellow Card could not pay this number. It returns your USDT to your wallet address on Polygon.'
        : state === 'expired'
          ? 'This cash-out expired before the USDT reached Yellow Card. If you sent it, contact support.'
          : `Sent ${showAmount(sent.gemAmt, GEM.decimals, 6)} USDT to Yellow Card`
    return (
      <div className="space-y-4">
        <div className="flex items-start gap-3 rounded-xl border border-[#262626] bg-[#0a0a0a]/50 p-4">
          {paid ? (
            <span aria-hidden className="text-green-400">
              ✓
            </span>
          ) : lost ? (
            <span aria-hidden className="text-red-400">
              ✕
            </span>
          ) : (
            <Spinner />
          )}
          <div className="text-sm">
            <p className="font-semibold text-white">{headline}</p>
            {!paid && !lost && <p className="mt-1 text-[#9ca3af]">{DELIVERY_TEXT[delivery]}</p>}
          </div>
        </div>
        <div className="flex flex-col gap-2 text-sm">
          <a href={getExplorerTxUrl(APP_CHAIN_ID, sent.hash)} target="_blank" rel="noreferrer" className="text-[#F59E0B] hover:text-[#FBBF24]">
            View the transfer on KalyScan ↗
          </a>
          <a href={`https://polygonscan.com/address/${sent.recipient}`} target="_blank" rel="noreferrer" className="text-[#F59E0B] hover:text-[#FBBF24]">
            View the payment to Yellow Card on PolygonScan ↗
          </a>
        </div>
        <button type="button" className={outlineButtonClass} onClick={startOver}>
          New cash-out
        </button>
      </div>
    )
  }

  return (
    <div>
      <p className="mb-5 text-sm text-[#9ca3af]">
        Cash out KUSD to mobile money. Your KUSD is swapped 1:1 for USDT and sent over the KalySwap bridge to Yellow Card, which pays your number in local
        currency — usually within 15 minutes.
      </p>

      {stranded && (
        <div className="mb-5 rounded-xl border border-[#F59E0B]/50 bg-[#F59E0B]/10 p-4 text-sm">
          <p className="font-semibold text-white">Your USDT is in your wallet on KalyChain</p>
          <p className="mt-1 text-[#9ca3af]">The swap went through, but the transfer to Yellow Card did not. Send it now to the same mobile money number:</p>
          {!strandedHeld && (
            <p className="mt-1 text-xs text-red-400">Your wallet no longer holds {showAmount(stranded.gemAmt, GEM.decimals, 6)} USDT on KalyChain.</p>
          )}
          <button type="button" className={`${primaryButtonClass} mt-3`} disabled={!canResume} onClick={resume}>
            {busy && <Spinner />}
            {`Send ${showAmount(stranded.gemAmt, GEM.decimals, 6)} USDT to Yellow Card`}
          </button>
        </div>
      )}

      <div className="rounded-xl border border-[#262626] bg-[#0a0a0a]/50 p-4">
        <div className="mb-2 flex items-center justify-between text-xs text-[#6b7280]">
          <label htmlFor="cashout-amount" className="font-semibold uppercase tracking-wider">
            You cash out
          </label>
          {wallet && (
            <span className="flex items-center gap-2">
              Balance: {showAmount(wallet.kusdBalance, KUSD.decimals)} {KUSD.symbol}
              <button
                type="button"
                className="font-semibold text-[#F59E0B] hover:underline"
                onClick={() => {
                  const max = maxKusd ?? wallet.kusdBalance
                  setInput(exactAmount(max - (max % CENT_KUSD), KUSD.decimals))
                }}
              >
                Max
              </button>
            </span>
          )}
        </div>
        <div className="flex items-center gap-3">
          <input
            id="cashout-amount"
            inputMode="decimal"
            placeholder="0.0"
            value={input}
            aria-invalid={invalidAmount}
            disabled={busy}
            onChange={(e) => {
              setInput(e.target.value)
              setQuote(null)
              quoteSeqRef.current++ // a quote still in flight is for the old amount
            }}
            onBlur={() => void quoteFor(corridor)}
            className="min-w-0 flex-1 bg-transparent text-2xl font-semibold text-white placeholder:text-[#6b7280] focus:outline-none"
          />
          <span className="text-lg font-semibold text-white">{KUSD.symbol}</span>
        </div>
      </div>

      <ArrowDivider />

      <div className="rounded-xl border border-[#262626] bg-[#0a0a0a]/50 p-4">
        <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-[#6b7280]">Sent to Yellow Card</div>
        <div className="flex items-center gap-3">
          <span className="min-w-0 flex-1 truncate text-2xl font-semibold tabular-nums text-white">
            {plan ? showAmount(plan.gemAmt, GEM.decimals, 6) : '0.0'}
          </span>
          <span className="text-lg font-semibold text-white">{GEM.symbol}</span>
        </div>
      </div>

      <div className="mt-5 space-y-4">
        <Field id="cashout-country" label="Country">
          <select
            id="cashout-country"
            className={inputClass}
            value={corridorId}
            disabled={!corridors || busy}
            onChange={(e) => {
              setCorridorId(e.target.value)
              void quoteFor(corridors?.find((x) => x.channelId === e.target.value) ?? null)
            }}
          >
            <option value="" disabled>
              {corridors ? 'Select your country' : 'Loading countries…'}
            </option>
            {corridors?.map((x) => (
              <option key={x.channelId} value={x.channelId}>
                {countryDisplayName(x.country)} — {x.currency} (mobile money)
              </option>
            ))}
          </select>
          {channels.error && <p className="mt-2 text-xs text-red-400">Could not load countries: {cashoutErrorText(channels.error)}</p>}
        </Field>
        {corridor && (
          <>
            <Field id="cashout-operator" label="Operator">
              <select id="cashout-operator" className={inputClass} value={networkId} disabled={busy} onChange={(e) => setNetworkId(e.target.value)}>
                <option value="" disabled>
                  Select your mobile money operator
                </option>
                {operators.map((n) => (
                  <option key={n.id} value={n.id}>
                    {n.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field id="cashout-momo-number" label="Mobile money number that receives the money">
              <input
                id="cashout-momo-number"
                inputMode="tel"
                value={momoNumber}
                disabled={busy}
                onChange={(e) => setMomoNumber(e.target.value)}
                placeholder="+225 07 01 23 45 67"
                className={inputClass}
              />
            </Field>
            <Field id="cashout-account-name" label="Name on the mobile money account">
              <input id="cashout-account-name" value={accountName} disabled={busy} onChange={(e) => setAccountName(e.target.value)} className={inputClass} />
            </Field>
          </>
        )}
      </div>

      <dl className="mt-4 space-y-2 text-sm">
        {quote && corridor && quote.currency === corridor.currency && (
          <>
            <Row label="You receive" value={`≈ ${quote.receiveLocal.toLocaleString('en-US')} ${quote.currency}`} />
            <Row label="Yellow Card fee" value={`${quote.feeLocal.toLocaleString('en-US')} ${quote.currency} (included)`} />
          </>
        )}
        <Row label="Rate" value="1 KUSD = 1 USDT" />
        <Row label="Fee" value={feeLabel} />
        <Row label="Arrival" value="~10–15 min" />
        <Row label="Available to cash out" value={available !== undefined ? usdtLimit(available) : '—'} />
      </dl>

      <div className="mt-5 space-y-3 border-t border-[#262626] pt-5">
        <div>
          <h3 className="font-semibold text-white">Your details</h3>
          <p className="text-xs text-[#6b7280]">Required by Yellow Card for regulatory compliance — used only for this payment.</p>
        </div>
        <input
          aria-label="Full name"
          placeholder="Full name"
          value={customer.name}
          disabled={busy}
          onChange={(e) => setCust({ name: e.target.value })}
          className={inputClass}
        />
        <input
          aria-label="Email"
          placeholder="Email"
          value={customer.email ?? ''}
          disabled={busy}
          onChange={(e) => setCust({ email: e.target.value })}
          className={inputClass}
        />
        <input
          aria-label="Phone"
          placeholder="Phone — local or international (+2250701234567)"
          value={customer.phone ?? ''}
          disabled={busy}
          onChange={(e) => setCust({ phone: e.target.value })}
          className={inputClass}
        />
        <input
          aria-label="Address"
          placeholder="Address"
          value={customer.address ?? ''}
          disabled={busy}
          onChange={(e) => setCust({ address: e.target.value })}
          className={inputClass}
        />
        <input
          aria-label="Date of birth"
          placeholder="Date of birth (mm/dd/yyyy)"
          value={customer.dob ?? ''}
          disabled={busy}
          onChange={(e) => setCust({ dob: e.target.value })}
          className={inputClass}
        />
        <div className="grid gap-3 sm:grid-cols-2">
          <input
            aria-label="ID type"
            placeholder="ID type (e.g. license)"
            value={customer.idType ?? ''}
            disabled={busy}
            onChange={(e) => setCust({ idType: e.target.value })}
            className={inputClass}
          />
          <input
            aria-label="ID number"
            placeholder="ID number"
            value={customer.idNumber ?? ''}
            disabled={busy}
            onChange={(e) => setCust({ idNumber: e.target.value })}
            className={inputClass}
          />
        </div>
        {kycExtra && (
          <div className="grid gap-3 sm:grid-cols-2">
            <input
              aria-label={kycExtra.label}
              placeholder={kycExtra.label}
              value={customer.additionalIdType ?? ''}
              disabled={busy}
              onChange={(e) => setCust({ additionalIdType: e.target.value })}
              className={inputClass}
            />
            <input
              aria-label={`${kycExtra.label} number`}
              placeholder={`${kycExtra.label} number`}
              value={customer.additionalIdNumber ?? ''}
              disabled={busy}
              onChange={(e) => setCust({ additionalIdNumber: e.target.value })}
              className={inputClass}
            />
          </div>
        )}
      </div>

      {(shown || rounded) && (
        <p role={shown ? 'alert' : undefined} className={shown ? 'mt-3 text-sm text-red-400' : 'mt-3 text-sm text-[#6b7280]'}>
          {shown ?? `Cash-outs go in whole cents, so ${plan ? showAmount(plan.cost, KUSD.decimals, 6) : ''} KUSD will be used.`}
        </p>
      )}

      <div className="mt-5">
        {!address ? (
          <WalletButton />
        ) : (
          <button type="button" className={primaryButtonClass} disabled={!ready || busy} onClick={run}>
            {busy && <Spinner />}
            {busy && label ? label : plan ? 'Cash out' : 'Enter an amount'}
          </button>
        )}
      </div>
    </div>
  )
}
