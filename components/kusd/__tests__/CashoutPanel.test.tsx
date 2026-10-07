/**
 * @vitest-environment happy-dom
 *
 * Cash-out to mobile money (ported from KalySwap). Money-safety rules: nothing is sent while the
 * Polygon side of the route holds less USDT than the cash-out (or is unknown); the bridge goes only to
 * the address of the payout the keeper just opened, and only when that payout is open and for exactly
 * the planned USDT; a retry after an unknown keeper outcome reuses the idempotency key; a double click
 * never starts two cash-outs; USDT stranded in the wallet (swap mined, bridge not sent) is resumed into
 * a fresh payout, and only while the wallet still holds it.
 */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { kusdTrade } from '@/config/kusdTrade'
import { CashoutStrandedError } from '@/lib/cashout'

const WALLET = '0x1111111111111111111111111111111111111111'
const TREASURY = '0x52908400098527886E0F7030069857D2E4169EE7'
const TREASURY2 = '0x2222222222222222222222222222222222222222'
const USDT = 10n ** 6n
const WAD = 10n ** 18n
const trade = kusdTrade(3890)!
let collateral: bigint | undefined
let gemBalance = 0n
let tout = 0n
let kmtBalance = WAD
const cashout = vi.fn()
const resumeBridge = vi.fn()
const showToast = vi.fn()

vi.mock('wagmi', () => ({ useAccount: () => ({ address: WALLET }) }))
vi.mock('@/components/WalletButton', () => ({ WalletButton: () => null }))
vi.mock('@/providers/ToastProvider', () => ({ useToast: () => ({ showToast }) }))
vi.mock('@/hooks/usePsmTrade', () => ({
  usePsmState: () => ({ data: { tin: 0n, tout, kusdCash: 10_000n * WAD, pocketGem: 1_419n * USDT } }),
  usePsmWallet: () => ({ data: { gemBalance, gemAllowance: 0n, kusdBalance: 500n * WAD, kusdAllowance: 0n, kmtBalance } }),
}))
vi.mock('@/hooks/useCashout', () => ({
  usePolygonCollateral: () => ({ data: collateral }),
  useCashout: () => ({ cashout, resumeBridge }),
  useBridgeDelivery: () => 'pending',
}))

import CashoutPanel from '../CashoutPanel'

const CI = {
  channelId: 'ci-wd',
  country: 'CI',
  currency: 'XOF',
  channelType: 'momo',
  min: 500,
  max: 1_500_000,
  estimatedSettlementTime: 5,
  networks: [
    { id: 'net-mtn', name: 'MTN', accountNumberType: 'phone' },
    { id: 'net-orange', name: 'Orange', accountNumberType: 'phone' },
  ],
}
const SN_NO_OPERATOR = { ...CI, channelId: 'sn-wd', country: 'SN', networks: [] }

type CreateHandler = (body: Record<string, unknown>, n: number) => Response
let onCreate: CreateHandler
let onStatus: () => Response
const creates: Array<Record<string, unknown>> = []
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status })
/** The keeper's answer for the n-th create: an open payout for the amount asked, at TREASURY / TREASURY2 (lower-cased). */
const payout = (body: Record<string, unknown>, n: number, over: Record<string, unknown> = {}) => ({
  withdrawalId: `wd-0000000${n}`,
  state: 'awaiting_funds',
  depositAddress: [TREASURY, TREASURY2][n % 2].toLowerCase(),
  usdAmount: body.usdAmount,
  localAmount: null,
  currency: 'XOF',
  expiresAt: null,
  ...over,
})
const sentTo = (recipient: string, gemAmt = 50n * USDT) => ({ gemAmt, recipient, hash: `0x${'cd'.repeat(32)}`, messageId: null })
const rejected = () => new Error('User rejected the request.')
const UNREACHABLE = 'Could not reach the payment service. Please try again — retrying will not create a second payment.'

