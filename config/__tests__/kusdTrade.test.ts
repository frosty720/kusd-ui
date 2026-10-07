/**
 * The addresses buying, selling and cashing out KUSD send money to. Each one is pinned to
 * kalychain-ops/files/kmt-3890/addresses.json (and the Polygon side to the USDT warp route), so a
 * wrong PSM, pocket or router is caught here, not by a user's transaction.
 */
import { describe, expect, it } from 'vitest'
import { kusdTrade } from '../kusdTrade'
import { polygonRpcUrls } from '../polygon'

describe('kusdTrade', () => {
  it('trades KUSD against USDT through the 3890 USDT PSM', () => {
    const trade = kusdTrade(3890)
    expect(trade?.psm.toLowerCase()).toBe('0xe9d8b5b224a8e2d949b9819c8ecb72a6662ebf94') // kusd.psmUsdt.psm
    expect(trade?.pocket.toLowerCase()).toBe('0xab4538afb596c701e4cf1a7780a710a6e3406ee8') // kusd.psmUsdt.pocket
    expect(trade?.kusd).toEqual({ symbol: 'KUSD', address: '0xfdb3307a16442ed5a7c040ae1600a3b3d3c8e7d9', decimals: 18 })
    expect(trade?.gem).toEqual({ symbol: 'USDT', address: '0x6318EcDbae6B469D39C38949eDC671f4bA8A6172', decimals: 6 }) // tokens.USDT
  })

  it('cashes out over the USDT route to Polygon', () => {
    expect(kusdTrade(3890)?.cashout).toEqual({
      destinationDomain: 137,
      polygonRouter: '0x2f7c83FC82A0e39A997c262e5BAB13176C275104', // hyperlane.polygonRouters.USDT
      polygonUsdt: '0xc2132D05D31c914a87C6611C10748AEb04B58e8F',
      polygonMailbox: '0x5d934f4e2f797775e53561bB72aca21ba36B96BB',
    })
  })

  it('offers no trading on the retired chains', () => {
    expect(kusdTrade(3888)).toBeNull()
    expect(kusdTrade(3889)).toBeNull()
  })
})

describe('polygonRpcUrls', () => {
  it('prefers an explicit RPC, then thirdweb under the app client id, then the public endpoint', () => {
    expect(polygonRpcUrls('https://polygon.example/rpc', 'abc')).toEqual(['https://polygon.example/rpc', 'https://polygon-bor-rpc.publicnode.com'])
    expect(polygonRpcUrls(undefined, 'abc')).toEqual(['https://137.rpc.thirdweb.com/abc', 'https://polygon-bor-rpc.publicnode.com'])
    expect(polygonRpcUrls('', '')).toEqual(['https://polygon-bor-rpc.publicnode.com'])
  })
})
