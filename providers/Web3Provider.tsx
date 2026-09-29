'use client'

import { type ReactNode, useState } from 'react'
import { WagmiProvider, createConfig, http } from 'wagmi'
import { ThirdwebProvider } from 'thirdweb/react'
import { QueryClientProvider, QueryClient } from '@tanstack/react-query'
import { APP_NETWORK } from '@/config/networks'
import { useThirdwebWagmiBridge } from '@/config/thirdwebBridge'
import { ToastProvider } from '@/providers/ToastProvider'

// Wallet connection is driven by thirdweb's ConnectButton; the bridge below
// registers the connected wallet as a wagmi connector at runtime, so we keep
// the wagmi config connector-less and let every contract hook flow through it.
// Only the app's chain (NEXT_PUBLIC_NETWORK) is configured: every read and write is pinned
// to it, and a wallet on any other chain is asked to switch (see WrongNetworkBanner).
const config = createConfig({
  chains: [APP_NETWORK],
  transports: { [APP_NETWORK.id]: http() },
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
