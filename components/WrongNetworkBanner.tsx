'use client'

import { useState } from 'react'
import { useActiveWallet, useActiveWalletChain, useSwitchActiveWalletChain } from 'thirdweb/react'
import { APP_NETWORK } from '@/config/networks'
import { twActiveChain } from '@/config/thirdweb'

/**
 * Shown while the connected wallet is on another chain. Every read and write in this app is
 * pinned to APP_NETWORK, so on the wrong chain balances look empty and transactions are refused
 * — this says why and switches the wallet in one click.
 */
export function WrongNetworkBanner() {
  const wallet = useActiveWallet()
  const chain = useActiveWalletChain()
  const switchChain = useSwitchActiveWalletChain()
  const [error, setError] = useState('')
  const [switching, setSwitching] = useState(false)

  if (!wallet || !chain || chain.id === APP_NETWORK.id) return null

  const onSwitch = async () => {
    setError('')
    setSwitching(true)
    try {
      await switchChain(twActiveChain)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not switch network')
    } finally {
      setSwitching(false)
    }
  }

  return (
    <div role="alert" className="border-b border-[#F59E0B]/40 bg-[#1a0f00]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3 flex flex-wrap items-center justify-between gap-3 text-sm">
        <p className="text-[#fbbf24]">
          Your wallet is on another network. KUSD runs on {APP_NETWORK.name} (chain {APP_NETWORK.id}).
          {error && <span className="block text-red-400">{error}</span>}
        </p>
        <button
          type="button"
          onClick={onSwitch}
          disabled={switching}
          className="rounded-lg bg-[#F59E0B] px-4 py-1.5 font-semibold text-black hover:bg-[#FBBF24] disabled:opacity-50"
        >
          {switching ? 'Switching…' : `Switch to ${APP_NETWORK.name}`}
        </button>
      </div>
    </div>
  )
}
