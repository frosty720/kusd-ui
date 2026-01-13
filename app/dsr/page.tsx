// @ts-nocheck
'use client'

import { useState, useEffect } from 'react'
import { useAccount } from 'wagmi'
import Navigation from '@/components/Navigation'
import { usePot, useVat, useKusdJoin, useTokenBalance, useTokenAllowance, useApproveToken, useDSProxy } from '@/hooks'
import { formatWAD, formatRAY, parseWAD, formatCurrency } from '@/lib'
import { getContracts } from '@/config/contracts'
import { type Address, formatUnits } from 'viem'

export default function DSRPage() {
  const [depositAmount, setDepositAmount] = useState('')
  const [withdrawAmount, setWithdrawAmount] = useState('')
  const [error, setError] = useState('')
  const [depositStep, setDepositStep] = useState<'idle' | 'buildingProxy' | 'approving' | 'depositing'>('idle')

  const { address, chainId } = useAccount()
  const contracts = getContracts(chainId || 3889)

  // Get contract hooks
  const pot = usePot(chainId || 3889)
  const vat = useVat(chainId || 3889)
  const kusdJoin = useKusdJoin(chainId || 3889)
  const dsProxy = useDSProxy(chainId || 3889)

  // Check if user has a proxy
  const { data: userProxyAddress, refetch: refetchProxy } = dsProxy.useHasProxy(address)
  const hasProxy = userProxyAddress &&
    userProxyAddress !== '0x0000000000000000000000000000000000000000' &&
    userProxyAddress !== '0x0'
  const proxyAddress = hasProxy ? (userProxyAddress as Address) : undefined

  // Debug logging
  useEffect(() => {
    if (address) {
      console.log('User address:', address)
      console.log('Proxy address from contract:', userProxyAddress)
      console.log('Has proxy:', hasProxy)
      console.log('Proxy address (computed):', proxyAddress)
    }
  }, [address, userProxyAddress, hasProxy, proxyAddress])

  // Get KUSD balance (ERC20 in wallet)
  const { data: kusdBalance } = useTokenBalance(contracts.core.kusd as `0x${string}`, address)

  // Get KUSD allowance - now for the user's proxy instead of KusdJoin
  const { data: kusdAllowance, refetch: refetchKusdAllowance } = useTokenAllowance(
    contracts.core.kusd as `0x${string}`,
    address,
    proxyAddress || contracts.core.kusdJoin as `0x${string}` // Fallback to kusdJoin if no proxy yet
  )

  // Get internal KUSD balance in Vat (RAD format)
  const { data: internalKusdRAD } = vat.useKusd(address)
  const internalKusd = internalKusdRAD ? (internalKusdRAD as bigint) / 10n ** 27n : 0n // Convert RAD to WAD

  // Get user's DSR deposit (pie) - check proxy's pie, not user's
  const { data: userPie } = pot.usePie(proxyAddress || address)

  // Get total DSR deposits (Pie)
  const { data: totalPie } = pot.useTotalPie()

  // Get DSR accumulator (chi)
  const { data: chi } = pot.useChi()

  // Get DSR rate (dsr)
  const { data: dsrRate } = pot.useDsr()

  // Approve hook for KUSD (approve proxy to spend user's KUSD)
  const { approve, isPending: isApprovePending, isConfirming: isApproveConfirming, isSuccess: isApproveSuccess } = useApproveToken()

  // KusdJoin exit hook for withdrawing KUSD from Vat to wallet (for withdrawals)
  const { exit: kusdJoinExit, isPending: isKusdJoinExitPending, isConfirming: isKusdJoinExitConfirming, isSuccess: isKusdJoinExitSuccess } = kusdJoin.useExit()

  // Calculate values
  const userPieAmount = userPie ? (userPie as bigint) : 0n
  const totalPieAmount = totalPie ? (totalPie as bigint) : 0n
  const chiValue = chi ? (chi as bigint) : 10n ** 27n // Default to 1 RAY
  const dsrRateValue = dsrRate ? (dsrRate as bigint) : 10n ** 27n // Default to 1 RAY (0% APR)

  // Calculate user's KUSD in DSR (pie * chi)
  const userKusdInDSR = (userPieAmount * chiValue) / 10n ** 27n // WAD

  // Calculate total KUSD in Pot
  const totalKusdInPot = (totalPieAmount * chiValue) / 10n ** 27n // WAD

  // Calculate user's share of the Pot
  const userShare = totalPieAmount > 0n ? Number((userPieAmount * 10000n) / totalPieAmount) / 100 : 0

  // NOTE: Earned interest cannot be calculated accurately on-chain.
  // The Pot contract only stores 'pie' (share count), not the original KUSD deposited.
  // To calculate real earnings, we would need: originalDeposit = pie * chi_at_deposit_time
  // Since chi_at_deposit_time is not stored, we cannot determine actual earnings.
  // We set this to 0 to avoid showing inaccurate/misleading numbers.
  const earnedInterest = 0n // Not calculable without deposit history

  // Convert DSR rate to APY percentage
  // DSR is in RAY format (10^27), where 1.0 = 10^27
  // APY = (rate^seconds_per_year - 1) * 100
  const SECONDS_PER_YEAR = 31536000
  const dsrAPR = dsrRateValue > 10n ** 27n
    ? (Math.pow(Number(dsrRateValue) / Number(10n ** 27n), SECONDS_PER_YEAR) - 1) * 100
    : 0

  // Check if approval is needed for depositing (approve proxy to spend KUSD)
  const needsApproval = hasProxy && kusdAllowance !== undefined && typeof kusdAllowance === 'bigint' && depositAmount && parseWAD(depositAmount) > kusdAllowance

  const handleBuildProxy = () => {
    if (!address) {
      setError('Please connect your wallet')
      return
    }
    setDepositStep('buildingProxy')
    dsProxy.buildProxy()
  }

  const handleApprove = () => {
    if (!address || !proxyAddress) {
      setError('Please connect your wallet and deploy proxy first')
      return
    }

    console.log('Approving KUSD for proxy...')
    console.log('KUSD address:', contracts.core.kusd)
    console.log('Proxy address:', proxyAddress)
    console.log('User address:', address)

    setDepositStep('approving')
    setError('')
    // Approve proxy to spend user's KUSD (infinite approval)
    const maxAmount = 2n ** 256n - 1n
    approve(contracts.core.kusd as Address, proxyAddress, maxAmount)
  }

  const handleDeposit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (!address) {
      setError('Please connect your wallet')
      return
    }

    if (!hasProxy) {
      setError('Please deploy your proxy first')
      return
    }

    if (!proxyAddress) {
      setError('Proxy address not found')
      return
    }

    if (!depositAmount || parseFloat(depositAmount) <= 0) {
      setError('Please enter a valid amount')
      return
    }

    try {
      const amountWAD = parseWAD(depositAmount)

      console.log('Deposit details:')
      console.log('- Amount:', depositAmount, 'KUSD')
      console.log('- Amount (WAD):', amountWAD.toString())
      console.log('- KUSD balance:', kusdBalance?.toString())
      console.log('- Proxy address:', proxyAddress)
      console.log('- Needs approval:', needsApproval)

      if (amountWAD > (typeof kusdBalance === 'bigint' ? kusdBalance : 0n)) {
        setError('Insufficient KUSD balance')
        return
      }

      // Check if approval is needed
      if (needsApproval) {
        setError('Please approve KUSD first')
        return
      }

      // Execute deposit via DSProxy
      // This will call KssProxyActions.join() which does:
      // 1. Transfer KUSD from user to proxy
      // 2. Join KUSD to Vat
      // 3. Call pot.drip()
      // 4. Call pot.join()
      // All in one transaction via DELEGATECALL
      console.log('Encoding join action...')
      const joinAction = dsProxy.encodeJoinAction(amountWAD)
      console.log('Join action encoded:', joinAction)

      console.log('Executing action via proxy...')
      setDepositStep('depositing')
      dsProxy.executeAction(proxyAddress, joinAction)
      console.log('Execute action called')
    } catch (err) {
      console.error('Deposit error:', err)
      setError(`Transaction failed: ${err instanceof Error ? err.message : 'Unknown error'}`)
      setDepositStep('idle')
    }
  }

  const handleWithdraw = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (!address || !proxyAddress) {
      setError('Please connect your wallet')
      return
    }

    if (!withdrawAmount || parseFloat(withdrawAmount) <= 0) {
      setError('Please enter a valid amount')
      return
    }

    try {
      const amountWAD = parseWAD(withdrawAmount)

      if (amountWAD > userKusdInDSR) {
        setError('Amount exceeds your DSR deposit')
        return
      }

      console.log('Withdrawing from DSR via DSProxy...')
      console.log('- Amount:', withdrawAmount, 'KUSD')
      console.log('- Amount (WAD):', amountWAD.toString())
      console.log('- Proxy address:', proxyAddress)

      // Execute withdrawal via DSProxy
      // This will call KssProxyActions.exit() which does:
      // 1. Call pot.drip() to update chi
      // 2. Calculate pie amount from wad
      // 3. Call pot.exit(pie) to withdraw from DSR
      // 4. Call kusdJoin.exit() to move KUSD from Vat to user's wallet
      const exitAction = dsProxy.encodeExitAction(amountWAD)
      console.log('Exit action encoded:', exitAction)

      dsProxy.executeAction(proxyAddress, exitAction)
      console.log('Withdraw transaction submitted')
    } catch (err) {
      console.error('Withdraw error:', err)
      setError(`Transaction failed: ${err instanceof Error ? err.message : 'Unknown error'}`)
    }
  }

  const handleWithdrawAll = () => {
    if (!address || !proxyAddress) {
      setError('Please connect your wallet')
      return
    }

    if (userPieAmount === 0n) {
      setError('No DSR deposit to withdraw')
      return
    }

    try {
      console.log('Withdrawing all from DSR via DSProxy...')
      console.log('- User pie amount:', userPieAmount.toString())
      console.log('- Proxy address:', proxyAddress)

      // Execute withdraw all via DSProxy
      // This will call KssProxyActions.exitAll() which does:
      // 1. Call pot.drip() to update chi
      // 2. Get user's total pie amount
      // 3. Call pot.exit(pie) to withdraw all from DSR
      // 4. Call kusdJoin.exit() to move all KUSD from Vat to user's wallet
      const exitAllAction = dsProxy.encodeExitAllAction()
      console.log('Exit all action encoded:', exitAllAction)

      dsProxy.executeAction(proxyAddress, exitAllAction)
      console.log('Withdraw all transaction submitted')
    } catch (err) {
      console.error('Withdraw all error:', err)
      setError(`Transaction failed: ${err instanceof Error ? err.message : 'Unknown error'}`)
    }
  }

  // Reset form on proxy build success and refetch proxy address
  useEffect(() => {
    if (dsProxy.isSuccess && depositStep === 'buildingProxy') {
      setDepositStep('idle')
      setError('')
      // Wait a bit for the transaction to be mined and indexed, then refetch
      setTimeout(() => {
        refetchProxy()
      }, 3000)
    }
  }, [dsProxy.isSuccess, depositStep, refetchProxy])

  // Reset form on approval success
  useEffect(() => {
    if (isApproveSuccess && depositStep === 'approving') {
      setDepositStep('idle')
      setError('')
      // Wait a bit for the transaction to be mined and indexed
      setTimeout(() => {
        refetchKusdAllowance()
      }, 2000)
    }
  }, [isApproveSuccess, depositStep, refetchKusdAllowance])

  // Reset form on deposit success
  useEffect(() => {
    if (dsProxy.isSuccess && depositStep === 'depositing') {
      setDepositAmount('')
      setError('')
      setDepositStep('idle')
    }
  }, [dsProxy.isSuccess, depositStep])

  // Reset form on withdraw success
  useEffect(() => {
    if (dsProxy.isSuccess && (depositStep === 'idle' && withdrawAmount)) {
      setWithdrawAmount('')
      setError('')
    }
  }, [dsProxy.isSuccess, depositStep, withdrawAmount])

  // Handle dsProxy errors
  useEffect(() => {
    if (dsProxy.error) {
      console.error('DSProxy error:', dsProxy.error)
      const errorMessage = dsProxy.error.message || 'Unknown error'
      // Check if it's the KalyChain RPC error
      if (errorMessage.includes('Internal JSON-RPC error')) {
        setError('KalyChain RPC error - please wait a few seconds and try again')
      } else {
        setError(`Transaction failed: ${errorMessage}`)
      }
      setDepositStep('idle')
    }
  }, [dsProxy.error])

  // Reset form on withdraw success
  useEffect(() => {
    if (dsProxy.isSuccess && withdrawAmount) {
      setWithdrawAmount('')
      setError('')
    }
  }, [dsProxy.isSuccess, withdrawAmount])

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0a0a0a] via-[#1a0f00] to-[#0a0a0a]">
      <Navigation />
      
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="max-w-4xl mx-auto">
          {/* Header */}
          <div className="text-center mb-8">
            <h1 className="text-4xl font-bold text-white mb-4">
              KUSD Savings Rate
            </h1>
            <p className="text-[#9ca3af] text-lg">
              Earn passive income by depositing KUSD into the Pot
            </p>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            <div className="bg-[#1a1a1a] backdrop-blur-sm border border-[#262626] rounded-xl p-6">
              <div className="text-[#6b7280] text-sm mb-1">Current DSR</div>
              <div className="text-3xl font-bold text-[#22C55E]">{dsrAPR.toFixed(2)}%</div>
              <div className="text-[#6b7280] text-xs mt-1">Annual Percentage Rate</div>
            </div>
            <div className="bg-[#1a1a1a] backdrop-blur-sm border border-[#262626] rounded-xl p-6">
              <div className="text-[#6b7280] text-sm mb-1">Your Deposit</div>
              <div className="text-3xl font-bold text-white">{formatWAD(userKusdInDSR, 2)}</div>
              <div className="text-[#6b7280] text-xs mt-1">KUSD</div>
            </div>
            <div className="bg-[#1a1a1a] backdrop-blur-sm border border-[#262626] rounded-xl p-6">
              <div className="text-[#6b7280] text-sm mb-1">Current APY</div>
              <div className="text-3xl font-bold text-[#FBBF24]">{dsrAPR.toFixed(2)}%</div>
              <div className="text-[#6b7280] text-xs mt-1">Annual Rate</div>
            </div>
          </div>

          {/* Total in Pot */}
          <div className="bg-gradient-to-r from-orange-900/30 to-amber-900/30 border border-[#F59E0B]/30 rounded-xl p-6 mb-8">
            <div className="flex justify-between items-center">
              <div>
                <div className="text-[#6b7280] text-sm mb-1">Total KUSD in Pot</div>
                <div className="text-2xl font-bold text-white">{formatWAD(totalKusdInPot, 2)} KUSD</div>
              </div>
              <div className="text-right">
                <div className="text-[#6b7280] text-sm mb-1">Your Share</div>
                <div className="text-2xl font-bold text-[#FBBF24]">{userShare.toFixed(2)}%</div>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="grid md:grid-cols-2 gap-6 mb-8">
            {/* Deposit */}
            <div className="bg-[#1a1a1a] backdrop-blur-sm border border-[#262626] rounded-2xl p-8">
              <h2 className="text-xl font-bold text-white mb-6">Deposit KUSD</h2>

              <form onSubmit={handleDeposit}>
                <div className="mb-6">
                  <label className="block text-[#9ca3af] text-sm font-medium mb-2">
                    Amount to Deposit
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      step="0.01"
                      value={depositAmount}
                      onChange={(e) => setDepositAmount(e.target.value)}
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
                      onClick={() => {
                        // Use formatUnits to avoid precision loss
                        const maxAmount = formatUnits(typeof kusdBalance === 'bigint' ? kusdBalance : 0n, 18)
                        setDepositAmount(maxAmount)
                      }}
                      className="text-sm text-[#22C55E] hover:text-[#10B981]"
                    >
                      Max
                    </button>
                    <span className="text-sm text-[#6b7280]">
                      Balance: {formatWAD(typeof kusdBalance === 'bigint' ? kusdBalance : 0n, 2)} KUSD
                    </span>
                  </div>
                </div>

                {error && (
                  <div className="mb-4 bg-red-900/20 border border-red-500/30 rounded-lg p-4">
                    <p className="text-red-400 text-sm">❌ {error}</p>
                  </div>
                )}

                {/* Proxy Status */}
                {!hasProxy && (
                  <div className="mb-4 bg-blue-900/20 border border-blue-500/30 rounded-lg p-4">
                    <p className="text-blue-400 text-sm">ℹ️ You need to deploy a proxy contract first</p>
                  </div>
                )}

                {hasProxy && proxyAddress && (
                  <div className="mb-4 bg-green-900/20 border border-green-500/30 rounded-lg p-4">
                    <p className="text-green-400 text-sm">✅ Proxy deployed: {proxyAddress.slice(0, 6)}...{proxyAddress.slice(-4)}</p>
                  </div>
                )}

                {isApproveSuccess && (
                  <div className="mb-4 bg-green-900/20 border border-green-500/30 rounded-lg p-4">
                    <p className="text-green-400 text-sm">✅ KUSD approved successfully!</p>
                  </div>
                )}

                {dsProxy.isSuccess && depositStep === 'buildingProxy' && (
                  <div className="mb-4 bg-green-900/20 border border-green-500/30 rounded-lg p-4">
                    <p className="text-green-400 text-sm">✅ Proxy deployed successfully!</p>
                  </div>
                )}

                <div className="bg-[#0a0a0a]/50 border border-[#262626] rounded-lg p-4 mb-6">
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-[#6b7280] text-sm">Estimated Annual Earnings</span>
                    <span className="text-white font-medium">
                      {depositAmount ? formatWAD(parseWAD(depositAmount) * BigInt(Math.floor(dsrAPR * 100)) / 10000n, 2) : '0.00'} KUSD
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-[#6b7280] text-sm">New Total Deposit</span>
                    <span className="text-white font-medium">
                      {depositAmount ? formatWAD(userKusdInDSR + parseWAD(depositAmount), 2) : formatWAD(userKusdInDSR, 2)} KUSD
                    </span>
                  </div>
                </div>

                {/* Build Proxy, Approve & Deposit Buttons */}
                <div className="space-y-3">
                  {!hasProxy && (
                    <button
                      type="button"
                      onClick={handleBuildProxy}
                      disabled={dsProxy.isPending || dsProxy.isConfirming || !address}
                      className="w-full bg-[#262626] hover:bg-[#404040] text-white font-semibold py-4 px-6 rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {dsProxy.isPending ? 'Confirm in Wallet...' :
                       dsProxy.isConfirming ? 'Deploying Proxy...' :
                       'Deploy Proxy Contract'}
                    </button>
                  )}
                  {hasProxy && needsApproval && (
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
                  {hasProxy && (
                    <button
                      type="submit"
                      disabled={depositStep !== 'idle' || dsProxy.isPending || dsProxy.isConfirming || !address || needsApproval}
                      className="w-full bg-gradient-to-r from-[#22C55E] to-[#10B981] hover:from-[#10B981] hover:to-[#059669] text-white font-semibold py-4 px-6 rounded-xl transition-all transform hover:scale-[1.02] disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
                    >
                      {depositStep === 'depositing' && (dsProxy.isPending || dsProxy.isConfirming) ? 'Depositing to DSR...' :
                       !address ? 'Connect Wallet' :
                       needsApproval ? 'Approve First' :
                       'Deposit to DSR'}
                    </button>
                  )}
                </div>
                {depositStep !== 'idle' && (
                  <p className="text-xs text-[#6b7280] mt-2 text-center">
                    {depositStep === 'buildingProxy' ? 'Deploying your proxy contract...' :
                     depositStep === 'approving' ? 'Approving KUSD...' :
                     'Depositing to DSR (drip + join in one tx)...'}
                  </p>
                )}
              </form>
            </div>

            {/* Withdraw */}
            <div className="bg-[#1a1a1a] backdrop-blur-sm border border-[#262626] rounded-2xl p-8">
              <h2 className="text-xl font-bold text-white mb-6">Withdraw KUSD</h2>

              <form onSubmit={handleWithdraw}>
                <div className="mb-6">
                  <label className="block text-[#9ca3af] text-sm font-medium mb-2">
                    Amount to Withdraw
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      step="0.01"
                      value={withdrawAmount}
                      onChange={(e) => setWithdrawAmount(e.target.value)}
                      placeholder="0.0"
                      className="w-full bg-[#0a0a0a]/50 border border-[#262626] rounded-lg px-4 py-3 text-white text-lg focus:outline-none focus:ring-2 focus:ring-[#F59E0B]"
                    />
                    <div className="absolute right-4 top-1/2 -translate-y-1/2 text-[#6b7280] font-medium">
                      KUSD
                    </div>
                  </div>
                  <div className="flex justify-between mt-2">
                    <button
                      type="button"
                      onClick={() => setWithdrawAmount(formatWAD(userKusdInDSR, 18))}
                      className="text-sm text-[#F59E0B] hover:text-[#FBBF24]"
                    >
                      Max
                    </button>
                    <span className="text-sm text-[#6b7280]">
                      Deposited: {formatWAD(userKusdInDSR, 2)} KUSD
                    </span>
                  </div>
                </div>

                <div className="bg-[#0a0a0a]/50 border border-[#262626] rounded-lg p-4 mb-6">
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-[#6b7280] text-sm">Current Balance</span>
                    <span className="text-white font-medium">{formatWAD(userKusdInDSR, 2)} KUSD</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-[#6b7280] text-sm">You Will Receive (to Vat)</span>
                    <span className="text-white font-medium">
                      {withdrawAmount || '0.00'} KUSD
                    </span>
                  </div>
                </div>

                <div className="space-y-3">
                  <button
                    type="submit"
                    disabled={dsProxy.isPending || dsProxy.isConfirming || !address || !hasProxy || userPieAmount === 0n}
                    className="w-full bg-gradient-to-r from-[#F59E0B] to-[#D97706] hover:from-[#D97706] hover:to-[#B45309] text-white font-semibold py-4 px-6 rounded-xl transition-all transform hover:scale-[1.02] disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
                  >
                    {dsProxy.isPending ? 'Confirm in Wallet...' :
                     dsProxy.isConfirming ? 'Withdrawing...' :
                     !address ? 'Connect Wallet' :
                     !hasProxy ? 'Deploy Proxy First' :
                     userPieAmount === 0n ? 'No Deposit to Withdraw' :
                     'Withdraw from DSR'}
                  </button>
                  <button
                    type="button"
                    onClick={handleWithdrawAll}
                    disabled={dsProxy.isPending || dsProxy.isConfirming || !address || !hasProxy || userPieAmount === 0n}
                    className="w-full bg-[#262626] hover:bg-[#404040] text-white font-semibold py-4 px-6 rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {dsProxy.isPending ? 'Confirm in Wallet...' :
                     dsProxy.isConfirming ? 'Withdrawing All...' :
                     'Withdraw All'}
                  </button>
                </div>
              </form>
            </div>
          </div>

          {/* Info Section */}
          <div className="bg-orange-900/20 border border-[#F59E0B]/30 rounded-xl p-6">
            <h3 className="text-white font-semibold mb-3">How DSR Works</h3>
            <ul className="text-[#9ca3af] text-sm space-y-2">
              <li className="flex items-start">
                <span className="text-[#F59E0B] mr-2">•</span>
                <span>Deposit KUSD into the Pot to earn the KUSD Savings Rate (DSR)</span>
              </li>
              <li className="flex items-start">
                <span className="text-[#F59E0B] mr-2">•</span>
                <span>Interest accrues continuously and compounds automatically</span>
              </li>
              <li className="flex items-start">
                <span className="text-[#F59E0B] mr-2">•</span>
                <span>Withdraw your KUSD plus earned interest at any time</span>
              </li>
              <li className="flex items-start">
                <span className="text-[#F59E0B] mr-2">•</span>
                <span>The DSR is set by KUSD governance and can change over time</span>
              </li>
              <li className="flex items-start">
                <span className="text-[#F59E0B] mr-2">•</span>
                <span>No lock-up period - your funds are always accessible</span>
              </li>
            </ul>
          </div>
        </div>
      </main>
    </div>
  )
}

