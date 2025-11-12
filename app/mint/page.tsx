'use client'

import { useState, useEffect, useRef } from 'react'
import { useAccount } from 'wagmi'
import Image from 'next/image'
import Navigation from '@/components/Navigation'
import { useVat, useKusdJoin, useSpotter, useOracle, useJug } from '@/hooks'
import { formatWAD, formatRAD, formatRAY, parseWAD, formatInputValue, formatCurrency, radToWad } from '@/lib'
import { getCollateral, getContracts, type CollateralType } from '@/config/contracts'
import { type Address } from 'viem'

const collateralTypes: Array<{ type: CollateralType; symbol: string; name: string; icon: string }> = [
  { type: 'WBTC-A', symbol: 'WBTC', name: 'Wrapped Bitcoin', icon: '/icons/wbtc.svg' },
  { type: 'WETH-A', symbol: 'WETH', name: 'Wrapped Ether', icon: '/icons/weth.svg' },
  { type: 'USDT-A', symbol: 'USDT', name: 'Tether USD', icon: '/icons/usdt.svg' },
  { type: 'USDC-A', symbol: 'USDC', name: 'USD Coin', icon: '/icons/usdc.svg' },
  { type: 'DAI-A', symbol: 'DAI', name: 'Dai Stablecoin', icon: '/icons/dai.svg' },
]

