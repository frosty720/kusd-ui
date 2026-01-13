// @ts-nocheck
'use client'

import React, { useState, useEffect } from 'react'
import { useAccount } from 'wagmi'
import Image from 'next/image'
import Navigation from '@/components/Navigation'
import { useGemJoin, useTokenBalance, useTokenAllowance, useApproveToken, useSpotter, useVat, useOracle } from '@/hooks'
import { useWriteContract, useWaitForTransactionReceipt } from 'wagmi'
import ERC20ABI from '@/abis/ERC20.json'
import { formatTokenAmount, parseTokenAmount, formatInputValue, formatCurrency, formatWAD, wadToToken } from '@/lib'
import { getCollateral, type CollateralType } from '@/config/contracts'
import { type Address } from 'viem'

const collateralTypes: Array<{ type: CollateralType; symbol: string; name: string; icon: string }> = [
  { type: 'WBTC-A', symbol: 'WBTC', name: 'Wrapped Bitcoin', icon: '/icons/wbtc.svg' },
  { type: 'WETH-A', symbol: 'WETH', name: 'Wrapped Ether', icon: '/icons/weth.svg' },
  { type: 'USDT-A', symbol: 'USDT', name: 'Tether USD', icon: '/icons/usdt.svg' },
  { type: 'USDC-A', symbol: 'USDC', name: 'USD Coin', icon: '/icons/usdc.svg' },
  { type: 'DAI-A', symbol: 'DAI', name: 'Dai Stablecoin', icon: '/icons/dai.svg' },
]

