/**
 * The home page's TVL / supply / backing cards. They used to show supply × 1.5 as "TVL" and
 * therefore a permanent 150% ratio — $15,000 on 3890 on 2026-09-28 when the real backing was
 * the 1,000.10 USDT in the PSM pocket. These pin the figures to on-chain state.
 */
import { describe, expect, it } from 'vitest'
import { backingLabel, collateralUsdWad, protocolStats, type VaultCollateral } from '../protocolStats'

const RAY = 10n ** 27n
const WAD = 10n ** 18n
const RAD = 10n ** 45n
const EMPTY_VAULT: VaultCollateral = { balance: 0n, decimals: 18, spot: 0n, mat: 0n }

// 3890 on 2026-09-28: Vat.debt 10,000 KUSD, 8,999.90 still inside the PSM, 1,000.10 USDT in the
// pocket, all five GemJoins empty and unpriced.
const LIVE_3890 = {
  vatDebt: 10_000n * RAD,
  psmKusd: 8_999_900_000_000_000_000_000n,
  pocketGem: 1_000_100_000n,
  gemDecimals: 6,
  vaults: [EMPTY_VAULT, EMPTY_VAULT, EMPTY_VAULT, EMPTY_VAULT, EMPTY_VAULT],
}

describe('protocolStats', () => {
  it('reports the live 3890 state as $1,000.10 TVL, 1,000.10 KUSD circulating, 100% backed', () => {
    const s = protocolStats(LIVE_3890)
    expect(s.tvlUsd).toBe(1000.1)
    expect(s.circulatingKusd).toBe(1000.1)
    expect(s.backingPct).toBe(100)
    expect(s.unpricedCollateral).toBe(false)
  })

  it('adds priced vault collateral at spot × mat and backs its debt at the vault ratio', () => {
    // 0.5 WBTC (8 dec) at $60,000 with mat 150% → spot = 40,000 RAY → $30,000 locked.
    const wbtc: VaultCollateral = { balance: 50_000_000n, decimals: 8, spot: 40_000n * RAY, mat: (3n * RAY) / 2n }
    const s = protocolStats({ ...LIVE_3890, vatDebt: 30_000n * RAD, vaults: [wbtc] })
    expect(s.tvlUsd).toBe(31_000.1) // 30,000 vault + 1,000.10 pocket
    expect(s.circulatingKusd).toBe(21_000.1) // 30,000 debt − 8,999.90 in the PSM
    expect(s.backingPct).toBe(147.61) // 31,000.10 / 21,000.10, floored to the basis point
  })

  it('flags collateral that has no price instead of counting it as $0 silently', () => {
    const unpriced: VaultCollateral = { balance: 5n * WAD, decimals: 18, spot: 0n, mat: (3n * RAY) / 2n }
    const s = protocolStats({ ...LIVE_3890, vaults: [unpriced] })
    expect(s.unpricedCollateral).toBe(true)
    expect(s.tvlUsd).toBe(1000.1)
  })

  it('has no backing % when every KUSD still sits in the PSM', () => {
    const s = protocolStats({ ...LIVE_3890, pocketGem: 0n, psmKusd: 10_000n * WAD })
    expect(s.circulatingKusd).toBe(0)
    expect(s.backingPct).toBeNull()
  })

  it('never reports negative circulation if the PSM holds more KUSD than the Vat debt', () => {
    expect(protocolStats({ ...LIVE_3890, vatDebt: 0n }).circulatingKusd).toBe(0)
  })
})

describe('collateralUsdWad', () => {
  it('scales token decimals to 18 before pricing', () => {
    // 2 WETH (18 dec) at $3,000, mat 1.5 → spot 2,000 → $6,000
    expect(collateralUsdWad({ balance: 2n * WAD, decimals: 18, spot: 2_000n * RAY, mat: (3n * RAY) / 2n })).toBe(6_000n * WAD)
    // 1,000 USDC (6 dec) at $1, mat 1.01 → $1,000 (spot × mat undoes the ratio)
    const mat = (101n * RAY) / 100n
    expect(collateralUsdWad({ balance: 1_000_000_000n, decimals: 6, spot: (RAY * RAY) / mat, mat }) / 10n ** 12n).toBe(1_000_000_000n - 1n)
  })
})

describe('backingLabel', () => {
  it('calls 100% and above fully backed, anything below under-backed', () => {
    expect(backingLabel(100)).toBe('Fully backed')
    expect(backingLabel(147.61)).toBe('Fully backed')
    expect(backingLabel(99.99)).toBe('Under-backed')
    expect(backingLabel(null)).toBe('No KUSD issued')
  })
})
