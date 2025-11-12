// @ts-nocheck
'use client'

import { useState, useEffect } from 'react'
import { useAccount, useBalance } from 'wagmi'
import Navigation from '@/components/Navigation'
import { useSKLC } from '@/hooks'
import { formatWAD, parseWAD, formatInputValue } from '@/lib'

export default function WrapPage() {
  const [amount, setAmount] = useState('')
  const [isWrapping, setIsWrapping] = useState(true) // true = wrap, false = unwrap
  const [error, setError] = useState('')

  // Get user's wallet address and chain ID
  const { address, chainId } = useAccount()

  // Get KLC balance (native token)
  const { data: klcBalance } = useBalance({
    address,
  })

  // Get sKLC contract hooks
  const sklc = useSKLC(chainId || 3889) // Default to testnet

  // Get sKLC balance
  const { data: sklcBalance } = sklc.useBalance(address)

  // Wrap and unwrap hooks
  const { wrap, isPending: isWrapPending, isConfirming: isWrapConfirming, isSuccess: isWrapSuccess } = sklc.useWrap()
  const { unwrap, isPending: isUnwrapPending, isConfirming: isUnwrapConfirming, isSuccess: isUnwrapSuccess } = sklc.useUnwrap()

  const isPending = isWrapPending || isUnwrapPending
  const isConfirming = isWrapConfirming || isUnwrapConfirming
  const isSuccess = isWrapSuccess || isUnwrapSuccess

  // Reset form on success
  useEffect(() => {
    if (isSuccess) {
      setAmount('')
      setError('')
    }
  }, [isSuccess])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (!address) {
      setError('Please connect your wallet')
      return
    }

    if (!amount || parseFloat(amount) <= 0) {
      setError('Please enter a valid amount')
      return
    }

    try {
      const amountWAD = parseWAD(amount)

      if (isWrapping) {
        // Check if user has enough KLC
        if (klcBalance && amountWAD > klcBalance.value) {
          setError('Insufficient KLC balance')
          return
        }
        wrap(amountWAD)
      } else {
        // Check if user has enough sKLC
        if (sklcBalance && amountWAD > sklcBalance) {
          setError('Insufficient sKLC balance')
          return
        }
        unwrap(amountWAD)
      }
    } catch (err) {
      setError('Invalid amount')
    }
  }

  const handleMaxClick = () => {
    if (isWrapping && klcBalance) {
      // Leave a small amount for gas (0.01 KLC)
      const gasReserve = parseWAD('0.01')
      const maxAmount = klcBalance.value > gasReserve ? klcBalance.value - gasReserve : 0n
      setAmount(formatWAD(maxAmount, 6))
    } else if (!isWrapping && sklcBalance) {
      setAmount(formatWAD(sklcBalance, 6))
    }
  }

  const handleAmountChange = (value: string) => {
    const formatted = formatInputValue(value, 18)
    setAmount(formatted)
    setError('')
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0a0a0a] via-[#1a0f00] to-[#0a0a0a]">
      <Navigation />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="max-w-2xl mx-auto">
          {/* Header */}
          <div className="text-center mb-8">
            <h1 className="text-4xl font-bold text-white mb-4">
              Wrap KLC to sKLC
            </h1>
            <p className="text-[#9ca3af] text-lg">
              Wrap your KLC to get sKLC for participating in KUSD auctions
            </p>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 gap-4 mb-8">
            <div className="bg-[#1a1a1a] backdrop-blur-sm border border-[#262626] rounded-xl p-6">
              <div className="text-[#6b7280] text-sm mb-1">Your KLC Balance</div>
              <div className="text-2xl font-bold text-white">
                {klcBalance ? formatWAD(klcBalance.value, 4) : '0.00'} KLC
              </div>
            </div>
            <div className="bg-[#1a1a1a] backdrop-blur-sm border border-[#262626] rounded-xl p-6">
              <div className="text-[#6b7280] text-sm mb-1">Your sKLC Balance</div>
              <div className="text-2xl font-bold text-white">
                {sklcBalance ? formatWAD(sklcBalance, 4) : '0.00'} sKLC
              </div>
            </div>
          </div>

          {/* Wrap/Unwrap Card */}
          <div className="bg-[#1a1a1a] backdrop-blur-sm border border-[#262626] rounded-2xl p-8">
            {/* Toggle */}
            <div className="flex bg-[#0a0a0a]/50 rounded-lg p-1 mb-6">
              <button
                onClick={() => setIsWrapping(true)}
                className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-colors ${
                  isWrapping
                    ? 'bg-[#F59E0B] text-white'
                    : 'text-[#6b7280] hover:text-white'
                }`}
              >
                Wrap
              </button>
              <button
                onClick={() => setIsWrapping(false)}
                className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-colors ${
                  !isWrapping
                    ? 'bg-[#F59E0B] text-white'
                    : 'text-[#6b7280] hover:text-white'
                }`}
              >
                Unwrap
              </button>
            </div>

            <form onSubmit={handleSubmit}>
              {/* Amount Input */}
              <div className="mb-6">
                <label className="block text-[#9ca3af] text-sm font-medium mb-2">
                  Amount
                </label>
                <div className="relative">
                  <input
                    type="text"
                    value={amount}
                    onChange={(e) => handleAmountChange(e.target.value)}
                    placeholder="0.0"
                    className="w-full bg-[#0a0a0a]/50 border border-[#262626] rounded-lg px-4 py-3 text-white text-lg focus:outline-none focus:ring-2 focus:ring-[#F59E0B]"
                    disabled={isPending || isConfirming}
                  />
                  <div className="absolute right-4 top-1/2 -translate-y-1/2 text-[#6b7280] font-medium">
                    {isWrapping ? 'KLC' : 'sKLC'}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleMaxClick}
                  className="mt-2 text-sm text-[#F59E0B] hover:text-[#FBBF24] disabled:opacity-50 disabled:cursor-not-allowed"
                  disabled={isPending || isConfirming || !address}
                >
                  Max
                </button>
              </div>

              {/* Info */}
              <div className="bg-[#0a0a0a]/50 border border-[#262626] rounded-lg p-4 mb-6">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-[#6b7280] text-sm">You will receive</span>
                  <span className="text-white font-medium">
                    {amount || '0.0'} {isWrapping ? 'sKLC' : 'KLC'}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-[#6b7280] text-sm">Exchange Rate</span>
                  <span className="text-white font-medium">1:1</span>
                </div>
              </div>

              {/* Error Message */}
              {error && (
                <div className="mb-4 bg-red-900/20 border border-red-500/30 rounded-lg p-4">
                  <p className="text-red-400 text-sm">{error}</p>
                </div>
              )}

              {/* Success Message */}
              {isSuccess && (
                <div className="mb-4 bg-green-900/20 border border-green-500/30 rounded-lg p-4">
                  <p className="text-green-400 text-sm">
                    ✅ {isWrapping ? 'Wrapped' : 'Unwrapped'} successfully!
                  </p>
                </div>
              )}

              {/* Submit Button */}
              <button
                type="submit"
                disabled={isPending || isConfirming || !address}
                className="w-full bg-gradient-to-r from-[#F59E0B] to-[#D97706] hover:from-[#D97706] hover:to-[#B45309] text-white font-semibold py-4 px-6 rounded-xl transition-all transform hover:scale-[1.02] disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
              >
                {!address
                  ? 'Connect Wallet'
                  : isPending
                  ? 'Confirm in Wallet...'
                  : isConfirming
                  ? 'Processing...'
                  : isWrapping
                  ? 'Wrap KLC'
                  : 'Unwrap sKLC'}
              </button>
            </form>
          </div>

          {/* Info Section */}
          <div className="mt-8 bg-orange-900/20 border border-[#F59E0B]/30 rounded-xl p-6">
            <h3 className="text-white font-semibold mb-2">About sKLC</h3>
            <p className="text-[#9ca3af] text-sm leading-relaxed">
              sKLC (Stable Kaly Coin) is a wrapped version of KLC used for participating in KUSD auctions.
              You can wrap and unwrap at any time with a 1:1 exchange rate. Your KLC is safely locked in
              the sKLC contract and can be retrieved by unwrapping.
            </p>
          </div>
        </div>
      </main>
    </div>
  )
}