beforeEach(() => {
  collateral = 194n * USDT
  gemBalance = 0n
  tout = 0n
  kmtBalance = WAD
  cashout.mockReset()
  resumeBridge.mockReset()
  showToast.mockReset()
  creates.length = 0
  onCreate = (body, n) => json(payout(body, n), 201)
  onStatus = () => json({ withdrawalId: 'wd-00000000', state: 'awaiting_funds' })
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
      const url = String(input)
      if (url === '/api/ramp/withdraw-channels') return json({ corridors: [CI, SN_NO_OPERATOR], minUsd: '5', maxUsd: '20000' })
      if (url.startsWith('/api/ramp/withdraw-quote')) return json({ usd: '50', rate: 480, feeLocal: 240, receiveLocal: 23760, currency: 'XOF' })
      if (url === '/api/ramp/withdrawals') {
        const body = JSON.parse(String(init?.body)) as Record<string, unknown>
        creates.push(body)
        return onCreate(body, creates.length - 1)
      }
      if (url.startsWith('/api/ramp/withdrawals/')) return onStatus()
      throw new Error(`unexpected fetch ${url}`)
    }),
  )
})
afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

function renderPanel(onBusyChange?: (busy: boolean) => void) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(
    <QueryClientProvider client={client}>
      <CashoutPanel trade={trade} route={trade.cashout!} onBusyChange={onBusyChange} />
    </QueryClientProvider>,
  )
}

const button = () => screen.getByRole('button', { name: /^(Cash out|Enter an amount)$/ }) as HTMLButtonElement
const typeAmount = (amount: string) => fireEvent.change(screen.getByLabelText('You cash out'), { target: { value: amount } })
const toastMessages = () => showToast.mock.calls.map(([t]) => (t as { message: string }).message)
async function fill(amount: string) {
  typeAmount(amount)
  await screen.findByText(/XOF \(mobile money\)/)
  fireEvent.change(screen.getByLabelText('Country'), { target: { value: 'ci-wd' } })
  fireEvent.change(await screen.findByLabelText('Operator'), { target: { value: 'net-mtn' } })
  fireEvent.change(screen.getByLabelText('Mobile money number that receives the money'), { target: { value: '07 01 23 45 67' } })
  fireEvent.change(screen.getByLabelText('Name on the mobile money account'), { target: { value: 'Awa Koné' } })
  fireEvent.change(screen.getByLabelText('Full name'), { target: { value: 'Awa Koné' } })
  fireEvent.change(screen.getByLabelText('Phone'), { target: { value: '0701234567' } })
}
const resumeButton = (amount: number) => screen.findByRole('button', { name: new RegExp(`Send ${amount} USDT to Yellow Card`) }) as Promise<HTMLButtonElement>

