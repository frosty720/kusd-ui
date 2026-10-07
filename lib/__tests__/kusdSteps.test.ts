/**
 * The write plans decide which approvals go out and to whom: an approval to the wrong spender makes
 * the next step revert, an approval that is not exact leaves a standing allowance, and a bridge
 * transfer with the recipient packed wrong sends the USDT to an address nobody controls.
 */
import { describe, expect, it } from 'vitest'
import { kusdTrade } from '@/config/kusdTrade'
import { approveStep, bridgeToPolygonStep, cashoutSwapSteps, feeCeiling, type KusdStep, psmSwapStep, TransactionRevertedError } from '../kusdSteps'

const OWNER = '0x1111111111111111111111111111111111111111'
const TREASURY = '0x3333333333333333333333333333333333333333'
const trade = kusdTrade(3890)!
const route = trade.cashout!
const calls = (steps: KusdStep[]) => steps.map((s) => `${s.write.address}.${s.write.functionName}`)

describe('PSM steps', () => {
  it('approves exactly the amount, never unlimited', () => {
    const step = approveStep(trade.gem.address, trade.psm, 25n)
    expect(calls([step])).toEqual([`${trade.gem.address}.approve`])
    expect(step.write.args).toEqual([trade.psm, 25n])
    expect(step.action).toBe('approve')
  })

  it('sellGem for USDT → KUSD, buyGem for KUSD → USDT, both to the owner with the USDT amount', () => {
    expect(calls([psmSwapStep(trade.psm, 'sell', OWNER, 7n)])).toEqual([`${trade.psm}.sellGem`])
    const buy = psmSwapStep(trade.psm, 'buy', OWNER, 7n)
    expect(calls([buy])).toEqual([`${trade.psm}.buyGem`])
    expect(buy.write.args).toEqual([OWNER, 7n])
    expect(buy.action).toBe('swap')
  })

  it('gives every step a gas limit above what it measured on 3890', () => {
    expect(approveStep(trade.kusd.address, trade.psm, 1n).gas).toBeGreaterThanOrEqual(100_000n)
    expect(psmSwapStep(trade.psm, 'sell', OWNER, 1n).gas).toBeGreaterThan(77_240n) // sellGem
    expect(bridgeToPolygonStep(trade.gem.address, route, TREASURY, 1n, 0n).gas).toBeGreaterThan(119_549n) // transferRemote
  })
})

describe('cash-out steps', () => {
  const plan = { gemAmt: 60_000_000n, cost: 60n * 10n ** 18n }

  it('approves exactly the KUSD cost to the PSM, then buys the USDT into the owner wallet', () => {
    const steps = cashoutSwapSteps(trade, OWNER, plan, 0n)
    expect(calls(steps)).toEqual([`${trade.kusd.address}.approve`, `${trade.psm}.buyGem`])
    expect(steps[0].write.args).toEqual([trade.psm, plan.cost])
    expect(steps[1].write.args).toEqual([OWNER, plan.gemAmt])
  })

  it('skips the approval when the allowance already covers the cost', () => {
    expect(calls(cashoutSwapSteps(trade, OWNER, plan, plan.cost))).toEqual([`${trade.psm}.buyGem`])
  })

  it('sends to Polygon (domain 137) with the recipient left-padded to bytes32 and the quoted fee attached', () => {
    const step = bridgeToPolygonStep(trade.gem.address, route, TREASURY, plan.gemAmt, 7n)
    expect(calls([step])).toEqual([`${trade.gem.address}.transferRemote`])
    expect(step.write.args).toEqual([137, `0x000000000000000000000000${TREASURY.slice(2)}`, plan.gemAmt])
    expect(step.write.value).toBe(7n)
    expect(step.action).toBe('bridge')
  })

  it('leaves value out entirely when the route charges no fee (thirdweb wallets sign a zero value as an undecodable transaction)', () => {
    const step = bridgeToPolygonStep(trade.gem.address, route, TREASURY, plan.gemAmt, 0n)
    expect('value' in step.write).toBe(false)
  })
})

describe('feeCeiling', () => {
  it('is what a wallet requires for the steps: every gas limit at the 26 gwei max fee', () => {
    const plan = { gemAmt: 60_000_000n, cost: 60n * 10n ** 18n }
    const steps = [...cashoutSwapSteps(trade, OWNER, plan, 0n), bridgeToPolygonStep(trade.gem.address, route, TREASURY, plan.gemAmt, 0n)]
    expect(feeCeiling(steps)).toBe(550_000n * 26_000_000_000n) // 0.0143 KMT
    expect(feeCeiling([])).toBe(0n)
  })
})

describe('TransactionRevertedError', () => {
  it('names the step that reverted and keeps its hash', () => {
    const error = new TransactionRevertedError('0xabc', 'bridge')
    expect(error).toMatchObject({ name: 'TransactionRevertedError', hash: '0xabc', action: 'bridge' })
    expect(error.message).toBe('Bridge transfer failed: the transaction was reverted on-chain.')
    expect(new TransactionRevertedError('0xabc', 'approve').message).toMatch(/^Approval failed/)
    expect(new TransactionRevertedError('0xabc', 'swap').message).toMatch(/^Swap failed/)
  })
})
