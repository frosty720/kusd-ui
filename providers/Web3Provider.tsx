'use client'

import { type ReactNode, useState } from 'react'
import { WagmiProvider, createConfig, http } from 'wagmi'
import { ThirdwebProvider } from 'thirdweb/react'
import { QueryClientProvider, QueryClient } from '@tanstack/react-query'
import { kalyChainMainnet, kalyChainTestnet } from '@/config/networks'
import { useThirdwebWagmiBridge } from '@/config/thirdwebBridge'
import { ToastProvider } from '@/providers/ToastProvider'

// Wallet connection is driven by thirdweb's ConnectButton; the bridge below
// registers the connected wallet as a wagmi connector at runtime, so we keep
// the wagmi config connector-less and let every contract hook flow through it.
// Both KalyChain networks are configured so the app reads/writes whichever chain
// the wallet is on (default selected via NEXT_PUBLIC_NETWORK in the thirdweb config).
const config = createConfig({
  chains: [kalyChainMainnet, kalyChainTestnet],
  transports: { [kalyChainMainnet.id]: http(), [kalyChainTestnet.id]: http() },
  ssr: true,
})

/** Runs inside both providers; syncs the active thirdweb wallet into wagmi. */
function Bridge({ children }: { children: ReactNode }) {
  useThirdwebWagmiBridge()
  return <>{children}</>
}

export function Web3Provider({ children }: { children: ReactNode }) {
  const [queryClient] = useState(() => new QueryClient())
  return (
    <QueryClientProvider client={queryClient}>
      <WagmiProvider config={config}>
        <ThirdwebProvider>
          <ToastProvider>
            <Bridge>{children}</Bridge>
          </ToastProvider>
        </ThirdwebProvider>
      </WagmiProvider>
    </QueryClientProvider>
  )
}
