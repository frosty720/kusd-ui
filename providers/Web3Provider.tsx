'use client'

import '@rainbow-me/rainbowkit/styles.css'
import { getDefaultConfig, RainbowKitProvider } from '@rainbow-me/rainbowkit'
import { WagmiProvider } from 'wagmi'
import { QueryClientProvider, QueryClient } from '@tanstack/react-query'
import { kalyChainTestnet, kalyChainMainnet, getCurrentNetwork } from '@/config/networks'

const config = getDefaultConfig({
  appName: 'KUSD - KalyChain Stablecoin',
  projectId: process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID || 'YOUR_PROJECT_ID',
  chains: [kalyChainTestnet, kalyChainMainnet],
  ssr: true,
  // Batch RPC calls for better performance
  batch: {
    multicall: false, // Disable multicall for KalyChain compatibility
  },
})

const queryClient = new QueryClient()

export function Web3Provider({ children }: { children: React.ReactNode }) {
  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>
        <RainbowKitProvider initialChain={getCurrentNetwork()}>
          {children}
        </RainbowKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  )
}

