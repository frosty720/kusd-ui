import { defineChain } from 'viem'

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

// Network configuration
export const NETWORKS = {
  testnet: kalyChainTestnet,
  mainnet: kalyChainMainnet,
} as const

// Default network (start with testnet)
export const DEFAULT_NETWORK = NETWORKS.testnet

// Get current network based on environment
export function getCurrentNetwork() {
  const env = process.env.NEXT_PUBLIC_NETWORK || 'testnet'
  return NETWORKS[env as keyof typeof NETWORKS] || DEFAULT_NETWORK
}

