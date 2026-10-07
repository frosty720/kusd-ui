/**
 * @vitest-environment happy-dom
 *
 * The Buy / Sell page routes each choice to its panel, and locks the tabs while a cash-out runs:
 * switching away would unmount the cash-out panel and lose the status of a transfer in flight.
 */
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('wagmi', () => ({ useAccount: () => ({ address: undefined }) }))
vi.mock('@/components/Navigation', () => ({ default: () => null }))
vi.mock('@/components/kusd/PsmSwapPanel', () => ({ default: ({ direction }: { direction: string }) => <div>psm-{direction}</div> }))
vi.mock('@/components/kusd/CashoutPanel', () => ({
  default: ({ onBusyChange }: { onBusyChange: (busy: boolean) => void }) => (
    <button type="button" onClick={() => onBusyChange(true)}>
      cash-out-panel
    </button>
  ),
}))

import BuySellPage from '../page'

beforeEach(() => {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => new Response(JSON.stringify({ corridors: [] }), { status: 200 })),
  )
})
afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

const tab = (name: string) => screen.getByRole('tab', { name }) as HTMLButtonElement
const chip = (name: string) => screen.getByRole('button', { name }) as HTMLButtonElement

describe('Buy / Sell page', () => {
  it('opens on buying with local currency (the Yellow Card form)', async () => {
    render(<BuySellPage />)
    expect(tab('Buy KUSD').getAttribute('aria-selected')).toBe('true')
    expect(await screen.findByText('Continue to payment')).toBeTruthy()
  })

  it('buys with USDT through the PSM (sellGem)', () => {
    render(<BuySellPage />)
    fireEvent.click(chip('USDT'))
    expect(screen.getByText('psm-sell')).toBeTruthy()
  })

  it('sells for USDT through the PSM (buyGem) by default, or to mobile money', () => {
    render(<BuySellPage />)
    fireEvent.click(tab('Sell KUSD'))
    expect(screen.getByText('psm-buy')).toBeTruthy()
    fireEvent.click(chip('Mobile money'))
    expect(screen.getByText('cash-out-panel')).toBeTruthy()
  })

  it('locks the tabs and the receive choice while a cash-out runs', () => {
    render(<BuySellPage />)
    fireEvent.click(tab('Sell KUSD'))
    fireEvent.click(chip('Mobile money'))
    fireEvent.click(screen.getByText('cash-out-panel'))
    expect(tab('Buy KUSD').disabled).toBe(true)
    expect(chip('USDT on KalyChain').disabled).toBe(true)
    fireEvent.click(tab('Buy KUSD'))
    expect(screen.getByText('cash-out-panel')).toBeTruthy()
  })
})