export default function MintPage() {
  const [selectedCollateralType, setSelectedCollateralType] = useState<CollateralType>('WBTC-A')
  const [amount, setAmount] = useState('')
  const [error, setError] = useState('')
  const exitInitiatedRef = useRef(false)

  const { address, chainId } = useAccount()
  const selectedCollateral = collateralTypes.find(c => c.type === selectedCollateralType)!
  const collateralConfig = getCollateral(chainId || 3889, selectedCollateralType)
  const contracts = getContracts(chainId || 3889)

  // Get contract hooks
  const vat = useVat(chainId || 3889)
  const kusdJoin = useKusdJoin(chainId || 3889)
  const spotter = useSpotter(chainId || 3889)
  const oracle = useOracle(collateralConfig.oracle as `0x${string}`)
  const jug = useJug(chainId || 3889)

  // Get user's CDP (urn) data
  const { data: urnData } = vat.useUrn(collateralConfig.ilk as `0x${string}`, address)

  // Get unlocked collateral (gem)
  const { data: gemBalance } = vat.useGem(collateralConfig.ilk as `0x${string}`, address)

  // Get ilk data (Art, rate, spot, line, dust)
  const { data: ilkData } = vat.useIlk(collateralConfig.ilk as `0x${string}`)

  // Get spotter data (pip, mat)
  const { data: spotterData } = spotter.useIlk(collateralConfig.ilk as `0x${string}`)

  // Get user's internal KUSD balance
  const { data: internalKusd } = vat.useKusd(address)

  // Get oracle price
  const { data: oraclePriceData } = oracle.usePeek()

  // Get stability fee (duty) from Jug
  const { data: jugIlkData } = jug.useIlk(collateralConfig.ilk as `0x${string}`)

  // Frob hook for minting KUSD
  const { frob, isPending, isConfirming, isSuccess, error: frobError } = vat.useFrob()

  // Exit hook for withdrawing KUSD
  const { exit, isPending: isExitPending, isConfirming: isExitConfirming, isSuccess: isExitSuccess, error: exitError } = kusdJoin.useExit()

  // Hope hook for granting permission to KusdJoin
  const { hope, isPending: isHopePending, isConfirming: isHopeConfirming, isSuccess: isHopeSuccess } = vat.useHope()

  // Check if KusdJoin has permission to move user's KUSD
  const { data: canExit } = vat.useCan(address, contracts.core.kusdJoin)

  // Reset form on mint success
  useEffect(() => {
    if (isSuccess) {
      setAmount('')
      setError('')
    }
  }, [isSuccess])

  // Calculate values
  const ink = urnData ? (urnData as any)[0] as bigint : 0n // Locked collateral (WAD)
  const art = urnData ? (urnData as any)[1] as bigint : 0n // Normalized debt (WAD)
  const rate = ilkData ? (ilkData as any)[1] as bigint : 10n ** 27n // Accumulated rate (RAY)
  const spot = ilkData ? (ilkData as any)[2] as bigint : 0n // Spot price with safety margin (RAY)
  const dust = ilkData ? (ilkData as any)[4] as bigint : 0n // Minimum debt (RAD)
  const mat = spotterData ? (spotterData as any)[1] as bigint : 0n // Liquidation ratio (RAY)

  // Get oracle price (WAD - 18 decimals)
  const oraclePrice = oraclePriceData ? BigInt((oraclePriceData as any)[0]) : 0n

  // Calculate total collateral value in USD (WAD)
  // collateralValue = ink (WAD) * oraclePrice (WAD) / 10^18
  const collateralValue = ink && oraclePrice ? (ink * oraclePrice) / 10n ** 18n : 0n

  // Calculate current debt in KUSD (WAD)
  const currentDebt = art && rate ? (art * rate) / 10n ** 27n : 0n

  // Calculate available KUSD to mint (WAD)
  // Max debt = collateral_value * (10^27 / mat) where mat is liquidation ratio in RAY
  // Available = max_debt - current_debt
  const maxDebt = mat > 0n ? (collateralValue * 10n ** 27n) / mat : 0n
  const availableToMint = maxDebt > currentDebt ? maxDebt - currentDebt : 0n

  // Calculate collateral ratio
  // Ratio = (collateral_value / debt) * 100
  const collateralRatio = currentDebt > 0n
    ? Number((collateralValue * 10000n) / currentDebt) / 100
    : Infinity

  // Calculate new collateral ratio after minting
  const newDebt = amount ? currentDebt + parseWAD(amount) : currentDebt
  const newCollateralRatio = newDebt > 0n
    ? Number((collateralValue * 10000n) / newDebt) / 100
    : Infinity

  // Calculate liquidation price
  // Liquidation price = (debt * mat) / collateral
  const liquidationPrice = ink > 0n && mat > 0n && currentDebt > 0n
    ? formatWAD((currentDebt * mat) / (ink * 10n ** 9n), 2) // Convert from RAY to WAD
    : '0.00'

  // Calculate stability fee (annual rate) from Jug duty
  // duty is the per-second interest rate in RAY format
  // APR = ((duty / 1e27) ^ seconds_per_year - 1) * 100
  const duty = jugIlkData ? (jugIlkData as any)[0] as bigint : 10n ** 27n // Per-second rate (RAY)

  const stabilityFee = duty > 10n ** 27n
    ? (() => {
        // Calculate APR using compound interest formula
        // For small rates, we can approximate: APR ≈ (duty - 1e27) / 1e27 * seconds_per_year * 100
        const perSecondRate = duty - 10n ** 27n
        const annualRate = (perSecondRate * 31536000n * 100n) / 10n ** 27n
        return Number(annualRate) / 100
      })()
    : 0

  // Get minimum collateral ratio for the selected collateral type
  const minCollateralRatio = mat > 0n ? Number(mat) / 1e25 : 150 // Convert from RAY to percentage

  // Helper function to get collateral ratio status
  const getCollateralRatioStatus = (ratio: number) => {
    if (ratio === Infinity) return { label: 'No Debt', color: 'text-[#22C55E]', emoji: '✅' }
    if (ratio >= minCollateralRatio * 3) return { label: 'Extremely Safe', color: 'text-[#22C55E]', emoji: '🟢' }
    if (ratio >= minCollateralRatio * 2) return { label: 'Very Safe', color: 'text-[#22C55E]', emoji: '🟢' }
    if (ratio >= minCollateralRatio * 1.5) return { label: 'Safe', color: 'text-[#22C55E]', emoji: '🟢' }
    if (ratio >= minCollateralRatio) return { label: 'Risky', color: 'text-yellow-500', emoji: '⚠️' }
    return { label: 'Liquidation Risk', color: 'text-red-500', emoji: '🔴' }
  }

  const currentRatioStatus = getCollateralRatioStatus(collateralRatio)
  const newRatioStatus = getCollateralRatioStatus(newCollateralRatio)

  const handleMaxClick = () => {
    if (availableToMint > 0n) {
      // Leave a small buffer to account for rounding
      const maxAmount = (availableToMint * 99n) / 100n
      setAmount(formatWAD(maxAmount, 2))
    }
  }

  const handleMint = async (e: React.FormEvent) => {
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

      if (amountWAD > availableToMint) {
        setError('Amount exceeds available KUSD to mint')
        return
      }

      // Check minimum debt requirement (dust)
      const newDebtRAD = (art + amountWAD) * rate
      if (newDebtRAD < dust && newDebtRAD > 0n) {
        setError(`Minimum debt is ${formatRAD(dust, 2)} KUSD`)
        return
      }

      // Step 1: Call frob to mint KUSD (increases art)
      // dink = 0 (no collateral change)
      // dart = normalized debt increase (amountWAD / rate, but rate is in RAY so we need to scale)
      // dart = (amountWAD * 10^27) / rate
      const dartNormalized = (amountWAD * 10n ** 27n) / rate

      frob(
        collateralConfig.ilk as `0x${string}`,
        address,
        address,
        address,
        0n, // dink
        dartNormalized // dart (normalized debt)
      )
    } catch (err) {
      setError('Invalid amount')
    }
  }

  // Check if permission is needed for exit
  const needsPermission = canExit !== undefined && canExit === 0n && internalKusd && internalKusd > 0n

  // Handle granting permission to KusdJoin
  const handleGrantPermission = () => {
    if (!address) return
    hope(contracts.core.kusdJoin)
  }

  // Handle manual exit of KUSD from Vat to wallet
  const handleExitKusd = () => {
    if (internalKusd && internalKusd > 0n && address) {
      // Convert from RAD to WAD using proper conversion (handles rounding)
      const kusdWAD = radToWad(internalKusd)
      console.log('Withdrawing KUSD from Vat to wallet...')
      console.log('- Internal KUSD (RAD):', internalKusd.toString())
      console.log('- Amount to withdraw (WAD):', kusdWAD.toString())
      console.log('- User address:', address)
      exit(address, kusdWAD)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0a0a0a] via-[#1a0f00] to-[#0a0a0a]">
      <Navigation />
      
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="max-w-2xl mx-auto">
          {/* Header */}
          <div className="text-center mb-8">
            <h1 className="text-4xl font-bold text-white mb-4">
              Mint KUSD
            </h1>
            <p className="text-[#9ca3af] text-lg">
              Mint KUSD stablecoins against your deposited collateral
            </p>
          </div>

          {/* Collateral Selection */}
          <div className="mb-8">
            <label className="block text-[#9ca3af] text-sm font-medium mb-3">
              Select Collateral Type
            </label>
            <div className="grid grid-cols-5 gap-3">
              {collateralTypes.map((collateral) => (
                <button
                  key={collateral.type}
                  type="button"
                  onClick={() => setSelectedCollateralType(collateral.type)}
                  className={`bg-[#1a1a1a] border-2 rounded-xl p-4 transition-all hover:border-[#F59E0B]/50 ${
                    selectedCollateralType === collateral.type
                      ? 'border-[#F59E0B]'
                      : 'border-[#262626]'
                  }`}
                >
                  <div className="flex flex-col items-center space-y-2">
                    <Image
                      src={collateral.icon}
                      alt={collateral.symbol}
                      width={32}
                      height={32}
                      className="w-8 h-8"
                    />
                    <span className="text-white font-medium text-sm">{collateral.symbol}</span>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Unlocked Collateral Warning */}
          {gemBalance !== undefined && gemBalance > 0n && (
            <div className="bg-yellow-900/20 border border-yellow-800/50 rounded-xl p-6 mb-8">
              <div className="flex items-start space-x-3">
                <svg className="w-6 h-6 text-yellow-500 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                </svg>
                <div className="flex-1">
                  <div className="text-yellow-500 font-semibold text-lg mb-2">Unlocked Collateral Detected</div>
                  <div className="text-yellow-200/90 text-sm mb-4">
                    You have <span className="font-semibold">{formatWAD(gemBalance, 6)} {selectedCollateral.symbol}</span> deposited but not locked in your CDP.
                    You need to lock it before you can mint KUSD against it.
                  </div>
                  <a
                    href="/deposit"
                    className="inline-block bg-yellow-600 hover:bg-yellow-700 text-white font-semibold py-2 px-6 rounded-lg transition-all"
                  >
                    Go to Deposit Page to Lock Collateral
                  </a>
                </div>
              </div>
            </div>
          )}

          {/* Stats */}
          <div className="grid grid-cols-3 gap-4 mb-8">
            <div className="bg-[#1a1a1a] backdrop-blur-sm border border-[#262626] rounded-xl p-6">
              <div className="text-[#6b7280] text-sm mb-1">Locked Collateral</div>
              <div className="text-2xl font-bold text-white">
                {formatCurrency(formatWAD(collateralValue, 2))}
              </div>
              <div className="text-[#6b7280] text-xs mt-1">
                {formatWAD(ink, 6)} {selectedCollateral.symbol}
              </div>
            </div>
            <div className="bg-[#1a1a1a] backdrop-blur-sm border border-[#262626] rounded-xl p-6">
              <div className="text-[#6b7280] text-sm mb-1">KUSD Minted</div>
              <div className="text-2xl font-bold text-white">
                {formatWAD(currentDebt, 2)}
              </div>
              <div className="text-[#6b7280] text-xs mt-1">
                Current Debt
              </div>
            </div>
            <div className="bg-[#1a1a1a] backdrop-blur-sm border border-[#262626] rounded-xl p-6">
              <div className="text-[#6b7280] text-sm mb-1">Coll. Ratio</div>
              <div className={`text-2xl font-bold ${
                collateralRatio === Infinity ? 'text-[#22C55E]' :
                collateralRatio >= 200 ? 'text-[#22C55E]' :
                collateralRatio >= 150 ? 'text-yellow-500' :
                'text-red-500'
              }`}>
                {collateralRatio === Infinity ? '∞%' : `${collateralRatio.toFixed(0)}%`}
              </div>
              <div className="text-[#6b7280] text-xs mt-1">
                Min: 150%
              </div>
            </div>
          </div>

          {/* Mint Card */}
          <div className="bg-[#1a1a1a] backdrop-blur-sm border border-[#262626] rounded-2xl p-8 mb-6">
            <form onSubmit={handleMint}>
              {/* Error Message */}
              {error && (
                <div className="mb-4 bg-red-900/20 border border-red-500/30 rounded-lg p-4">
                  <p className="text-red-400 text-sm">⚠️ {error}</p>
                </div>
              )}

              {/* Success Message */}
              {isSuccess && (
                <div className="mb-4 bg-green-900/20 border border-green-500/30 rounded-lg p-4">
                  <p className="text-green-400 text-sm">
                    ✅ KUSD minted successfully!
                  </p>
                </div>
              )}
              {isExitSuccess && (
                <div className="mb-4 bg-green-900/20 border border-green-500/30 rounded-lg p-4">
                  <p className="text-green-400 text-sm">
                    ✅ KUSD withdrawn to your wallet!
                  </p>
                </div>
              )}

              {/* Amount Input */}
              <div className="mb-6">
                <label className="block text-[#9ca3af] text-sm font-medium mb-2">
                  Amount to Mint
                </label>
                <div className="relative">
                  <input
                    type="text"
                    value={amount}
                    onChange={(e) => setAmount(formatInputValue(e.target.value))}
                    placeholder="0.0"
                    className="w-full bg-[#0a0a0a]/50 border border-[#262626] rounded-lg px-4 py-3 text-white text-lg focus:outline-none focus:ring-2 focus:ring-[#F59E0B]"
                    disabled={isPending || isConfirming || isExitPending || isExitConfirming}
                  />
                  <div className="absolute right-4 top-1/2 -translate-y-1/2 text-[#6b7280] font-medium">
                    KUSD
                  </div>
                </div>
                <div className="flex justify-between mt-2">
                  <button
                    type="button"
                    onClick={handleMaxClick}
                    className="text-sm text-[#F59E0B] hover:text-[#FBBF24] disabled:opacity-50 disabled:cursor-not-allowed"
                    disabled={isPending || isConfirming || isExitPending || isExitConfirming || !address}
                  >
                    Max Available
                  </button>
                  <span className="text-sm text-[#6b7280]">
                    USD Value: {amount ? formatCurrency(amount) : '$0.00'}
                  </span>
                </div>
              </div>

              {/* Info */}
              <div className="bg-[#0a0a0a]/50 border border-[#262626] rounded-lg p-4 mb-6 space-y-3">
                <div className="flex justify-between items-center pb-2 border-b border-[#262626]">
                  <span className="text-[#6b7280] text-sm">Available to Mint</span>
                  <div className="text-right">
                    <div className="text-white font-medium">{formatWAD(availableToMint, 2)} KUSD</div>
                    <div className="text-[#6b7280] text-xs">{formatCurrency(formatWAD(availableToMint, 2))}</div>
                  </div>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-[#6b7280] text-sm">Current Collateral Ratio</span>
                  <div className="text-right">
                    <div className={`font-medium ${currentRatioStatus.color}`}>
                      {collateralRatio === Infinity ? '∞%' : `${collateralRatio.toFixed(0)}%`}
                    </div>
                    <div className="text-xs text-[#6b7280]">
                      {currentRatioStatus.emoji} {currentRatioStatus.label} (Min: {minCollateralRatio.toFixed(0)}%)
                    </div>
                  </div>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-[#6b7280] text-sm">New Collateral Ratio</span>
                  <div className="text-right">
                    <div className={`font-medium ${newRatioStatus.color}`}>
                      {newCollateralRatio === Infinity ? '∞%' : `${newCollateralRatio.toFixed(0)}%`}
                    </div>
                    <div className="text-xs text-[#6b7280]">
                      {newRatioStatus.emoji} {newRatioStatus.label} (Min: {minCollateralRatio.toFixed(0)}%)
                    </div>
                  </div>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-[#6b7280] text-sm">Liquidation Price</span>
                  <span className="text-white font-medium">${liquidationPrice}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-[#6b7280] text-sm">Stability Fee (APR)</span>
                  <span className="text-white font-medium">{stabilityFee.toFixed(2)}%</span>
                </div>
                <div className="flex justify-between items-center pt-2 border-t border-[#262626]">
                  <span className="text-[#6b7280] text-sm">Collateral Value</span>
                  <div className="text-right">
                    <div className="text-white font-medium">{formatCurrency(formatWAD(collateralValue, 2))}</div>
                    <div className="text-[#6b7280] text-xs">{formatWAD(ink, 6)} {selectedCollateral.symbol}</div>
                  </div>
                </div>
              </div>

              {/* Warning */}
              {newCollateralRatio < minCollateralRatio * 2 && newCollateralRatio !== Infinity && (
                <div className={`${
                  newCollateralRatio < minCollateralRatio
                    ? 'bg-red-900/20 border-red-800/50'
                    : 'bg-yellow-900/20 border-yellow-800/50'
                } border rounded-lg p-4 mb-6`}>
                  <div className="flex items-start space-x-2">
                    <svg className={`w-5 h-5 ${
                      newCollateralRatio < minCollateralRatio ? 'text-red-500' : 'text-yellow-500'
                    } mt-0.5`} fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                    </svg>
                    <div>
                      <div className={`${
                        newCollateralRatio < minCollateralRatio ? 'text-red-500' : 'text-yellow-500'
                      } font-medium text-sm`}>
                        {newCollateralRatio < minCollateralRatio ? 'Liquidation Risk!' : 'Low Collateral Ratio Warning'}
                      </div>
                      <div className={`${
                        newCollateralRatio < minCollateralRatio ? 'text-red-200/80' : 'text-yellow-200/80'
                      } text-sm mt-1`}>
                        Your new collateral ratio will be {newCollateralRatio.toFixed(0)}%. Keep it above {minCollateralRatio.toFixed(0)}% to avoid liquidation. Recommended: {(minCollateralRatio * 2).toFixed(0)}%+
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* No Collateral Warning */}
              {ink === 0n && (
                <div className="bg-orange-900/20 border border-[#F59E0B]/30 rounded-lg p-4 mb-6">
                  <div className="flex items-start space-x-2">
                    <svg className="w-5 h-5 text-[#F59E0B] mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                    </svg>
                    <div>
                      <div className="text-[#F59E0B] font-medium text-sm">No Collateral Deposited</div>
                      <div className="text-[#F59E0B]/80 text-sm mt-1">
                        You need to deposit {selectedCollateral.symbol} collateral first before minting KUSD. Go to the Deposit page.
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Submit Button */}
              <button
                type="submit"
                disabled={isPending || isConfirming || !address || ink === 0n}
                className="w-full bg-gradient-to-r from-[#F59E0B] to-[#D97706] hover:from-[#D97706] hover:to-[#B45309] text-white font-semibold py-4 px-6 rounded-xl transition-all transform hover:scale-[1.02] disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
              >
                {isPending ? 'Confirm in Wallet...' :
                 isConfirming ? 'Minting KUSD...' :
                 !address ? 'Connect Wallet' :
                 ink === 0n ? 'Deposit Collateral First' :
                 'Mint KUSD'}
              </button>
            </form>
          </div>

          {/* Withdraw KUSD from Vat */}
          {internalKusd && internalKusd > 0n && (
            <div className="bg-yellow-900/20 border border-yellow-500/30 rounded-2xl p-6 mb-6">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h3 className="text-white font-semibold text-lg mb-1">
                    💰 KUSD in Vat
                  </h3>
                  <p className="text-[#9ca3af] text-sm">
                    You have {formatWAD(internalKusd / 10n ** 27n, 2)} KUSD in the Vat that needs to be withdrawn to your wallet
                  </p>
                </div>
              </div>

              {/* Success Message for Permission */}
              {isHopeSuccess && (
                <div className="mb-4 bg-green-900/20 border border-green-500/30 rounded-lg p-4">
                  <p className="text-green-400 text-sm">
                    ✅ Permission granted successfully!
                  </p>
                </div>
              )}

              {exitError && (
                <div className="mb-4 bg-red-900/20 border border-red-500/30 rounded-lg p-4">
                  <p className="text-red-400 text-sm">
                    ❌ Error: {exitError.message}
                  </p>
                </div>
              )}

              {/* Grant Permission & Withdraw Buttons */}
              <div className="space-y-3">
                {needsPermission && (
                  <button
                    type="button"
                    onClick={handleGrantPermission}
                    disabled={isHopePending || isHopeConfirming || !address}
                    className="w-full bg-[#262626] hover:bg-[#404040] text-white font-semibold py-3 px-6 rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isHopePending ? 'Confirm in Wallet...' :
                     isHopeConfirming ? 'Granting Permission...' :
                     'Grant Permission to KusdJoin'}
                  </button>
                )}
                <button
                  type="button"
                  onClick={handleExitKusd}
                  disabled={isExitPending || isExitConfirming || !address || needsPermission}
                  className="w-full bg-gradient-to-r from-yellow-500 to-yellow-600 hover:from-yellow-600 hover:to-yellow-700 text-white font-semibold py-3 px-6 rounded-xl transition-all transform hover:scale-[1.02] disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
                >
                  {!address ? 'Connect Wallet' :
                   needsPermission ? 'Grant Permission First' :
                   isExitPending ? 'Confirm in Wallet...' :
                   isExitConfirming ? 'Withdrawing...' :
                   'Withdraw to Wallet'}
                </button>
              </div>
            </div>
          )}

          {/* Info Section */}
          <div className="bg-orange-900/20 border border-[#F59E0B]/30 rounded-xl p-6">
            <h3 className="text-white font-semibold mb-2">How Minting Works</h3>
            <ul className="text-[#9ca3af] text-sm space-y-2">
              <li className="flex items-start">
                <span className="text-[#F59E0B] mr-2">•</span>
                <span>Deposit collateral first before minting KUSD</span>
              </li>
              <li className="flex items-start">
                <span className="text-[#F59E0B] mr-2">•</span>
                <span>Maintain a healthy collateral ratio to avoid liquidation</span>
              </li>
              <li className="flex items-start">
                <span className="text-[#F59E0B] mr-2">•</span>
                <span>Stability fees accrue over time on your minted KUSD</span>
              </li>
              <li className="flex items-start">
                <span className="text-[#F59E0B] mr-2">•</span>
                <span>You can repay KUSD at any time to unlock your collateral</span>
              </li>
            </ul>
          </div>
        </div>
      </main>
    </div>
  )
}

