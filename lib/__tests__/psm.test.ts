/**
 * PSM swaps: the quote must be exactly what KssLitePsm moves (a fee left out, or a KUSD amount that
 * buys a fraction of a micro-USDT, is money the user did not expect to pay), and a typed amount is
 * only accepted in the token's own precision.
 */
import { describe, expect, it } from 'vitest'
import { exactAmount, parseAmount, showAmount } from '../amounts'
import { psmBuyCost, psmFeeLabel, psmGemsForKusd, psmSellOut, quotePsm } from '../psm'

const WAD = 10n ** 18n
const USDT = 10n ** 6n
const PCT = WAD / 100n

describe('parseAmount', () => {
  it('parses plain decimals up to the token precision', () => {
    expect(parseAmount('12.5', 6)).toBe(12_500_000n)
    expect(parseAmount(' 7 ', 18)).toBe(7n * WAD)
    expect(parseAmount('.5', 6)).toBe(500_000n)
  })

  it('rejects empty, signed, exponent, grouped and over-precise input', () => {
    for (const v of ['', '.', '-1', '1e6', '1,000', 'abc', '1.1234567']) expect(parseAmount(v, 6), v).toBeNull()
  })
})

describe('showAmount / exactAmount', () => {
  it('groups thousands and caps the decimals shown', () => {
    expect(showAmount(1_234_567_891n, 6)).toBe('1,234.5679')
    expect(showAmount(1_234_567_891n, 6, 2)).toBe('1,234.57')
  })

  it('gives the exact decimal string for Max, with nothing rounded', () => {
    expect(exactAmount(1_234_567_891n, 6)).toBe('1234.567891')
  })
})

describe('PSM quotes (KssLitePsm._sellGem / _buyGem)', () => {
  it('sells 1,000 USDT for exactly 1,000 KUSD with no fee', () => {
    expect(psmSellOut(1_000n * USDT, 6, 0n)).toBe(1_000n * WAD)
  })

  it('takes the tin fee out of the KUSD paid', () => {
    expect(psmSellOut(1_000n * USDT, 6, PCT)).toBe(990n * WAD)
  })

  it('adds the tout fee to the KUSD charged', () => {
    expect(psmBuyCost(1_000n * USDT, 6, PCT)).toBe(1_010n * WAD)
    expect(psmBuyCost(1_000n * USDT, 6, 0n)).toBe(1_000n * WAD)
  })

  it('finds the most USDT a KUSD amount can buy, never costing more than offered', () => {
    expect(psmGemsForKusd(1_010n * WAD, 6, PCT)).toBe(1_000n * USDT)
    expect(psmGemsForKusd(1_000n * WAD + 5n * 10n ** 11n, 6, 0n)).toBe(1_000n * USDT) // sub-micro KUSD is left behind
    const exact = psmBuyCost(777_777n, 6, 3n * PCT)
    expect(psmGemsForKusd(exact, 6, 3n * PCT)).toBe(777_777n)
    expect(psmGemsForKusd(exact - 1n, 6, 3n * PCT)).toBe(777_776n)
    for (const kusd of [1n, 10n ** 12n - 1n, 123_456_789_123_456_789n]) {
      const gems = psmGemsForKusd(kusd, 6, 7n * PCT)
      expect(psmBuyCost(gems, 6, 7n * PCT) <= kusd).toBe(true)
      expect(psmBuyCost(gems + 1n, 6, 7n * PCT) > kusd).toBe(true)
    }
  })
})

describe('quotePsm', () => {
  it('sell: USDT in, KUSD out 1:1 less tin', () => {
    expect(quotePsm('sell', '1000', 0n, 0n, 6)).toEqual({ gemAmt: 1_000n * USDT, pay: 1_000n * USDT, receive: 1_000n * WAD })
    expect(quotePsm('sell', '100', PCT, 0n, 6)?.receive).toBe(99n * WAD)
  })

  it('buy: KUSD in, the most USDT it buys, charging the exact cost', () => {
    expect(quotePsm('buy', '40', 0n, 0n, 6)).toEqual({ gemAmt: 40n * USDT, pay: 40n * WAD, receive: 40n * USDT })
    const withFee = quotePsm('buy', '101', 0n, PCT, 6)
    expect(withFee?.receive).toBe(100n * USDT)
    expect(withFee?.pay).toBe(101n * WAD)
  })

  it('buy: sub-micro KUSD is not spent (USDT has 6 decimals)', () => {
    expect(quotePsm('buy', '1.0000009', 0n, 0n, 6)?.pay).toBe(WAD)
    expect(quotePsm('buy', '0.0000001', 0n, 0n, 6)).toBeNull()
  })

  it('returns null for missing, zero or invalid input', () => {
    expect(quotePsm('sell', '', 0n, 0n, 6)).toBeNull()
    expect(quotePsm('sell', '0', 0n, 0n, 6)).toBeNull()
    expect(quotePsm('sell', '1.1234567', 0n, 0n, 6)).toBeNull()
    expect(quotePsm('buy', 'abc', 0n, 0n, 6)).toBeNull()
  })
})

describe('psmFeeLabel', () => {
  it('says when there is no fee, and shows a set fee as a percent', () => {
    expect(psmFeeLabel(0n)).toBe('No fee')
    expect(psmFeeLabel(PCT)).toBe('1%')
    expect(psmFeeLabel(WAD / 1000n)).toBe('0.1%')
    expect(psmFeeLabel(WAD / 10_000n)).toBe('0.01%')
  })
})
