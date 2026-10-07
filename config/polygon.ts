import { createPublicClient, fallback, http } from 'viem'
import { polygon } from 'viem/chains'

const PUBLIC_POLYGON_RPC = 'https://polygon-rpc.com'

/**
 * Polygon RPCs for the cash-out's two reads (the route's USDT balance, delivered()): an explicit
 * NEXT_PUBLIC_POLYGON_RPC_URL, else thirdweb's RPC under the app's client id (as KalySwap does), then
 * the public endpoint as a fallback.
 */
export function polygonRpcUrls(explicitUrl?: string, thirdwebClientId?: string): string[] {
  const primary = explicitUrl || (thirdwebClientId ? `https://137.rpc.thirdweb.com/${thirdwebClientId}` : '')
  return primary ? [primary, PUBLIC_POLYGON_RPC] : [PUBLIC_POLYGON_RPC]
}

/**
 * Read-only Polygon client. Kept out of the wagmi config on purpose: wagmi only knows the app's
 * chain, so a wallet is never offered (or switched to) Polygon.
 */
export const polygonClient = createPublicClient({
  chain: polygon,
  transport: fallback(polygonRpcUrls(process.env.NEXT_PUBLIC_POLYGON_RPC_URL, process.env.NEXT_PUBLIC_THIRDWEB_CLIENT_ID).map((url) => http(url))),
})
