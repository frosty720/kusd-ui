'use client'

import { useState, useEffect } from 'react'
import { useAccount } from 'wagmi'
import Image from 'next/image'
import Navigation from '@/components/Navigation'
import { useVat, useKusdJoin, useSpotter, useOracle, useJug, useTokenBalance, useTokenAllowance, useApproveToken } from '@/hooks'
import { formatWAD, formatRAD, parseWAD, formatCurrency } from '@/lib'
import { getCollateral, getContracts, type CollateralType } from '@/config/contracts'
import { type Address } from 'viem'

const collateralTypes: Array<{ type: CollateralType; symbol: string; name: string; icon: string }> = [
  { type: 'WBTC-A', symbol: 'WBTC', name: 'Wrapped Bitcoin', icon: '/icons/wbtc.svg' },
  { type: 'WETH-A', symbol: 'WETH', name: 'Wrapped Ether', icon: '/icons/weth.svg' },
  { type: 'USDT-A', symbol: 'USDT', name: 'Tether USD', icon: '/icons/usdt.svg' },
  { type: 'USDC-A', symbol: 'USDC', name: 'USD Coin', icon: '/icons/usdc.svg' },
  { type: 'DAI-A', symbol: 'DAI', name: 'Dai Stablecoin', icon: '/icons/dai.svg' },
]

