'use client'

/**
 * Thirdweb SDK configuration — mirrors the KalySwap / kaly-vault setup so users
 * share ONE wallet across the KalyChain apps. The in-app wallet address is
 * derived from the login identity (email/social/passkey) under a given client
 * id, so using the SAME NEXT_PUBLIC_THIRDWEB_CLIENT_ID as KalySwap means the
 * same email logs into the same wallet on every site.
 *
 * Wagmi still drives every contract read/write — see thirdwebBridge.ts, which
 * wraps the connected thirdweb wallet as a wagmi connector.
 */

import { createThirdwebClient, defineChain as twDefineChain } from 'thirdweb'
import { inAppWallet, createWallet } from 'thirdweb/wallets'
import { APP_CHAIN_ID, kalyChainKmt, kalyChainMainnet, kalyChainTestnet } from '@/config/networks'

// createThirdwebClient throws on an empty clientId. Fall back to a placeholder so
// the module never crashes the page before the real key is set; injected wallets
// (MetaMask etc.) still work because our chains below use an explicit RPC and the
// wallet itself signs. The in-app (email/social) wallet REQUIRES the real key.
const CLIENT_ID = process.env.NEXT_PUBLIC_THIRDWEB_CLIENT_ID || 'MISSING_THIRDWEB_CLIENT_ID'

if (CLIENT_ID === 'MISSING_THIRDWEB_CLIENT_ID' && typeof window !== 'undefined') {
  console.warn(
    '[kusd-ui] NEXT_PUBLIC_THIRDWEB_CLIENT_ID is not set. Injected wallets (MetaMask) work, ' +
      'but the email/social in-app wallet is disabled until you add the key (reuse KalySwap’s).',
  )
}

export const thirdwebClient = createThirdwebClient({ clientId: CLIENT_ID })

// Thirdweb chains use a single explicit RPC (not viem's fallback array). Pointing
// at our own endpoint keeps reads/writes off thirdweb's edge so a placeholder
// client id still works for injected wallets. name/nativeCurrency/icon make the
// wallet UI show "KalyChain" + the KLC logo instead of generic placeholders.
// Logos served from our own /public/tokens (no remote traffic). thirdweb needs an ABSOLUTE
// URL (it won't resolve a relative path), so prefix with the app origin at runtime — these
// icons only render client-side, where window.location.origin is the live host.
const TOK_BASE = (typeof window !== 'undefined' ? window.location.origin : '') + '/tokens/'
const KLC_ICON = { url: TOK_BASE + 'klc.png', width: 64, height: 64, format: 'png' }
const KLC_NATIVE = { name: 'KalyCoin', symbol: 'KLC', decimals: 18 }
export const twKalyTestnet = twDefineChain({
  id: kalyChainTestnet.id,
  name: 'KalyChain Testnet',
  rpc: kalyChainTestnet.rpcUrls.default.http[0],
  nativeCurrency: KLC_NATIVE,
  icon: KLC_ICON,
  blockExplorers: [{ name: 'KalyScan', url: 'https://testnet.kalyscan.io' }],
})
export const twKalyMainnet = twDefineChain({
  id: kalyChainMainnet.id,
  name: 'KalyChain Mainnet',
  rpc: kalyChainMainnet.rpcUrls.default.http[0],
  nativeCurrency: KLC_NATIVE,
  icon: KLC_ICON,
  blockExplorers: [{ name: 'KalyScan', url: 'https://kalyscan.io' }],
})
/** The relaunched KalyChain (3890): native KMT, same logo as KalySwap uses for it. */
export const twKalyKmt = twDefineChain({
  id: kalyChainKmt.id,
  name: 'KalyChain',
  rpc: kalyChainKmt.rpcUrls.default.http[0],
  nativeCurrency: { name: 'KMT', symbol: 'KMT', decimals: 18 },
  icon: KLC_ICON,
  blockExplorers: [{ name: 'KalyScan', url: kalyChainKmt.blockExplorers.default.url }],
})

/**
 * Tokens shown in the in-app wallet's "View Assets" (keyed by chainId). Native KLC is
 * always shown automatically; this lists the ecosystem ERC-20s with their logos.
 */