describe('CashoutPanel', () => {
  it('offers only payout corridors that have an operator', async () => {
    renderPanel()
    await screen.findByText(/XOF \(mobile money\)/)
    expect(screen.getAllByText(/\(mobile money\)/)).toHaveLength(1)
    expect(screen.queryByText(/Senegal/)).toBeNull()
  })

  it('blocks a cash-out above the USDT on the Polygon side, and names the limit', () => {
    renderPanel()
    typeAmount('200')
    expect(screen.getByRole('alert').textContent).toContain('194')
    expect(button().disabled).toBe(true)
  })

  it("refuses an amount under the keeper's minimum", async () => {
    renderPanel()
    typeAmount('2')
    expect(await screen.findByText('The minimum cash-out is $5.')).toBeTruthy()
    expect(button().disabled).toBe(true)
  })

  it('cashes out whole cents only, and says how much KUSD that uses', async () => {
    cashout.mockResolvedValue(sentTo(TREASURY, 10_120_000n))
    renderPanel()
    await fill('10.129')
    expect(screen.getByText('Cash-outs go in whole cents, so 10.12 KUSD will be used.')).toBeTruthy()
    fireEvent.click(button())
    await waitFor(() => expect(cashout).toHaveBeenCalledTimes(1))
    expect(creates[0].usdAmount).toBe('10.12')
    expect(cashout.mock.calls[0][0]).toMatchObject({ plan: { gemAmt: 10_120_000n, cost: 10_120_000_000_000_000_000n } })
  })

  it('names the Polygon limit rounded down, so typing the number shown goes through', async () => {
    collateral = 386_099_040n // 386.09904 USDT (wallet holds 500 KUSD)
    renderPanel()
    await fill('400')
    expect(screen.getByRole('alert').textContent).toContain('386.09 USDT')
    typeAmount('386.09')
    expect(screen.queryByRole('alert')).toBeNull()
    expect(button().disabled).toBe(false)
  })

  it('Max fills the most that can go out now: the smaller of the KUSD balance and the Polygon limit', () => {
    renderPanel()
    fireEvent.click(screen.getByRole('button', { name: 'Max' }))
    expect((screen.getByLabelText('You cash out') as HTMLInputElement).value).toBe('194') // balance 500 KUSD, limit 194 USDT
  })

  it('shows the PSM fee, and none when it is zero', () => {
    renderPanel()
    expect(screen.getByText('No fee')).toBeTruthy()
    cleanup()
    tout = WAD / 100n // 1%
    renderPanel()
    expect(screen.getByText('1%')).toBeTruthy()
  })

  it('quotes what the mobile money number receives for the planned USDT', async () => {
    renderPanel()
    await fill('50')
    fireEvent.blur(screen.getByLabelText('You cash out'))
    expect(await screen.findByText('≈ 23,760 XOF')).toBeTruthy()
  })

  it('opens the payout (E.164 numbers, KYC, the planned USDT), then cashes out to the address the keeper gave', async () => {
    cashout.mockResolvedValue(sentTo(TREASURY))
    renderPanel()
    await fill('50')
    fireEvent.click(button())
    await waitFor(() => expect(cashout).toHaveBeenCalledTimes(1))
    expect(creates[0]).toMatchObject({
      userWallet: WALLET,
      usdAmount: '50',
      channelId: 'ci-wd',
      country: 'CI',
      currency: 'XOF',
      networkId: 'net-mtn',
      momoNumber: '+2250701234567',
      accountName: 'Awa Koné',
      sender: { name: 'Awa Koné', country: 'CI', phone: '+2250701234567' },
    })
    expect(cashout.mock.calls[0][0]).toEqual({ plan: { gemAmt: 50n * USDT, cost: 50n * WAD }, recipient: TREASURY, kusdAllowance: 0n })
    expect(await screen.findByText(/On its way to Yellow Card — usually 8–10 minutes\. You can close this page/)).toBeTruthy()
  })

  it.each([
    ['a different amount', { usdAmount: '49' }],
    ['no deposit address', { depositAddress: null }],
    ['a malformed address', { depositAddress: '0x1234' }],
    ['a payout that is not open', { state: 'failed_create' }],
    ['another currency', { currency: 'GHS' }],
  ])('never cashes out when the keeper answers with %s', async (_label, over) => {
    onCreate = (body, n) => json(payout(body, n, over), 201)
    renderPanel()
    await fill('50')
    fireEvent.click(button())
    expect(await screen.findByText('The cash-out service sent back an unexpected answer. Nothing was sent — please try again.')).toBeTruthy()
    expect(cashout).not.toHaveBeenCalled()
  })

  it('keeps the idempotency key when the keeper outcome is unknown, and starts fresh after a definitive refusal', async () => {
    cashout.mockResolvedValue(sentTo(TREASURY))
    onCreate = () => json({ error: 'keeper_unreachable' }, 504)
    renderPanel()
    await fill('50')
    fireEvent.click(button())
    await screen.findByText(UNREACHABLE)
    onCreate = () => json({ error: 'unknown_corridor' }, 400)
    fireEvent.click(button())
    await screen.findByText('This payout method is not available right now. Please pick another one.')
    onCreate = (body, n) => json(payout(body, n), 201)
    fireEvent.click(button())
    await waitFor(() => expect(cashout).toHaveBeenCalledTimes(1))
    expect(String(creates[0].idempotencyKey)).toMatch(/^ui-11111111-/)
    expect(creates[1].idempotencyKey).toBe(creates[0].idempotencyKey)
    expect(creates[2].idempotencyKey).not.toBe(creates[1].idempotencyKey)
  })

  it('says "paused" in cash-out words', async () => {
    onCreate = () => json({ error: 'paused' }, 503)
    renderPanel()
    await fill('50')
    fireEvent.click(button())
    expect(await screen.findByText('Cash-outs are temporarily paused. Please try again later.')).toBeTruthy()
    expect(cashout).not.toHaveBeenCalled()
  })

  it('never reuses a pending key for a changed destination (a corrected number after a timeout)', async () => {
    cashout.mockResolvedValue(sentTo(TREASURY))
    onCreate = () => json({ error: 'keeper_unreachable' }, 504)
    renderPanel()
    await fill('50')
    fireEvent.click(button())
    await screen.findByText(UNREACHABLE)
    fireEvent.change(screen.getByLabelText('Mobile money number that receives the money'), { target: { value: '07 09 99 99 99' } })
    onCreate = (body, n) => json(payout(body, n), 201)
    fireEvent.click(button())
    await waitFor(() => expect(cashout).toHaveBeenCalledTimes(1))
    expect(creates[1].momoNumber).toBe('+2250709999999')
    expect(creates[1].idempotencyKey).not.toBe(creates[0].idempotencyKey)
  })

  it('keeps the key, and sends nothing, while the keeper is still opening the payout', async () => {
    cashout.mockResolvedValue(sentTo(TREASURY))
    onCreate = () => json({ error: 'keeper_unreachable' }, 504)
    renderPanel()
    await fill('50')
    fireEvent.click(button())
    await screen.findByText(UNREACHABLE)
    onCreate = (body, n) => json(payout(body, n, { state: 'created', depositAddress: null }), 200)
    fireEvent.click(button())
    await screen.findByText('The cash-out is still being set up. Try again in a few seconds.')
    expect(cashout).not.toHaveBeenCalled()
    onCreate = (body, n) => json(payout(body, n), 200)
    fireEvent.click(button())
    await waitFor(() => expect(cashout).toHaveBeenCalledTimes(1))
    expect(new Set(creates.map((c) => c.idempotencyKey)).size).toBe(1)
  })

  it('does not bridge to a payout that waited too long in the wallet; the USDT is resumed into a fresh one', async () => {
    gemBalance = 50n * USDT
    cashout.mockImplementationOnce(async (_args: unknown, onStep: (index: number, total: number, step: { action: string }) => void) => {
      // The wallet prompts stayed open 31 minutes; useCashout calls the bridge-step callback before
      // sending and strands the USDT when it throws (pinned in hooks/__tests__/useCashout.test.tsx).
      const later = performance.now() + 31 * 60_000
      const clock = vi.spyOn(performance, 'now').mockReturnValue(later)
      try {
        onStep(2, 3, { action: 'bridge' })
      } catch (error) {
        throw new CashoutStrandedError(50n * USDT, TREASURY, error)
      } finally {
        clock.mockRestore()
      }
      return sentTo(TREASURY)
    })
    resumeBridge.mockResolvedValue(sentTo(TREASURY2))
    renderPanel()
    await fill('50')
    fireEvent.click(button())
    await waitFor(() => expect(toastMessages()).toEqual([expect.stringMatching(/^Cash-out failed: This cash-out waited too long for your wallet/)]))
    fireEvent.click(await resumeButton(50))
    await waitFor(() => expect(resumeBridge).toHaveBeenCalledWith({ gemAmt: 50n * USDT, recipient: TREASURY2 }, expect.any(Function)))
  })

  it('starts one cash-out for a double click', async () => {
    cashout.mockReturnValue(new Promise(() => undefined)) // still in flight
    renderPanel()
    await fill('50')
    const btn = button()
    // Both clicks land before React re-renders (and disables the button): only the in-flight guard stops the second.
    act(() => {
      btn.click()
      btn.click()
    })
    await waitFor(() => expect(cashout).toHaveBeenCalledTimes(1))
    expect(creates).toHaveLength(1)
  })

  it("resumes stranded USDT into a fresh payout, and bridges it to that payout's address", async () => {
    gemBalance = 50n * USDT
    cashout.mockRejectedValue(new CashoutStrandedError(50n * USDT, TREASURY, rejected()))
    resumeBridge.mockResolvedValue(sentTo(TREASURY2))
    renderPanel()
    await fill('50')
    fireEvent.click(button())
    fireEvent.click(await resumeButton(50))
    await waitFor(() => expect(resumeBridge).toHaveBeenCalledWith({ gemAmt: 50n * USDT, recipient: TREASURY2 }, expect.any(Function)))
    expect(creates).toHaveLength(2)
    expect(creates[1].usdAmount).toBe('50')
    expect(creates[1].idempotencyKey).not.toBe(creates[0].idempotencyKey)
    expect(toastMessages()[0]).toBe('Cash-out failed: Transaction rejected in your wallet.')
  })

  it('keeps resume disabled when the wallet no longer holds the stranded USDT', async () => {
    gemBalance = 10n * USDT
    cashout.mockRejectedValue(new CashoutStrandedError(50n * USDT, TREASURY, rejected()))
    renderPanel()
    await fill('50')
    fireEvent.click(button())
    expect((await resumeButton(50)).disabled).toBe(true)
    expect(screen.getByText('Your wallet no longer holds 50 USDT on KalyChain.')).toBeTruthy()
  })

  it('does not offer a resume for a failure that left nothing stranded', async () => {
    gemBalance = 50n * USDT
    cashout.mockRejectedValue(rejected())
    renderPanel()
    await fill('50')
    fireEvent.click(button())
    await waitFor(() => expect(showToast).toHaveBeenCalled())
    expect(screen.queryByRole('button', { name: /Send 50 USDT/ })).toBeNull()
  })

  it('sends one resume for a double click', async () => {
    gemBalance = 50n * USDT
    cashout.mockRejectedValue(new CashoutStrandedError(50n * USDT, TREASURY, rejected()))
    resumeBridge.mockReturnValue(new Promise(() => undefined))
    renderPanel()
    await fill('50')
    fireEvent.click(button())
    const resume = await resumeButton(50)
    act(() => {
      resume.click()
      resume.click()
    })
    await waitFor(() => expect(resumeBridge).toHaveBeenCalledTimes(1))
    expect(resumeBridge).toHaveBeenCalledTimes(1)
  })

  it('adds a second stranded amount to the first, so one resume sends both', async () => {
    gemBalance = 80n * USDT
    cashout.mockRejectedValueOnce(new CashoutStrandedError(50n * USDT, TREASURY, rejected()))
    cashout.mockRejectedValueOnce(new CashoutStrandedError(30n * USDT, TREASURY2, rejected()))
    renderPanel()
    await fill('50')
    fireEvent.click(button())
    await resumeButton(50)
    typeAmount('30')
    fireEvent.click(button())
    expect(await resumeButton(80)).toBeTruthy()
  })

  it('shows the payout as paid once Yellow Card reports it, with the local amount and the number', async () => {
    cashout.mockResolvedValue(sentTo(TREASURY))
    onStatus = () => json({ withdrawalId: 'wd-00000000', state: 'paid', localAmount: '23760', currency: 'XOF' })
    renderPanel()
    await fill('50')
    fireEvent.click(button())
    expect(await screen.findByText(/23,760 XOF sent to \+2250701234567/)).toBeTruthy()
  })

  it("says the USDT goes back to the seller's Polygon address when the payout fails", async () => {
    cashout.mockResolvedValue(sentTo(TREASURY))
    onStatus = () => json({ withdrawalId: 'wd-00000000', state: 'failed' })
    renderPanel()
    await fill('50')
    fireEvent.click(button())
    expect(await screen.findByText('Yellow Card could not pay this number. It returns your USDT to your wallet address on Polygon.')).toBeTruthy()
  })

  it('starts "New cash-out" from a blank form', async () => {
    cashout.mockResolvedValue(sentTo(TREASURY))
    renderPanel()
    await fill('50')
    fireEvent.click(button())
    fireEvent.click(await screen.findByRole('button', { name: 'New cash-out' }))
    expect((screen.getByLabelText('You cash out') as HTMLInputElement).value).toBe('')
    expect((screen.getByLabelText('Country') as HTMLSelectElement).value).toBe('')
    expect((screen.getByLabelText('Full name') as HTMLInputElement).value).toBe('')
  })

  it('tells the page it is busy for the whole flow, so the page can lock its tabs', async () => {
    const onBusyChange = vi.fn()
    let finish: (value: unknown) => void = () => undefined
    cashout.mockReturnValue(
      new Promise((resolve) => {
        finish = resolve
      }),
    )
    renderPanel(onBusyChange)
    await fill('50')
    fireEvent.click(button())
    expect(onBusyChange).toHaveBeenLastCalledWith(true)
    await waitFor(() => expect(cashout).toHaveBeenCalled())
    finish(sentTo(TREASURY))
    await waitFor(() => expect(onBusyChange).toHaveBeenLastCalledWith(false))
  })

  it('says how much KMT the network fees need when the wallet holds too little (a new in-app wallet holds none)', async () => {
    kmtBalance = 0n
    renderPanel()
    await fill('50')
    expect(screen.getByRole('alert').textContent).toBe(
      'Network fees need up to 0.0143 KMT, and this wallet has 0 KMT. Add a little KMT to this wallet to cash out.',
    )
    expect(button().disabled).toBe(true)
    cleanup()
    kmtBalance = 14_300_000_000_000_000n
    renderPanel()
    await fill('50')
    expect(screen.queryByRole('alert')).toBeNull()
    expect(button().disabled).toBe(false)
  })

  it('stays disabled while the Polygon collateral is unknown', async () => {
    collateral = undefined
    renderPanel()
    await fill('5')
    expect(button().disabled).toBe(true)
  })
})