export default function BorrowPage() {
  const [selectedCollateralType, setSelectedCollateralType] = useState<CollateralType>('WBTC-A')
  const [repayAmount, setRepayAmount] = useState('')
  const [withdrawAmount, setWithdrawAmount] = useState('')
  const [error, setError] = useState('')
  const [repayStep, setRepayStep] = useState<'idle' | 'joining' | 'frobbing'>('idle')

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

  // Get ilk data (Art, rate, spot, line, dust)
  const { data: ilkData } = vat.useIlk(collateralConfig.ilk as `0x${string}`)

  // Get spotter data (pip, mat)
  const { data: spotterData } = spotter.useIlk(collateralConfig.ilk as `0x${string}`)

  // Get oracle price
  const { data: oraclePriceData } = oracle.usePeek()

  // Get stability fee (duty) from Jug
  const { data: jugIlkData } = jug.useIlk(collateralConfig.ilk as `0x${string}`)

  // Get KUSD balance (ERC20 in wallet)
  const { data: kusdBalance } = useTokenBalance(contracts.core.kusd as `0x${string}`, address)

  // Get KUSD allowance for KusdJoin
  const { data: kusdAllowance } = useTokenAllowance(contracts.core.kusd as `0x${string}`, address, contracts.core.kusdJoin as `0x${string}`)

  // Get internal KUSD balance in Vat (RAD format)
  const { data: internalKusdRAD } = vat.useKusd(address)
  const internalKusd = internalKusdRAD ? (internalKusdRAD as bigint) / 10n ** 27n : 0n // Convert RAD to WAD

  // Approve hook for KUSD
  const { approve, isPending: isApprovePending, isConfirming: isApproveConfirming, isSuccess: isApproveSuccess } = useApproveToken()

  // Frob hook for repaying/withdrawing
  const { frob, isPending: isFrobPending, isConfirming: isFrobConfirming, isSuccess: isFrobSuccess } = vat.useFrob()

  // Join hook for depositing KUSD back to Vat
  const { join, isPending: isJoinPending, isConfirming: isJoinConfirming, isSuccess: isJoinSuccess } = kusdJoin.useJoin()

  // Calculate values
  const ink = urnData ? (urnData as any)[0] as bigint : 0n // Locked collateral (WAD)
  const art = urnData ? (urnData as any)[1] as bigint : 0n // Normalized debt (WAD)
  const rate = ilkData ? (ilkData as any)[1] as bigint : 10n ** 27n // Accumulated rate (RAY)
  const mat = spotterData ? (spotterData as any)[1] as bigint : 0n // Liquidation ratio (RAY)

  // Get oracle price
  const oraclePrice = oraclePriceData ? BigInt((oraclePriceData as any)[0]) : 0n

  // Calculate collateral value in USD
  const collateralValue = ink && oraclePrice ? (ink * oraclePrice) / 10n ** 18n : 0n

  // Calculate current debt (art * rate)
  const currentDebt = art * rate / 10n ** 27n // Convert from RAD to WAD

  // Check if approval is needed for repaying
  const needsApproval = !!(kusdAllowance !== undefined && typeof kusdAllowance === 'bigint' && repayAmount && parseWAD(repayAmount) > kusdAllowance)

  const handleApprove = () => {
    if (!address) {
      setError('Please connect your wallet')
      return
    }

    // Approve max amount (infinite approval)
    const maxAmount = 2n ** 256n - 1n
    approve(contracts.core.kusd as Address, contracts.core.kusdJoin as Address, maxAmount)
  }

  const handleRepay = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (!address) {
      setError('Please connect your wallet')
      return
    }

    if (!repayAmount || parseFloat(repayAmount) <= 0) {
      setError('Please enter a valid amount')
      return
    }

    try {
      const amountWAD = parseWAD(repayAmount)

      if (amountWAD > (typeof kusdBalance === 'bigint' ? kusdBalance : 0n)) {
        setError('Insufficient KUSD balance')
        return
      }

      if (amountWAD > currentDebt) {
        setError('Amount exceeds current debt')
        return
      }

      // Check if approval is needed
      if (needsApproval) {
        setError('Please approve KUSD first')
        return
      }

      // Start the two-step process
      // Step 1: Join KUSD to Vat (deposit KUSD from wallet to internal balance)
      setRepayStep('joining')
      join(address, amountWAD)

      // Step 2 will be handled in useEffect when join succeeds
    } catch (err) {
      console.error('Repay error:', err)
      setError('Transaction failed. Please try again.')
      setRepayStep('idle')
    }
  }

  const handleWithdraw = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (!address) {
      setError('Please connect your wallet')
      return
    }

    if (!withdrawAmount || parseFloat(withdrawAmount) <= 0) {
      setError('Please enter a valid amount')
      return
    }

    try {
      const amountWAD = parseWAD(withdrawAmount)

      if (amountWAD > maxWithdrawable) {
        setError('Amount exceeds maximum withdrawable collateral')
        return
      }

      // Check if withdrawal would put position at risk
      if (newCollateralRatioAfterWithdraw < minCollateralRatio && newCollateralRatioAfterWithdraw !== Infinity) {
        setError('Withdrawal would put your position at risk of liquidation')
        return
      }

      // Call frob to unlock collateral
      // dink = -amountWAD (negative to unlock collateral)
      // dart = 0 (no debt change)
      // This will move collateral from urn (locked) to gem (unlocked)
      // User can then withdraw it using the deposit page
      await frob(
        collateralConfig.ilk as `0x${string}`,
        address,
        address,
        address,
        -amountWAD, // dink (negative to unlock)
        0n // dart
      )
    } catch (err) {
      console.error('Withdraw error:', err)
      setError('Transaction failed. Please try again.')
    }
  }

  // Handle two-step repay process
  useEffect(() => {
    if (repayStep === 'joining' && isJoinSuccess) {
      // Join succeeded, now call frob to reduce debt
      setRepayStep('frobbing')

      const amountWAD = parseWAD(repayAmount)
      const dartNormalized = (amountWAD * 10n ** 27n) / rate

      frob(
        collateralConfig.ilk as `0x${string}`,
        address!,
        address!,
        address!,
        0n, // dink
        -dartNormalized // dart (negative to reduce debt)
      )
    }
  }, [repayStep, isJoinSuccess, repayAmount, rate, collateralConfig.ilk, address, frob])

  // Reset form on success
  useEffect(() => {
    if (isFrobSuccess && repayStep === 'frobbing') {
      setRepayAmount('')
      setWithdrawAmount('')
      setError('')
      setRepayStep('idle')
    }
  }, [isFrobSuccess, repayStep])

  // Calculate collateral ratio
  const collateralRatio = currentDebt > 0n
    ? Number((collateralValue * 10000n) / currentDebt) / 100
    : Infinity

  // Calculate liquidation price
  const liquidationPrice = ink > 0n && mat > 0n && currentDebt > 0n
    ? formatWAD((currentDebt * mat) / (ink * 10n ** 9n), 2)
    : '0.00'

  // Calculate stability fee
  const duty = jugIlkData ? (jugIlkData as any)[0] as bigint : 10n ** 27n
  const stabilityFee = duty > 10n ** 27n
    ? (() => {
        const perSecondRate = duty - 10n ** 27n
        const annualRate = (perSecondRate * 31536000n * 100n) / 10n ** 27n
        return Number(annualRate) / 100
      })()
    : 0

  // Calculate accrued fees (current debt - original debt)
  const originalDebt = art // Normalized debt
  const accruedFees = currentDebt - originalDebt

  // Get minimum collateral ratio
  const minCollateralRatio = mat > 0n ? Number(mat) / 1e25 : 150

  // Calculate new values after repay
  const repayAmountWAD = repayAmount ? parseWAD(repayAmount) : 0n
  const newDebtAfterRepay = currentDebt > repayAmountWAD ? currentDebt - repayAmountWAD : 0n
  const newCollateralRatioAfterRepay = newDebtAfterRepay > 0n
    ? Number((collateralValue * 10000n) / newDebtAfterRepay) / 100
    : Infinity

  // Calculate max withdrawable collateral
  // Min collateral needed = (debt * mat) / price
  // debt is WAD, mat is RAY, price is WAD
  // Result should be in WAD (collateral units)
  const minCollateralNeeded = currentDebt > 0n && oraclePrice > 0n && mat > 0n
    ? (currentDebt * mat) / (oraclePrice * 10n ** 9n) // Divide by 10^9 to convert RAY to WAD ratio
    : 0n
  const maxWithdrawable = ink > minCollateralNeeded ? ink - minCollateralNeeded : 0n

  // Calculate new values after withdraw
  const withdrawAmountWAD = withdrawAmount ? parseWAD(withdrawAmount) : 0n
  const newInkAfterWithdraw = ink > withdrawAmountWAD ? ink - withdrawAmountWAD : 0n
  const newCollateralValueAfterWithdraw = newInkAfterWithdraw && oraclePrice
    ? (newInkAfterWithdraw * oraclePrice) / 10n ** 18n
    : 0n
  const newCollateralRatioAfterWithdraw = currentDebt > 0n
    ? Number((newCollateralValueAfterWithdraw * 10000n) / currentDebt) / 100
    : Infinity

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0a0a0a] via-[#1a0f00] to-[#0a0a0a]">
      <Navigation />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="max-w-4xl mx-auto">
          {/* Header */}
          <div className="text-center mb-8">
            <h1 className="text-4xl font-bold text-white mb-4">
              Manage Your Position
            </h1>
            <p className="text-[#9ca3af] text-lg">
              View and manage your collateralized debt position (CDP)
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
                  className={`bg-[#1a1a1a] border-2 rounded-xl p-4 transition-all hover:border-[#22C55E]/50 ${
                    selectedCollateralType === collateral.type
                      ? 'border-[#22C55E]'
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

          {/* Position Overview */}
          <div className="bg-[#1a1a1a] backdrop-blur-sm border border-[#262626] rounded-2xl p-8 mb-8">
            <h2 className="text-xl font-bold text-white mb-6">Position Overview - {selectedCollateral.symbol}</h2>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
              <div className="bg-[#0a0a0a]/50 rounded-lg p-4">
                <div className="text-[#6b7280] text-sm mb-1">Total Collateral</div>
                <div className="text-xl font-bold text-white">{formatCurrency(formatWAD(collateralValue, 2))}</div>
                <div className="text-[#6b7280] text-xs mt-1">{formatWAD(ink, 6)} {selectedCollateral.symbol}</div>
              </div>
              <div className="bg-[#0a0a0a]/50 rounded-lg p-4">
                <div className="text-[#6b7280] text-sm mb-1">KUSD Debt</div>
                <div className="text-xl font-bold text-white">{formatWAD(currentDebt, 2)}</div>
                <div className="text-[#6b7280] text-xs mt-1">Current Debt</div>
              </div>
              <div className="bg-[#0a0a0a]/50 rounded-lg p-4">
                <div className="text-[#6b7280] text-sm mb-1">Coll. Ratio</div>
                <div className={`text-xl font-bold ${
                  collateralRatio === Infinity ? 'text-[#22C55E]' :
                  collateralRatio >= minCollateralRatio * 2 ? 'text-[#22C55E]' :
                  collateralRatio >= minCollateralRatio ? 'text-yellow-500' :
                  'text-red-500'
                }`}>
                  {collateralRatio === Infinity ? '∞%' : `${collateralRatio.toFixed(0)}%`}
                </div>
                <div className="text-[#6b7280] text-xs mt-1">Min: {minCollateralRatio.toFixed(0)}%</div>
              </div>
              <div className="bg-[#0a0a0a]/50 rounded-lg p-4">
                <div className="text-[#6b7280] text-sm mb-1">Max Withdraw</div>
                <div className="text-xl font-bold text-white">{formatWAD(maxWithdrawable, 6)}</div>
                <div className="text-[#6b7280] text-xs mt-1">{selectedCollateral.symbol}</div>
              </div>
            </div>

            {/* Collateral Ratio Bar */}
            <div className="mb-4">
              <div className="flex justify-between text-sm mb-2">
                <span className="text-[#6b7280]">Collateral Ratio</span>
                <span className={`font-medium ${
                  collateralRatio === Infinity ? 'text-[#22C55E]' :
                  collateralRatio >= minCollateralRatio * 2 ? 'text-[#22C55E]' :
                  collateralRatio >= minCollateralRatio ? 'text-yellow-500' :
                  'text-red-500'
                }`}>
                  {collateralRatio === Infinity ? 'No Debt' :
                   collateralRatio >= minCollateralRatio * 2 ? 'Safe' :
                   collateralRatio >= minCollateralRatio ? 'Risky' :
                   'Liquidation Risk'}
                </span>
              </div>
              <div className="h-3 bg-[#0a0a0a]/50 rounded-full overflow-hidden">
                <div
                  className={`h-full ${
                    collateralRatio === Infinity ? 'bg-gradient-to-r from-[#22C55E] to-[#10B981]' :
                    collateralRatio >= minCollateralRatio * 2 ? 'bg-gradient-to-r from-[#22C55E] to-[#10B981]' :
                    collateralRatio >= minCollateralRatio ? 'bg-gradient-to-r from-yellow-500 to-yellow-600' :
                    'bg-gradient-to-r from-red-500 to-red-600'
                  }`}
                  style={{
                    width: collateralRatio === Infinity ? '100%' :
                           `${Math.min(100, (collateralRatio / (minCollateralRatio * 3)) * 100)}%`
                  }}
                ></div>
              </div>
              <div className="flex justify-between text-xs text-[#6b7280] mt-1">
                <span>Liquidation ({minCollateralRatio.toFixed(0)}%)</span>
                <span>Safe ({(minCollateralRatio * 2).toFixed(0)}%+)</span>
              </div>
            </div>

            {/* Detailed Breakdown */}
            <div className="bg-[#0a0a0a]/50 border border-[#262626] rounded-lg p-4 space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-[#6b7280] text-sm">Liquidation Price</span>
                <span className="text-white font-medium">${liquidationPrice}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-[#6b7280] text-sm">Stability Fee (Annual)</span>
                <span className="text-white font-medium">{stabilityFee.toFixed(2)}%</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-[#6b7280] text-sm">Accrued Fees</span>
                <span className="text-white font-medium">{formatWAD(accruedFees, 2)} KUSD</span>
              </div>
            </div>
          </div>

          {/* Error Message */}
          {error && (
            <div className="mb-6 bg-red-900/20 border border-red-500/30 rounded-lg p-4">
              <p className="text-red-400 text-sm">⚠️ {error}</p>
            </div>
          )}

          {/* Actions */}
          <div className="grid md:grid-cols-2 gap-6">
            {/* Repay KUSD */}
            <div className="bg-[#1a1a1a] backdrop-blur-sm border border-[#262626] rounded-2xl p-8">
              <h2 className="text-xl font-bold text-white mb-6">Repay KUSD</h2>

              <form onSubmit={handleRepay}>
                <div className="mb-6">
                  <label className="block text-[#9ca3af] text-sm font-medium mb-2">
                    Amount to Repay
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      value={repayAmount}
                      onChange={(e) => setRepayAmount(e.target.value)}
                      placeholder="0.0"
                      className="w-full bg-[#0a0a0a]/50 border border-[#262626] rounded-lg px-4 py-3 text-white text-lg focus:outline-none focus:ring-2 focus:ring-[#22C55E]"
                    />
                    <div className="absolute right-4 top-1/2 -translate-y-1/2 text-[#6b7280] font-medium">
                      KUSD
                    </div>
                  </div>
                  <div className="flex justify-between mt-2">
                    <button
                      type="button"
                      onClick={() => setRepayAmount(formatWAD(currentDebt, 18))}
                      className="text-sm text-[#22C55E] hover:text-[#10B981]"
                    >
                      Max
                    </button>
                    <div className="text-right">
                      <div className="text-sm text-[#6b7280]">
                        Wallet: {formatWAD(typeof kusdBalance === 'bigint' ? kusdBalance : 0n, 2)} KUSD
                      </div>
                      {internalKusd > 0n && (
                        <div className="text-xs text-yellow-400">
                          In Vat: {formatWAD(internalKusd, 2)} KUSD (needs exit)
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                <div className="bg-[#0a0a0a]/50 border border-[#262626] rounded-lg p-4 mb-6">
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-[#6b7280] text-sm">Remaining Debt</span>
                    <span className="text-white font-medium">{formatWAD(newDebtAfterRepay, 2)} KUSD</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-[#6b7280] text-sm">New Coll. Ratio</span>
                    <span className={`font-medium ${
                      newCollateralRatioAfterRepay === Infinity ? 'text-[#22C55E]' :
                      newCollateralRatioAfterRepay >= minCollateralRatio * 2 ? 'text-[#22C55E]' :
                      newCollateralRatioAfterRepay >= minCollateralRatio ? 'text-yellow-500' :
                      'text-red-500'
                    }`}>
                      {newCollateralRatioAfterRepay === Infinity ? '∞%' : `${newCollateralRatioAfterRepay.toFixed(0)}%`}
                    </span>
                  </div>
                </div>

                {/* Approval Success Message */}
                {isApproveSuccess && (
                  <div className="mb-4 bg-green-900/20 border border-green-500/30 rounded-lg p-4">
                    <p className="text-green-400 text-sm">
                      ✅ KUSD approved successfully!
                    </p>
                  </div>
                )}

                {/* Approve & Repay Buttons */}
                <div className="space-y-3">
                  {needsApproval && (
                    <button
                      type="button"
                      onClick={handleApprove}
                      disabled={isApprovePending || isApproveConfirming || !address}
                      className="w-full bg-[#262626] hover:bg-[#404040] text-white font-semibold py-4 px-6 rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {isApprovePending ? 'Confirm in Wallet...' :
                       isApproveConfirming ? 'Approving...' :
                       'Approve KUSD'}
                    </button>
                  )}
                  <button
                    type="submit"
                    disabled={repayStep !== 'idle' || isJoinPending || isJoinConfirming || isFrobPending || isFrobConfirming || !address || currentDebt === 0n || needsApproval}
                    className="w-full bg-gradient-to-r from-[#22C55E] to-[#10B981] hover:from-[#10B981] hover:to-[#059669] text-white font-semibold py-4 px-6 rounded-xl transition-all transform hover:scale-[1.02] disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
                  >
                    {repayStep === 'joining' && (isJoinPending || isJoinConfirming) ? 'Depositing KUSD...' :
                     repayStep === 'frobbing' && (isFrobPending || isFrobConfirming) ? 'Reducing Debt...' :
                     isJoinPending || isFrobPending ? 'Confirm in Wallet...' :
                     !address ? 'Connect Wallet' :
                     needsApproval ? 'Approve First' :
                     currentDebt === 0n ? 'No Debt to Repay' :
                     'Repay KUSD'}
                  </button>
                </div>
                {repayStep !== 'idle' && (
                  <p className="text-xs text-[#6b7280] mt-2 text-center">
                    {repayStep === 'joining' ? 'Step 1/2: Depositing KUSD to Vat...' : 'Step 2/2: Reducing debt...'}
                  </p>
                )}
              </form>
            </div>

            {/* Withdraw Collateral */}
            <div className="bg-[#1a1a1a] backdrop-blur-sm border border-[#262626] rounded-2xl p-8">
              <h2 className="text-xl font-bold text-white mb-6">Withdraw Collateral</h2>

              <form onSubmit={handleWithdraw}>
                <div className="mb-6">
                  <label className="block text-[#9ca3af] text-sm font-medium mb-2">
                    Amount to Withdraw
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      value={withdrawAmount}
                      onChange={(e) => setWithdrawAmount(e.target.value)}
                      placeholder="0.0"
                      className="w-full bg-[#0a0a0a]/50 border border-[#262626] rounded-lg px-4 py-3 text-white text-lg focus:outline-none focus:ring-2 focus:ring-[#F59E0B]"
                    />
                    <div className="absolute right-4 top-1/2 -translate-y-1/2 text-[#6b7280] font-medium">
                      {selectedCollateral.symbol}
                    </div>
                  </div>
                  <div className="flex justify-between mt-2">
                    <button
                      type="button"
                      onClick={() => setWithdrawAmount(formatWAD(maxWithdrawable, 18))}
                      className="text-sm text-[#F59E0B] hover:text-[#FBBF24]"
                    >
                      Max Available
                    </button>
                    <span className="text-sm text-[#6b7280]">
                      Available: {formatWAD(maxWithdrawable, 6)} {selectedCollateral.symbol}
                    </span>
                  </div>
                </div>

                <div className="bg-[#0a0a0a]/50 border border-[#262626] rounded-lg p-4 mb-6">
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-[#6b7280] text-sm">Remaining Collateral</span>
                    <span className="text-white font-medium">{formatCurrency(formatWAD(newCollateralValueAfterWithdraw, 2))}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-[#6b7280] text-sm">New Coll. Ratio</span>
                    <span className={`font-medium ${
                      newCollateralRatioAfterWithdraw === Infinity ? 'text-[#22C55E]' :
                      newCollateralRatioAfterWithdraw >= minCollateralRatio * 2 ? 'text-[#22C55E]' :
                      newCollateralRatioAfterWithdraw >= minCollateralRatio ? 'text-yellow-500' :
                      'text-red-500'
                    }`}>
                      {newCollateralRatioAfterWithdraw === Infinity ? '∞%' : `${newCollateralRatioAfterWithdraw.toFixed(0)}%`}
                    </span>
                  </div>
                </div>

                {/* Warning if new ratio is below safe threshold */}
                {newCollateralRatioAfterWithdraw < minCollateralRatio * 2 && newCollateralRatioAfterWithdraw !== Infinity && (
                  <div className={`${
                    newCollateralRatioAfterWithdraw < minCollateralRatio
                      ? 'bg-red-900/20 border-red-800/50'
                      : 'bg-yellow-900/20 border-yellow-800/50'
                  } border rounded-lg p-3 mb-4`}>
                    <p className={`text-sm ${
                      newCollateralRatioAfterWithdraw < minCollateralRatio ? 'text-red-400' : 'text-yellow-400'
                    }`}>
                      ⚠️ {newCollateralRatioAfterWithdraw < minCollateralRatio
                        ? 'Warning: This will put you at risk of liquidation!'
                        : 'Warning: Low collateral ratio after withdrawal'}
                    </p>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={isFrobPending || isFrobConfirming || !address || ink === 0n || maxWithdrawable === 0n}
                  className="w-full bg-gradient-to-r from-[#F59E0B] to-[#D97706] hover:from-[#D97706] hover:to-[#B45309] text-white font-semibold py-4 px-6 rounded-xl transition-all transform hover:scale-[1.02] disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
                >
                  {isFrobPending ? 'Confirm in Wallet...' :
                   isFrobConfirming ? 'Withdrawing...' :
                   !address ? 'Connect Wallet' :
                   ink === 0n ? 'No Collateral Locked' :
                   maxWithdrawable === 0n ? 'No Collateral Available' :
                   'Unlock Collateral'}
                </button>
                <p className="text-xs text-[#6b7280] mt-2 text-center">
                  Unlocked collateral will be available to withdraw on the Deposit page
                </p>
              </form>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}