export const SUPPORTED_TOKENS: Record<number, { address: string; name: string; symbol: string; icon: string }[]> = {
  [kalyChainMainnet.id]: [
    { address: '0x069255299Bb729399f3CECaBdc73d15d3D10a2A3', name: 'Wrapped KalyCoin', symbol: 'wKLC', icon: TOK_BASE + 'klc.png' },
    { address: '0xCC93b84cEed74Dc28c746b7697d6fA477ffFf65a', name: 'KalySwap Token', symbol: 'KSWAP', icon: TOK_BASE + 'kswap.png' },
    { address: '0xCd02480926317748e95c5bBBbb7D1070b2327f1A', name: 'KUSD Stablecoin', symbol: 'KUSD', icon: TOK_BASE + 'kusd.png' },
    { address: '0x2CA775C77B922A51FcF3097F52bFFdbc0250D99A', name: 'Tether USD', symbol: 'USDT', icon: TOK_BASE + 'usdt.png' },
    { address: '0x9cAb0c396cF0F4325913f2269a0b72BD4d46E3A9', name: 'USD Coin', symbol: 'USDC', icon: TOK_BASE + 'usdc.png' },
    { address: '0x6E92CAC380F7A7B86f4163fad0df2F277B16Edc6', name: 'DAI Token', symbol: 'DAI', icon: TOK_BASE + 'dai.png' },
    { address: '0xaA77D4a26d432B82DB07F8a47B7f7F623fd92455', name: 'Wrapped BTC', symbol: 'WBTC', icon: TOK_BASE + 'wbtc.png' },
    { address: '0xfdbB253753dDE60b11211B169dC872AaE672879b', name: 'Ether', symbol: 'ETH', icon: TOK_BASE + 'eth.png' },
    { address: '0x0e2318b62a096AC68ad2D7F37592CBf0cA9c4Ddb', name: 'Binance', symbol: 'BNB', icon: TOK_BASE + 'bnb.png' },
    { address: '0x706C9a63d7c8b7Aaf85DDCca52654645f470E8Ac', name: 'Polygon', symbol: 'POL', icon: TOK_BASE + 'pol.png' },
    { address: '0xdbba43d094bc683f7420d4b5a44cd9d6bf4f1773', name: 'KNETWORK', symbol: 'KNT', icon: TOK_BASE + 'knt.png' },
  ],
  [kalyChainTestnet.id]: [
    { address: '0x6c52f4afB0f23296D8D1C32485207a1e7c9AA3c3', name: 'KUSD Stablecoin', symbol: 'KUSD', icon: TOK_BASE + 'kusd.png' },
    { address: '0x6Fdb0fEd277b878a0d80494b06EA054C99d2fdD2', name: 'Tether USD', symbol: 'USDT', icon: TOK_BASE + 'usdt.png' },
  ],
  // 3890 addresses: kalychain-ops/files/kmt-3890/addresses.json (tokens + kusd.core.Kusd)
  [kalyChainKmt.id]: [
    { address: '0xf90F0Bd56558Ac12F7FC285571D38181d2feD69b', name: 'Wrapped KMT', symbol: 'wKMT', icon: TOK_BASE + 'klc.png' },
    { address: '0xFDb3307a16442ed5A7C040AE1600a3B3D3C8e7D9', name: 'KUSD Stablecoin', symbol: 'KUSD', icon: TOK_BASE + 'kusd.png' },
    { address: '0x6318EcDbae6B469D39C38949eDC671f4bA8A6172', name: 'Tether USD', symbol: 'USDT', icon: TOK_BASE + 'usdt.png' },
    { address: '0xf00A4b733093C21b0892eae0578F0a926f9370b3', name: 'USD Coin', symbol: 'USDC', icon: TOK_BASE + 'usdc.png' },
    { address: '0x8fbff791fCcF596DEf2e788549d0275557F95A21', name: 'DAI Token', symbol: 'DAI', icon: TOK_BASE + 'dai.png' },
    { address: '0xE3f1A8Af16d2Dcd0B6F1F813C449375f85C9d97F', name: 'Wrapped BTC', symbol: 'WBTC', icon: TOK_BASE + 'wbtc.png' },
    { address: '0x73b8fBACFF08DafD9a0a6cB8699C64a488d9EA2a', name: 'Ether', symbol: 'ETH', icon: TOK_BASE + 'eth.png' },
  ],
}

/** thirdweb chain per KalyChain id. */
export const TW_CHAINS = {
  [kalyChainMainnet.id]: twKalyMainnet,
  [kalyChainTestnet.id]: twKalyTestnet,
  [kalyChainKmt.id]: twKalyKmt,
} as const

// The chain the ConnectButton connects to: the app's chain (NEXT_PUBLIC_NETWORK), the only one offered.
export const twActiveChain = (TW_CHAINS as Record<number, typeof twKalyKmt>)[APP_CHAIN_ID] ?? twKalyKmt
export const thirdwebChains = [twActiveChain]

/** In-app wallet: email / social / passkey login. Same auth set as KalySwap. */
export const kusdInAppWallet = inAppWallet({
  auth: {
    options: ['email', 'google', 'apple', 'passkey', 'phone'],
    mode: 'popup',
  },
})

/** External wallets, surfaced after the in-app option. */
export const externalWallets = [
  createWallet('io.metamask'),
  createWallet('com.coinbase.wallet'),
  createWallet('io.rabby'),
]

/** In-app wallet first (the shared-login path), then external, then WalletConnect. */
export const allWallets = [kusdInAppWallet, ...externalWallets, createWallet('walletConnect')]
