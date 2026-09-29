import { type Chain, defineChain } from 'viem'

// KalyChain Testnet
export const kalyChainTestnet = defineChain({
  id: 3889,
  name: 'KalyChain Testnet',
  network: 'kalychain-testnet',
  nativeCurrency: {
    decimals: 18,
    name: 'KLC',
    symbol: 'KLC',
  },
  rpcUrls: {
    default: {
      http: ['https://testnetrpc.kalychain.io/rpc'],
    },
    public: {
      http: ['https://testnetrpc.kalychain.io/rpc'],
    },
  },
  blockExplorers: {
    default: { name: 'KalyScan', url: 'https://testnet.kalyscan.io' },
  },
  testnet: true,
})

// KalyChain Mainnet
export const kalyChainMainnet = defineChain({
  id: 3888,
  name: 'KalyChain',
  network: 'kalychain',
  nativeCurrency: {
    decimals: 18,
    name: 'KLC',
    symbol: 'KLC',
  },
  rpcUrls: {
    default: {
      http: ['https://rpc.kalychain.io/rpc'],
    },
    public: {
      http: ['https://rpc.kalychain.io/rpc'],
    },
  },
  blockExplorers: {
    default: { name: 'KalyScan', url: 'https://kalyscan.io' },
  },
  testnet: false,
})

// KMT relaunch chain (chainId 3890)
export const kalyChainKmt = defineChain({
  id: 3890,
  name: 'KalyChain',
  network: 'kalychain-kmt',
  nativeCurrency: {
    decimals: 18,
    name: 'KMT',
    symbol: 'KMT',
  },
  rpcUrls: {
    default: {
      http: ['https://mainrpc.kalychain.io/rpc'],
    },
    public: {
      http: ['https://mainrpc.kalychain.io/rpc'],
    },
  },
  blockExplorers: {
    default: { name: 'KalyScan', url: 'https://kalyscan.io' },
  },
  testnet: false,
})

// Network configuration
export const NETWORKS = {
  testnet: kalyChainTestnet,
  mainnet: kalyChainMainnet,
  kmt: kalyChainKmt,
} as const

// Default network: the KMT chain (3890) — the only live KalyChain since the relaunch
export const DEFAULT_NETWORK = NETWORKS.kmt

// Get current network based on environment
export function getCurrentNetwork() {
  const env = process.env.NEXT_PUBLIC_NETWORK || 'kmt'
  return NETWORKS[env as keyof typeof NETWORKS] || DEFAULT_NETWORK
}

/**
 * The chain this deployment runs on (NEXT_PUBLIC_NETWORK). Every read and write targets it,
 * whatever chain the wallet happens to be on — a wallet elsewhere is asked to switch.
 */
export const APP_NETWORK: Chain = getCurrentNetwork()
export const APP_CHAIN_ID: number = APP_NETWORK.id

