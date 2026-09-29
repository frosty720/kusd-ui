/**
 * The dashboard's KUSD peg on 3890 is read from a V3 pool: the token order must not flip the
 * price (the reprice-keeper bug of 2026-09-28 was exactly that), and the status bands must match
 * the V2 reading used on the legacy chains.
 */
import { describe, expect, it } from 'vitest'
import { deepestPool, kusdPriceFromSqrt, pegStatus } from '../peg'

const Q96 = 2n ** 96n

describe('kusdPriceFromSqrt', () => {
  it('reads the live 3890 KUSD/USDT pool (USDT token0) as exactly $1.00', () => {
    // slot0 of 0xa497eCd4… on 2026-09-28: 1e6 · 2^96
    expect(kusdPriceFromSqrt(79228162514264337593543950336000000n, false)).toBeCloseTo(1, 12)
  })
  it('reads $1.00 with KUSD as token0', () => {
    expect(kusdPriceFromSqrt(Q96 / 1_000_000n, true)).toBeCloseTo(1, 9)
  })
  it('prices KUSD below $1 when the pool holds more KUSD per USDT', () => {
    const sqrt = BigInt(Math.round(Math.sqrt(1.01e12))) * Q96 // 1.01 KUSD per USDT
    expect(kusdPriceFromSqrt(sqrt, false)).toBeCloseTo(1 / 1.01, 5)
  })
  it('returns 0 for an uninitialised pool', () => {
    expect(kusdPriceFromSqrt(0n, false)).toBe(0)
  })
})

describe('pegStatus', () => {
  it('uses the same bands as the V2 reading', () => {
    expect(pegStatus(1)).toBe('on-peg')
    expect(pegStatus(1.0049)).toBe('on-peg')
    expect(pegStatus(1.006)).toBe('above-peg')
    expect(pegStatus(0.99)).toBe('below-peg')
    expect(pegStatus(1.03)).toBe('critical')
    expect(pegStatus(0.97)).toBe('critical')
  })
})

describe('deepestPool', () => {
  const pool = (liquidity: bigint, pool: `0x${string}`) => ({ pool, liquidity, sqrtPriceX96: Q96, token0: pool })
  it('picks the pool with the most active liquidity', () => {
    expect(deepestPool([pool(5n, '0x01'), pool(9n, '0x02'), pool(1n, '0x03')])?.pool).toBe('0x02')
  })
  it('ignores empty pools and returns null when none has liquidity', () => {
    expect(deepestPool([pool(0n, '0x01')])).toBeNull()
    expect(deepestPool([])).toBeNull()
  })
})