export default function DepositPage() {
  const [selectedCollateralType, setSelectedCollateralType] = useState<CollateralType>('WBTC-A')
  const [amount, setAmount] = useState('')
  const [error, setError] = useState('')

  // Get user's wallet address and chain ID
  const { address, chainId } = useAccount()

  // Get selected collateral config
  const selectedCollateral = collateralTypes.find(c => c.type === selectedCollateralType)!
  const collateralConfig = getCollateral(chainId || 3889, selectedCollateralType)

  // Get token balance
  const { data: tokenBalance } = useTokenBalance(collateralConfig.token as Address, address)

  // Get token allowance for GemJoin
  const { data: allowance } = useTokenAllowance(
    collateralConfig.token as Address,
    address,
    collateralConfig.join as Address
  )

  // Get GemJoin hooks
  const gemJoin = useGemJoin(chainId || 3889, selectedCollateralType)

  // Get Vat hooks to read deposited collateral and ilk data
  const vat = useVat(chainId || 3889)
  // Read unlocked collateral (gem) - deposited but not locked in CDP
  const { data: gemBalance } = vat.useGem(collateralConfig.ilk as `0x${string}`, address)
  // Read locked collateral (ink) from user's CDP
  const { data: urnData } = vat.useUrn(collateralConfig.ilk as `0x${string}`, address)
  const lockedBalance = urnData ? (urnData as any)[0] as bigint : 0n // ink (locked collateral in WAD)
  // Total deposited = unlocked + locked
  const totalDeposited = (typeof gemBalance === 'bigint' ? gemBalance : 0n) + lockedBalance
  const { data: ilkData } = vat.useIlk(collateralConfig.ilk as `0x${string}`)

  // Get oracle price from Spotter
  const spotter = useSpotter(chainId || 3889)
  const { data: spotData } = spotter.useIlk(collateralConfig.ilk as `0x${string}`)

  // Get oracle price directly
  const oracle = useOracle(collateralConfig.oracle as `0x${string}`)
  const { data: oraclePriceData } = oracle.usePeek()

  // Approve and deposit hooks
  const { approve, isPending: isApprovePending, isConfirming: isApproveConfirming, isSuccess: isApproveSuccess } = useApproveToken()
  const { join, isPending: isDepositPending, isConfirming: isDepositConfirming, isSuccess: isDepositSuccess } = gemJoin.useJoin()

  // Exit hook to withdraw unlocked collateral
  const { exit, isPending: isExitPending, isConfirming: isExitConfirming, isSuccess: isExitSuccess } = gemJoin.useExit()

  // Frob hook to lock collateral in CDP
  const { frob, isPending: isFrobPending, isConfirming: isFrobConfirming, isSuccess: isFrobSuccess } = vat.useFrob()

  // Track the amount that was deposited for the frob call
  const [depositedAmount, setDepositedAmount] = useState<bigint | null>(null)

  // Mint test tokens hook (only for testnet)
  const { data: mintHash, writeContract: mintTokens, isPending: isMintPending, error: mintError } = useWriteContract()
  const { isLoading: isMintConfirming, isSuccess: isMintSuccess } = useWaitForTransactionReceipt({ hash: mintHash })

  const isPending = isApprovePending || isDepositPending
  const isConfirming = isApproveConfirming || isDepositConfirming
  const isSuccess = isApproveSuccess || isDepositSuccess

  // Check if approval is needed
  const needsApproval = !!(allowance !== undefined && typeof allowance === 'bigint' && amount && parseTokenAmount(amount, selectedCollateral.symbol) > allowance)

  // After join succeeds, lock the collateral in CDP with frob
  useEffect(() => {
    if (isDepositSuccess && depositedAmount && address) {
      // Convert from token decimals to WAD (18 decimals) for frob
      // The Vat stores all collateral in WAD, so dink must be in WAD
      const dinkWAD = collateralConfig.decimals === 18
        ? depositedAmount
        : depositedAmount * (10n ** BigInt(18 - collateralConfig.decimals))

      // Lock collateral in CDP: dink = deposited amount in WAD, dart = 0 (no debt change)
      frob(
        collateralConfig.ilk as `0x${string}`,
        address,
        address,
        address,
        dinkWAD, // dink - lock collateral (in WAD)
        0n // dart - no debt change
      )
    }
  }, [isDepositSuccess, depositedAmount, address, frob, collateralConfig.ilk, collateralConfig.decimals])

  // Reset form on final success
  useEffect(() => {
    if (isFrobSuccess) {
      setAmount('')
      setError('')
      setDepositedAmount(null)
    }
  }, [isFrobSuccess])

  const handleMintTestTokens = () => {
    if (!address) {
      setError('Please connect your wallet')
      return
    }

    // Mint amounts based on token decimals
    const mintAmounts: Record<string, bigint> = {
      'WBTC': 10n * 10n ** 8n,        // 10 WBTC
      'WETH': 100n * 10n ** 18n,      // 100 WETH
      'USDT': 100000n * 10n ** 6n,    // 100,000 USDT
      'USDC': 100000n * 10n ** 6n,    // 100,000 USDC
      'DAI': 100000n * 10n ** 18n,    // 100,000 DAI
    }

    const amount = mintAmounts[selectedCollateral.symbol]

    mintTokens({
      address: collateralConfig.token as Address,
      abi: ERC20ABI.abi,
      functionName: 'mint',
      args: [address, amount],
    })
  }

  const handleApprove = () => {
    if (!address) {
      setError('Please connect your wallet')
      return
    }

    // Approve max amount (infinite approval)
    const maxAmount = 2n ** 256n - 1n
    approve(collateralConfig.token as Address, collateralConfig.join as Address, maxAmount)
  }

  const handleDeposit = (e: React.FormEvent) => {
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
      const amountInTokenDecimals = parseTokenAmount(amount, selectedCollateral.symbol)

      // Check if user has enough balance
      if (tokenBalance && typeof tokenBalance === 'bigint' && amountInTokenDecimals > tokenBalance) {
        setError(`Insufficient ${selectedCollateral.symbol} balance`)
        return
      }

      // Check if approval is needed
      if (needsApproval) {
        setError('Please approve the token first')
        return
      }

      // Deposit collateral and save amount for frob
      setDepositedAmount(amountInTokenDecimals)
      join(address, amountInTokenDecimals)
    } catch (err) {
      setError('Invalid amount')
    }
  }

  const handleMaxClick = () => {
    if (tokenBalance && typeof tokenBalance === 'bigint') {
      setAmount(formatTokenAmount(tokenBalance, selectedCollateral.symbol, 6))
    }
  }

  const handleAmountChange = (value: string) => {
    const formatted = formatInputValue(value, collateralConfig.decimals)
    setAmount(formatted)
    setError('')
  }

  const handleWithdrawUnlocked = () => {
    if (!address) {
      setError('Please connect your wallet')
      return
    }

    if (!gemBalance || gemBalance === 0n) {
      setError('No unlocked collateral to withdraw')
      return
    }

    // Convert from WAD (18 decimals) to token's native decimals
    const amountInTokenDecimals = wadToToken(typeof gemBalance === 'bigint' ? gemBalance : 0n, selectedCollateral.symbol)

    console.log('Withdrawing unlocked collateral...')
    console.log('- Collateral:', selectedCollateral.symbol)
    console.log('- Amount (WAD):', gemBalance.toString())
    console.log('- Amount (token decimals):', amountInTokenDecimals.toString())
    console.log('- User address:', address)

    // Exit unlocked collateral from Vat to wallet
    exit(address, amountInTokenDecimals)
  }

  // Get oracle price (WAD - 18 decimals)
  const oraclePrice = oraclePriceData ? BigInt((oraclePriceData as any)[0]) : 0n
  const currentPrice = oraclePrice > 0n ? formatWAD(oraclePrice, 2) : '0.00'

  // Calculate USD value
  const usdValue = amount && oraclePrice > 0n ? (() => {
    const amountTokenDecimals = parseTokenAmount(amount, selectedCollateral.symbol)
    // Normalize to WAD (18 decimals) before multiplying by price
    const decimals = BigInt(collateralConfig.decimals)
    const amountWAD = collateralConfig.decimals === 18
      ? amountTokenDecimals
      : amountTokenDecimals * (10n ** (18n - decimals))
    const value = (amountWAD * oraclePrice) / 10n ** 18n // WAD * WAD / WAD = WAD
    return formatWAD(value, 2)
  })() : '0.00'

  // Render deposit display
  // @ts-ignore
  const depositDisplay: any = ((address && selectedCollateral && totalDeposited > 0n) ? (
    <div className="space-y-3" key="deposit-display">
      {/* Total Deposited */}
      <div className="flex justify-between items-center p-4 bg-[#0a0a0a]/50 rounded-lg border border-[#F59E0B]/30">
        <div className="flex items-center gap-3">
          <Image
            src={selectedCollateral.icon}
            alt={selectedCollateral.symbol}
            width={40}
            height={40}
            className="w-10 h-10"
          />
          <div>
            <div className="text-white font-medium">{selectedCollateral.symbol}</div>
            <div className="text-[#6b7280] text-sm">{selectedCollateral.name}</div>
          </div>
        </div>
        <div className="text-right">
          <div className="text-white font-medium">
            {formatWAD(totalDeposited, 6)} {selectedCollateral.symbol}
          </div>
          <div className="text-[#6b7280] text-sm">
            {currentPrice && totalDeposited > 0n ? formatCurrency(formatWAD((totalDeposited * BigInt(Math.floor(parseFloat(currentPrice) * 1e18))) / 10n ** 18n, 2)) : '$0.00'}
          </div>
        </div>
      </div>

      {/* Unlocked Collateral Warning */}
      {gemBalance && typeof gemBalance === 'bigint' && gemBalance > 0n && (
        <div className="bg-yellow-900/20 border border-yellow-800/50 rounded-lg p-4">
          <div className="flex items-start justify-between mb-3">
            <div className="flex items-start space-x-2">
              <svg className="w-5 h-5 text-yellow-500 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
              <div>
                <div className="text-yellow-500 font-medium text-sm">Unlocked Collateral</div>
                <div className="text-yellow-200/80 text-sm mt-1">
                  You have {formatWAD(gemBalance, 6)} {selectedCollateral.symbol} deposited but not locked in your CDP. Lock it to use for minting KUSD.
                </div>
              </div>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={handleWithdrawUnlocked}
              disabled={isExitPending || isExitConfirming || !address}
              className="bg-red-600 hover:bg-red-700 text-white font-semibold py-2 px-4 rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isExitPending ? 'Confirm...' :
               isExitConfirming ? 'Withdrawing...' :
               'Withdraw to Wallet'}
            </button>
            <button
              type="button"
              onClick={() => {
                if (gemBalance && address) {
                  frob(
                    collateralConfig.ilk as `0x${string}`,
                    address,
                    address,
                    address,
                    gemBalance,
                    0n
                  )
                }
              }}
              disabled={isFrobPending || isFrobConfirming || !address}
              className="bg-yellow-600 hover:bg-yellow-700 text-white font-semibold py-2 px-4 rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isFrobPending ? 'Confirm...' :
               isFrobConfirming ? 'Locking...' :
               'Lock in CDP'}
            </button>
          </div>
        </div>
      )}

      {/* Breakdown */}
      <div className="text-xs text-[#6b7280] space-y-1 px-2">
        <div className="flex justify-between">
          <span>Locked in CDP:</span>
          <span>{formatWAD(lockedBalance, 6)} {selectedCollateral.symbol}</span>
        </div>
        {gemBalance && typeof gemBalance === 'bigint' && gemBalance > 0n && (
          <div className="flex justify-between text-yellow-500">
            <span>Unlocked:</span>
            <span>{formatWAD(gemBalance, 6)} {selectedCollateral.symbol}</span>
          </div>
        )}
      </div>
    </div>
  ) : (address && totalDeposited === 0n) ? (
    <div className="text-center py-8 text-[#6b7280]">
      No deposits yet. Deposit collateral to get started!
    </div>
  ) : null) as React.ReactNode

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0a0a0a] via-[#1a0f00] to-[#0a0a0a]">
      <Navigation />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="max-w-2xl mx-auto">
          {/* Header */}
          <div className="text-center mb-8">
            <h1 className="text-4xl font-bold text-white mb-4">
              Deposit Collateral
            </h1>
            <p className="text-[#9ca3af] text-lg">
              Deposit collateral to mint KUSD stablecoins
            </p>
          </div>

          {/* Deposit Card */}
          <div className="bg-[#1a1a1a] backdrop-blur-sm border border-[#262626] rounded-2xl p-8 mb-6">
            <form onSubmit={handleDeposit}>
              {/* Collateral Selection */}
              <div className="mb-6">
                <label className="block text-[#9ca3af] text-sm font-medium mb-3">
                  Select Collateral
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {collateralTypes.map((collateral) => (
                    <button
                      key={collateral.type}
                      type="button"
                      onClick={() => setSelectedCollateralType(collateral.type)}
                      disabled={isPending || isConfirming}
                      className={`p-4 rounded-lg border-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed ${
                        selectedCollateralType === collateral.type
                          ? 'border-[#F59E0B] bg-orange-900/30'
                          : 'border-[#262626] bg-[#0a0a0a]/50 hover:border-[#404040]'
                      }`}
                    >
                      <div className="flex items-center justify-center mb-2">
                        <Image
                          src={collateral.icon}
                          alt={collateral.symbol}
                          width={32}
                          height={32}
                          className="w-8 h-8"
                        />
                      </div>
                      <div className="text-white font-bold text-lg">{collateral.symbol}</div>
                      <div className="text-[#6b7280] text-xs mt-1">{collateral.name}</div>
                    </button>
                  ))}
                </div>
              </div>

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
                    {selectedCollateral.symbol}
                  </div>
                </div>
                <div className="flex justify-between mt-2">
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={handleMaxClick}
                      className="text-sm text-[#F59E0B] hover:text-[#FBBF24] disabled:opacity-50 disabled:cursor-not-allowed"
                      disabled={isPending || isConfirming || !address}
                    >
                      Max
                    </button>
                    {/* Mint Test Tokens button - only show on testnet */}
                    {chainId === 3889 && (
                      <button
                        type="button"
                        onClick={handleMintTestTokens}
                        className="text-sm text-[#22C55E] hover:text-[#16A34A] disabled:opacity-50 disabled:cursor-not-allowed"
                        disabled={isMintPending || isMintConfirming || !address}
                      >
                        {isMintPending ? 'Confirm...' : isMintConfirming ? 'Minting...' : '🪙 Mint Test Tokens'}
                      </button>
                    )}
                  </div>
                  <span className="text-sm text-[#6b7280]">
                    Balance: {tokenBalance && typeof tokenBalance === 'bigint' ? formatTokenAmount(tokenBalance, selectedCollateral.symbol, 4) : '0.00'} {selectedCollateral.symbol}
                  </span>
                </div>
              </div>

              {/* Info */}
              <div className="bg-[#0a0a0a]/50 border border-[#262626] rounded-lg p-4 mb-6">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-[#6b7280] text-sm">Current Price</span>
                  <span className="text-white font-medium">{formatCurrency(currentPrice)}</span>
                </div>
                <div className="flex justify-between items-center mb-2">
                  <span className="text-[#6b7280] text-sm">USD Value</span>
                  <span className="text-white font-medium">{formatCurrency(usdValue)}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-[#6b7280] text-sm">New KUSD to Mint</span>
                  <span className="text-[#22C55E] font-medium">{usdValue} KUSD</span>
                </div>
              </div>

              {/* Error Message */}
              {error && (
                <div className="mb-4 bg-red-900/20 border border-red-500/30 rounded-lg p-4">
                  <p className="text-red-400 text-sm">{error}</p>
                </div>
              )}

              {/* Success Message */}
              {isApproveSuccess && (
                <div className="mb-4 bg-green-900/20 border border-green-500/30 rounded-lg p-4">
                  <p className="text-green-400 text-sm">
                    ✅ {selectedCollateral.symbol} approved successfully!
                  </p>
                </div>
              )}
              {isDepositSuccess && !isFrobSuccess && (
                <div className="mb-4 bg-green-900/20 border border-green-500/30 rounded-lg p-4">
                  <p className="text-green-400 text-sm">
                    ✅ Collateral deposited! Locking in CDP...
                  </p>
                </div>
              )}
              {isFrobSuccess && (
                <div className="mb-4 bg-green-900/20 border border-green-500/30 rounded-lg p-4">
                  <p className="text-green-400 text-sm">
                    ✅ Collateral locked in CDP successfully!
                  </p>
                </div>
              )}
              {isMintSuccess && (
                <div className="mb-4 bg-green-900/20 border border-green-500/30 rounded-lg p-4">
                  <p className="text-green-400 text-sm">
                    ✅ Test tokens minted successfully!
                  </p>
                </div>
              )}

              {/* Approve & Deposit Buttons */}
              <div className="space-y-3">
                {needsApproval && (
                  <button
                    type="button"
                    onClick={handleApprove}
                    disabled={isApprovePending || isApproveConfirming || !address}
                    className="w-full bg-[#262626] hover:bg-[#404040] text-white font-semibold py-4 px-6 rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isApprovePending
                      ? 'Confirm in Wallet...'
                      : isApproveConfirming
                      ? 'Approving...'
                      : `Approve ${selectedCollateral.symbol}`}
                  </button>
                )}
                <button
                  type="submit"
                  disabled={isPending || isConfirming || isFrobPending || isFrobConfirming || !address || needsApproval}
                  className="w-full bg-gradient-to-r from-[#F59E0B] to-[#D97706] hover:from-[#D97706] hover:to-[#B45309] text-white font-semibold py-4 px-6 rounded-xl transition-all transform hover:scale-[1.02] disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
                >
                  {!address
                    ? 'Connect Wallet'
                    : needsApproval
                    ? 'Approve First'
                    : isDepositPending
                    ? 'Confirm Deposit...'
                    : isDepositConfirming
                    ? 'Depositing...'
                    : isFrobPending
                    ? 'Confirm Lock...'
                    : isFrobConfirming
                    ? 'Locking in CDP...'
                    : 'Deposit Collateral'}
                </button>
              </div>
            </form>
          </div>

          {/* Your Deposits */}
          <div className="bg-[#1a1a1a] backdrop-blur-sm border border-[#262626] rounded-2xl p-8">
            <h2 className="text-xl font-bold text-white mb-4">Your Deposits</h2>
            {depositDisplay}
          </div>
        </div>
      </main>
    </div>
  )
}

