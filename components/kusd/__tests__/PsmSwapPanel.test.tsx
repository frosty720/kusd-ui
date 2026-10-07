/**
 * @vitest-environment happy-dom
 *
 * Swapping USDT ⇄ KUSD at the PSM: the approval is exactly what the swap pulls (never unlimited) and
 * goes out only when the allowance is short; nothing is offered beyond the wallet balance, the PSM's
 * capacity, or while the direction is halted.
 */
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { kusdTrade } from '@/config/kusdTrade'
import { PSM_HALTED } from '@/lib/psm'

const WALLET = '0x1111111111111111111111111111111111111111'
const USDT = 10n ** 6n
const WAD = 10n ** 18n
const trade = kusdTrade(3890)!
let account: string | undefined = WALLET
let tin = 0n
let wallet = { gemBalance: 100n * USDT, gemAllowance: 0n, kusdBalance: 80n * WAD, kusdAllowance: 0n }
const approve = vi.fn(async () => '0xapprove')
const swap = vi.fn(async () => '0xswap')
const showToast = vi.fn()

vi.mock('wagmi', () => ({ useAccount: () => ({ address: account }) }))
vi.mock('@/components/WalletButton', () => ({ WalletButton: () => <span>connect</span> }))
vi.mock('@/providers/ToastProvider', () => ({ useToast: () => ({ showToast }) }))
vi.mock('@/hooks/usePsmTrade', async () => {
  const actual = await vi.importActual<typeof import('@/hooks/usePsmTrade')>('@/hooks/usePsmTrade')
  return {
    psmPayToken: actual.psmPayToken,
    usePsmState: () => ({ data: { tin, tout: 0n, kusdCash: 50n * WAD, pocketGem: 1_000n * USDT } }),
    usePsmWallet: () => ({ data: wallet }),
    useApprovePsm: () => approve,
    usePsmSwap: () => swap,
  }
})

import PsmSwapPanel from '../PsmSwapPanel'

beforeEach(() => {
  account = WALLET
  tin = 0n
  wallet = { gemBalance: 100n * USDT, gemAllowance: 0n, kusdBalance: 80n * WAD, kusdAllowance: 0n }
  approve.mockClear()
  swap.mockClear()
  showToast.mockReset()
})
afterEach(cleanup)

const type = (value: string) => fireEvent.change(screen.getByLabelText('You pay'), { target: { value } })
const action = () => screen.getAllByRole('button').at(-1) as HTMLButtonElement

describe('PsmSwapPanel', () => {
  it('buys KUSD with USDT: approves exactly the USDT first, then swaps', async () => {
    render(<PsmSwapPanel trade={trade} direction="sell" />)
    type('25')
    expect(screen.getByText('25')).toBeTruthy() // 25 KUSD out, no fee
    fireEvent.click(screen.getByRole('button', { name: 'Approve 25 USDT' }))
    await waitFor(() => expect(approve).toHaveBeenCalledWith('sell', 25n * USDT))
    expect(swap).not.toHaveBeenCalled()

    cleanup()
    wallet = { ...wallet, gemAllowance: 25n * USDT }
    render(<PsmSwapPanel trade={trade} direction="sell" />)
    type('25')
    fireEvent.click(screen.getByRole('button', { name: 'Swap' }))
    await waitFor(() => expect(swap).toHaveBeenCalledWith({ direction: 'sell', gemAmt: 25n * USDT }))
    expect(showToast).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'success', message: 'Swapped 25 USDT for 25 KUSD', href: expect.stringContaining('/tx/0xswap') }),
    )
  })

  it('sells KUSD for USDT, spending only the 6-decimal part of what was typed', async () => {
    wallet = { ...wallet, kusdAllowance: 80n * WAD }
    render(<PsmSwapPanel trade={trade} direction="buy" />)
    type('10.1234567')
    expect(screen.getByText('USDT has 6 decimals, so 10.123456 KUSD will be used.')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Swap' }))
    await waitFor(() => expect(swap).toHaveBeenCalledWith({ direction: 'buy', gemAmt: 10_123_456n }))
  })

  it('takes the tin fee out of the KUSD shown', () => {
    tin = WAD / 100n
    render(<PsmSwapPanel trade={trade} direction="sell" />)
    type('10')
    expect(screen.getByText('9.9')).toBeTruthy()
    expect(screen.getByText('1%')).toBeTruthy()
  })

  it('blocks more than the wallet holds, and more than the PSM can pay', () => {
    render(<PsmSwapPanel trade={trade} direction="sell" />)
    type('101')
    expect(screen.getByRole('alert').textContent).toBe('Insufficient USDT balance')
    expect(action().disabled).toBe(true)
    type('60')
    expect(screen.getByRole('alert').textContent).toBe('The PSM has only 50 KUSD available for this swap right now.')
    expect(action().disabled).toBe(true)
  })

  it('offers nothing while the direction is halted', () => {
    tin = PSM_HALTED
    render(<PsmSwapPanel trade={trade} direction="sell" />)
    type('10')
    expect(screen.getByRole('alert').textContent).toBe('Swaps in this direction are paused.')
    expect(action().disabled).toBe(true)
  })

  it('reports a failed swap with the reason', async () => {
    wallet = { ...wallet, gemAllowance: 25n * USDT }
    swap.mockRejectedValueOnce(new Error('User rejected the request.'))
    render(<PsmSwapPanel trade={trade} direction="sell" />)
    type('25')
    fireEvent.click(screen.getByRole('button', { name: 'Swap' }))
    await waitFor(() => expect(showToast).toHaveBeenCalledWith({ type: 'error', message: 'Swap failed: Transaction rejected in your wallet.' }))
  })

  it('asks for a wallet before anything else', () => {
    account = undefined
    render(<PsmSwapPanel trade={trade} direction="sell" />)
    expect(screen.getByText('connect')).toBeTruthy()
  })
})
