/**
 * The wallet side of the 3890 migration: the ConnectButton offers and connects to the app's chain
 * (3890, native KMT), and the in-app wallet lists the 3890 tokens — KUSD included — rather than
 * 3888 addresses.
 */
import { describe, expect, it } from 'vitest'
import { allWallets, SUPPORTED_TOKENS, TW_CHAINS, thirdwebChains, twActiveChain, twKalyKmt } from '../thirdweb'

describe('thirdweb config', () => {
  it('connects to the app chain (3890, native KMT) and offers only it', () => {
    expect(twKalyKmt.id).toBe(3890)
    expect(twKalyKmt.nativeCurrency?.symbol).toBe('KMT')
    expect(twActiveChain).toBe(twKalyKmt)
    expect(thirdwebChains).toEqual([twKalyKmt])
    expect(Object.keys(TW_CHAINS).map(Number).sort()).toEqual([3888, 3889, 3890])
  })

  it('lists the 3890 tokens, KUSD included, in the in-app wallet', () => {
    const kmt = SUPPORTED_TOKENS[3890]
    expect(kmt.find((t) => t.symbol === 'KUSD')?.address).toBe('0xFDb3307a16442ed5A7C040AE1600a3B3D3C8e7D9')
    expect(kmt.find((t) => t.symbol === 'USDT')?.address).toBe('0x6318EcDbae6B469D39C38949eDC671f4bA8A6172')
    expect(kmt.map((t) => t.symbol)).toEqual(['wKMT', 'KUSD', 'USDT', 'USDC', 'DAI', 'WBTC', 'ETH'])
  })

  it('keeps the in-app wallet first (the shared KalySwap login)', () => {
    expect(allWallets[0].id).toBe('inApp')
  })
})
