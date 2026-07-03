'use client'

import { ConnectButton, darkTheme } from 'thirdweb/react'
import { thirdwebClient, thirdwebChains, twActiveChain, allWallets, SUPPORTED_TOKENS } from '@/config/thirdweb'

// Brand the thirdweb modal + button to KUSD's amber-on-black system
// (matches --color-primary #F59E0B / --color-primary-dark #D97706 in globals.css).
const kusdTheme = darkTheme({
  colors: {
    modalBg: '#0a0a0a',
    borderColor: 'rgba(245, 158, 11, 0.25)',
    accentText: '#f59e0b',
    accentButtonBg: '#f59e0b',
    accentButtonText: '#0a0a0a',
    primaryButtonBg: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
    primaryButtonText: '#ffffff',
    secondaryButtonBg: 'rgba(255,255,255,0.06)',
    primaryText: '#ffffff',
    secondaryText: '#9ca3af',
  },
})

/**
 * Shared connect/account button. `compact` renders a tighter modal (used in the
 * header); the default is used for the standalone connect prompt.
 */
export function WalletButton({ compact = false, label = 'Connect Wallet' }: { compact?: boolean; label?: string }) {
  return (
    <ConnectButton
      client={thirdwebClient}
      wallets={allWallets}
      chains={thirdwebChains}
      chain={twActiveChain}
      supportedTokens={SUPPORTED_TOKENS}
      theme={kusdTheme}
      connectButton={{ label }}
      connectModal={{
        title: 'Connect to KUSD',
        size: compact ? 'compact' : 'wide',
        showThirdwebBranding: false,
      }}
    />
  )
}
