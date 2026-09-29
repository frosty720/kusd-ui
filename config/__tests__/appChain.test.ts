/**
 * kusd-ui runs on ONE chain per deployment (NEXT_PUBLIC_NETWORK). Before the 3890 migration,
 * ~40 call sites fell back to the dead testnet (`chainId || 3889`) or chose contracts with
 * `chainId === 3888 ? MAINNET : TESTNET` — on 3890 the dashboard and admin pages would have read
 * the TESTNET contracts. These tests pin the app chain and keep those literals from coming back.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { getContracts, getNetworkSettings } from '../contracts'
import { APP_CHAIN_ID, APP_NETWORK, kalyChainKmt } from '../networks'
import { getTransactionGasConfig, getTransactionGasConfigWithOverrides, TRANSACTION_GAS_CONFIG } from '../transaction'

const ROOT = join(__dirname, '..', '..')
const GWEI = 1_000_000_000n

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    if (entry === 'node_modules' || entry === '__tests__' || entry.startsWith('.')) continue
    const full = join(dir, entry)
    if (statSync(full).isDirectory()) walk(full, out)
    else if (/\.tsx?$/.test(entry)) out.push(full)
  }
  return out
}

/** Strip comments so prose about the migration does not trip the guard. */
const code = (text: string) =>
  text
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .split('\n')
    .map((l) => l.replace(/(^|[^:])\/\/.*$/, '$1'))
    .join('\n')

describe('app chain', () => {
  it('defaults to the KMT chain (3890) when NEXT_PUBLIC_NETWORK is unset', () => {
    expect(APP_CHAIN_ID).toBe(3890)
    expect(APP_NETWORK).toBe(kalyChainKmt)
  })

  it('has contracts and settings on the app chain', () => {
    expect(getContracts(APP_CHAIN_ID).core.kusd).toBe('0xfdb3307a16442ed5a7c040ae1600a3b3d3c8e7d9')
    expect(getNetworkSettings(APP_CHAIN_ID).pegStable).toBe('USDT-A')
  })

  it('no page, component or hook hardcodes a chain id (config/ is the only place)', () => {
    const offenders = ['app', 'components', 'hooks', 'providers']
      .flatMap((d) => walk(join(ROOT, d)))
      .filter((f) => /\b(3888|3889|3890)\b/.test(code(readFileSync(f, 'utf8'))))
      .map((f) => f.replace(ROOT, ''))
    expect(offenders).toEqual([])
  })
})

describe('transaction fees', () => {
  it('pays the KalyChain 21 gwei tip with maxFee just above it', () => {
    expect(TRANSACTION_GAS_CONFIG.maxPriorityFeePerGas).toBe(21n * GWEI)
    expect(TRANSACTION_GAS_CONFIG.maxFeePerGas).toBe(26n * GWEI)
    expect(getTransactionGasConfig()).toBe(TRANSACTION_GAS_CONFIG)
  })

  it('pins every write to the app chain, even with a per-call gas override', () => {
    const cfg = getTransactionGasConfigWithOverrides({ gas: 5_000_000n })
    expect(cfg.chainId).toBe(APP_CHAIN_ID)
    expect(cfg.gas).toBe(5_000_000n)
    expect(cfg.maxPriorityFeePerGas).toBe(21n * GWEI)
    expect(getTransactionGasConfigWithOverrides().gas).toBe(300_000n)
  })
})

describe('network settings', () => {
  it('3890: USDT peg on KalySwap V3, the 3890 KeyPass gates /admin', () => {
    const s = getNetworkSettings(3890)
    expect(s.pegStable).toBe('USDT-A')
    expect(s.peg).toEqual({ kind: 'v3', factory: '0x79e8391b5cD2a3Cfd43F1A4Eb1a55796331e07F5', feeTiers: [100, 500, 3000, 10000] })
    expect(s.adminNft).toBe('0x75A00d81c37c27f60F1C855cF200592B43B35a34')
  })

  it('legacy chains keep the V2 USDC peg and the old KeyPass', () => {
    for (const id of [3888, 3889]) {
      const s = getNetworkSettings(id)
      expect(s.pegStable).toBe('USDC-A')
      expect(s.peg).toEqual({ kind: 'v2' })
      expect(s.adminNft).toBe('0x6B9557d1A52B9813288f45518D880C891b49491a')
    }
  })

  it('refuses an unknown chain', () => {
    expect(() => getNetworkSettings(1)).toThrow('Unsupported chain ID: 1')
  })
})
