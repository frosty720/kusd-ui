'use client'

import Navigation from '@/components/Navigation'
import { useChainId, useAccount, useBalance, useReadContract } from 'wagmi'
import { useVat, usePot, useEnd, useVow, useTokenBalance, usePSM, useKusdPrice, useOracle } from '@/hooks'
import { formatRAD, formatRAY, formatWAD } from '@/lib'
import { useState } from 'react'
import { MAINNET_CONTRACTS, TESTNET_CONTRACTS, getAllCollateralTypes, type CollateralType } from '@/config/contracts'
import { formatUnits } from 'viem'

// Environment variables for PSM and Keeper
const PSM_ADDRESS = process.env.NEXT_PUBLIC_PSM_ADDRESS as `0x${string}` | undefined
const POCKET_ADDRESS = process.env.NEXT_PUBLIC_PSM_POCKET_ADDRESS as `0x${string}` | undefined
const KEEPER_WALLET = process.env.NEXT_PUBLIC_KEEPER_WALLET as `0x${string}` | undefined

// Admin NFT contract address - only holders can access admin functions
const ADMIN_NFT_ADDRESS = '0x6B9557d1A52B9813288f45518D880C891b49491a' as const

export default function AdminPage() {
  const chainId = useChainId()
  const { address, isConnected } = useAccount()
  const [showShutdownConfirm, setShowShutdownConfirm] = useState(false)

  // Check if user holds the admin NFT
  const { data: adminNftBalance, isLoading: isNftLoading } = useReadContract({
    address: ADMIN_NFT_ADDRESS,
    abi: [{
      name: 'balanceOf',
      type: 'function',
      stateMutability: 'view',
      inputs: [{ name: 'owner', type: 'address' }],
      outputs: [{ name: '', type: 'uint256' }],
    }] as const,
    functionName: 'balanceOf',
    args: address ? [address] : undefined,
    query: { enabled: !!address },
  })

  const hasAdminNft = adminNftBalance && typeof adminNftBalance === 'bigint' && adminNftBalance > 0n

  // Get contracts for display
  const contracts = chainId === 3888 ? MAINNET_CONTRACTS : TESTNET_CONTRACTS
  const usdcAddress = contracts.collateral['USDC-A'].token
  const kusdAddress = contracts.core.kusd

  // Core hooks
  const vat = useVat(chainId || 3889)
  const pot = usePot(chainId || 3889)
  const end = useEnd(chainId || 3889)
  const vow = useVow(chainId || 3889)

  // Vat data
  const { data: totalDebt } = vat.useDebt()
  const { data: debtCeiling } = vat.useLine()

  // Pot data
  const { data: potDsr } = pot.useDsr()
  const { data: potTotalPie } = pot.useTotalPie()

  // End data
  const { data: systemLive } = end.useLive()
  const { data: shutdownWhen } = end.useWhen()
  const { data: isAuthorized } = end.useWards(address as `0x${string}`)

  // Vow data
  const { data: vowSin } = vow.useSin()
  const { data: vowAsh } = vow.useAsh()

  // PSM Pocket balances
  const { data: pocketUsdcBalance } = useTokenBalance(usdcAddress, POCKET_ADDRESS)
  const { data: pocketKusdBalance } = useTokenBalance(kusdAddress, POCKET_ADDRESS)

  // Keeper wallet balances
  const { data: keeperKlcBalance } = useBalance({ address: KEEPER_WALLET })
  const { data: keeperUsdcBalance } = useTokenBalance(usdcAddress, KEEPER_WALLET)
  const { data: keeperKusdBalance } = useTokenBalance(kusdAddress, KEEPER_WALLET)

  // PSM data
  const psm = usePSM()
  const { data: psmTin } = psm.useTin()
  const { data: psmTout } = psm.useTout()

  // KUSD price from DEX
  const { price: kusdPrice, deviation: pegDeviation, status: pegStatus } = useKusdPrice(kusdAddress, usdcAddress)

  // Collateral ilk data for utilization
  const { data: wbtcIlk } = vat.useIlk(contracts.collateral['WBTC-A'].ilk as `0x${string}`)
  const { data: wethIlk } = vat.useIlk(contracts.collateral['WETH-A'].ilk as `0x${string}`)
  const { data: usdtIlk } = vat.useIlk(contracts.collateral['USDT-A'].ilk as `0x${string}`)
  const { data: usdcIlk } = vat.useIlk(contracts.collateral['USDC-A'].ilk as `0x${string}`)
  const { data: daiIlk } = vat.useIlk(contracts.collateral['DAI-A'].ilk as `0x${string}`)

  // Oracle data for each collateral
  const wbtcOracle = useOracle(contracts.collateral['WBTC-A'].oracle as `0x${string}`)
  const wethOracle = useOracle(contracts.collateral['WETH-A'].oracle as `0x${string}`)
  const usdtOracle = useOracle(contracts.collateral['USDT-A'].oracle as `0x${string}`)
  const usdcOracle = useOracle(contracts.collateral['USDC-A'].oracle as `0x${string}`)
  const daiOracle = useOracle(contracts.collateral['DAI-A'].oracle as `0x${string}`)

  const { data: wbtcPriceData } = wbtcOracle.useGetPriceData()
  const { data: wethPriceData } = wethOracle.useGetPriceData()
  const { data: usdtPriceData } = usdtOracle.useGetPriceData()
  const { data: usdcPriceData } = usdcOracle.useGetPriceData()
  const { data: daiPriceData } = daiOracle.useGetPriceData()

  // Emergency shutdown hook
  const { cage, isPending, isConfirming, isSuccess, error } = end.useCage()

  // Format values
  const kusdSupply = totalDebt && typeof totalDebt === 'bigint'
    ? Number(formatRAD(totalDebt)) : 0
  const maxDebt = debtCeiling && typeof debtCeiling === 'bigint'
    ? Number(formatRAD(debtCeiling)) : 0
  const totalInDSR = potTotalPie && typeof potTotalPie === 'bigint'
    ? Number(formatWAD(potTotalPie)) : 0
  // Calculate DSR APY: (rate^seconds_per_year - 1) * 100
  // Must use raw bigint division to preserve precision (formatRAY loses precision)
  const SECONDS_PER_YEAR = 31536000
  const RAY = 10n ** 27n
  const dsrAPY = potDsr && typeof potDsr === 'bigint' && potDsr > RAY
    ? (Math.pow(Number(potDsr) / Number(RAY), SECONDS_PER_YEAR) - 1) * 100
    : 0
  const isLive = systemLive === 1n
  const hasAuth = isAuthorized === 1n

  const queuedDebt = vowSin && typeof vowSin === 'bigint'
    ? Number(formatRAD(vowSin)) : 0
  const auctionedDebt = vowAsh && typeof vowAsh === 'bigint'
    ? Number(formatRAD(vowAsh)) : 0

  // Format PSM/Keeper balances
  const pocketUsdc = pocketUsdcBalance && typeof pocketUsdcBalance === 'bigint'
    ? Number(formatUnits(pocketUsdcBalance, 6)) : 0
  const pocketKusd = pocketKusdBalance && typeof pocketKusdBalance === 'bigint'
    ? Number(formatUnits(pocketKusdBalance, 18)) : 0
  const keeperKlc = keeperKlcBalance?.value
    ? Number(formatUnits(keeperKlcBalance.value, 18)) : 0
  const keeperUsdc = keeperUsdcBalance && typeof keeperUsdcBalance === 'bigint'
    ? Number(formatUnits(keeperUsdcBalance, 6)) : 0
  const keeperKusd = keeperKusdBalance && typeof keeperKusdBalance === 'bigint'
    ? Number(formatUnits(keeperKusdBalance, 18)) : 0

  // Format PSM fees (WAD = 18 decimals, fee is a percentage)
  const tinFee = psmTin && typeof psmTin === 'bigint'
    ? Number(formatUnits(psmTin, 18)) * 100 : 0
  const toutFee = psmTout && typeof psmTout === 'bigint'
    ? Number(formatUnits(psmTout, 18)) * 100 : 0

  // Helper to format collateral utilization
  const formatIlkUtilization = (ilkData: any) => {
    if (!ilkData) return { debt: 0, ceiling: 0, utilization: 0 }
    const [Art, rate, spot, line] = ilkData as [bigint, bigint, bigint, bigint, bigint]
    // Art is normalized debt, rate is accumulator, line is debt ceiling in RAD
    const debt = Number(formatRAD(Art * rate))
    const ceiling = Number(formatRAD(line))
    const utilization = ceiling > 0 ? (debt / ceiling) * 100 : 0
    return { debt, ceiling, utilization }
  }

  // Format oracle price data
  const formatOracleData = (priceData: any) => {
    if (!priceData) return { price: 0, timestamp: 0, valid: false, isStale: true }
    const [price, timestamp, valid] = priceData as [bigint, bigint, boolean]
    const priceNum = Number(formatUnits(price, 18))
    const timestampNum = Number(timestamp)
    const now = Math.floor(Date.now() / 1000)
    const age = now - timestampNum
    const isStale = age > 3600 // Stale if > 1 hour old
    return { price: priceNum, timestamp: timestampNum, valid, isStale, age }
  }

  const handleEmergencyShutdown = () => {
    if (showShutdownConfirm) {
      cage()
      setShowShutdownConfirm(false)
    } else {
      setShowShutdownConfirm(true)
    }
  }

  // Access denied if not connected or doesn't hold NFT
  if (!isConnected) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#0a0a0a] via-[#1a0f00] to-[#0a0a0a]">
        <Navigation />
        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="bg-[#1a1a1a] border border-[#262626] rounded-xl p-12 text-center">
            <div className="text-6xl mb-6">🔒</div>
            <h1 className="text-3xl font-bold text-white mb-4">Admin Access Required</h1>
            <p className="text-[#9ca3af] mb-6">Please connect your wallet to access the admin dashboard.</p>
          </div>
        </main>
      </div>
    )
  }

  if (isNftLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#0a0a0a] via-[#1a0f00] to-[#0a0a0a]">
        <Navigation />
        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="bg-[#1a1a1a] border border-[#262626] rounded-xl p-12 text-center">
            <div className="text-6xl mb-6 animate-pulse">🔐</div>
            <h1 className="text-3xl font-bold text-white mb-4">Verifying Access...</h1>
            <p className="text-[#9ca3af]">Checking admin NFT ownership...</p>
          </div>
        </main>
      </div>
    )
  }

  if (!hasAdminNft) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#0a0a0a] via-[#1a0f00] to-[#0a0a0a]">
        <Navigation />
        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="bg-red-900/20 border border-red-500/30 rounded-xl p-12 text-center">
            <div className="text-6xl mb-6">⛔</div>
            <h1 className="text-3xl font-bold text-red-400 mb-4">Access Denied</h1>
            <p className="text-[#9ca3af] mb-6">
              You must hold the Admin NFT to access this page.
            </p>
            <div className="bg-[#1a1a1a] border border-[#262626] rounded-lg p-4 inline-block">
              <p className="text-xs text-[#6b7280] mb-1">Admin NFT Contract:</p>
              <code className="text-xs text-[#f59e0b] break-all">{ADMIN_NFT_ADDRESS}</code>
            </div>
          </div>
        </main>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0a0a0a] via-[#1a0f00] to-[#0a0a0a]">
      <Navigation />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-white mb-2">Admin Dashboard</h1>
          <p className="text-[#9ca3af]">System monitoring and emergency controls</p>
        </div>

        {/* System Status Banner */}
        <div className={`mb-8 p-6 rounded-xl border ${
          isLive
            ? 'bg-green-900/20 border-green-500/30'
            : 'bg-red-900/20 border-red-500/30'
        }`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className={`w-4 h-4 rounded-full ${isLive ? 'bg-green-500' : 'bg-red-500'} animate-pulse`} />
              <div>
                <h2 className="text-xl font-bold text-white">
                  System Status: {isLive ? 'LIVE' : 'SHUTDOWN'}
                </h2>
                <p className="text-sm text-[#9ca3af]">
                  {isLive
                    ? 'All systems operational'
                    : `Shutdown triggered at block ${shutdownWhen?.toString() || 'unknown'}`}
                </p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-sm text-[#9ca3af]">Network</p>
              <p className="text-white font-medium">
                {chainId === 3888 ? 'KalyChain Mainnet' : 'KalyChain Testnet'}
              </p>
            </div>
          </div>
        </div>

        {/* Peg Status - Most Important */}
        <div className={`mb-8 p-6 rounded-xl border ${
          pegStatus === 'on-peg' ? 'bg-green-900/20 border-green-500/30' :
          pegStatus === 'critical' ? 'bg-red-900/20 border-red-500/30' :
          'bg-yellow-900/20 border-yellow-500/30'
        }`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className={`text-4xl ${
                pegStatus === 'on-peg' ? '' :
                pegStatus === 'critical' ? '' : ''
              }`}>
                {pegStatus === 'on-peg' ? '🎯' : pegStatus === 'critical' ? '🚨' : '⚠️'}
              </div>
              <div>
                <h2 className="text-xl font-bold text-white">
                  KUSD Peg Status: {pegStatus === 'on-peg' ? 'ON PEG' : pegStatus === 'above-peg' ? 'ABOVE PEG' : pegStatus === 'below-peg' ? 'BELOW PEG' : pegStatus === 'critical' ? 'CRITICAL' : 'Loading...'}
                </h2>
                <p className="text-sm text-[#9ca3af]">
                  {kusdPrice !== null ? `Current price: $${kusdPrice.toFixed(4)}` : 'Fetching price...'}
                  {pegDeviation !== null && ` (${pegDeviation >= 0 ? '+' : ''}${pegDeviation.toFixed(2)}% from peg)`}
                </p>
              </div>
            </div>
            <div className="text-right">
              <p className={`text-3xl font-bold ${
                pegStatus === 'on-peg' ? 'text-green-400' :
                pegStatus === 'critical' ? 'text-red-400' : 'text-yellow-400'
              }`}>
                ${kusdPrice?.toFixed(4) || '-.----'}
              </p>
              <p className="text-xs text-[#6b7280]">KalySwap DEX Price</p>
            </div>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4 mb-8">
          <StatCard title="KUSD Supply" value={`${kusdSupply.toLocaleString('en-US', { maximumFractionDigits: 2 })}`} subtitle="Total minted" />
          <StatCard title="Debt Ceiling" value={`${maxDebt.toLocaleString('en-US', { maximumFractionDigits: 0 })}`} subtitle="Maximum allowed" />
          <StatCard title="DSR Deposits" value={`${totalInDSR.toLocaleString('en-US', { maximumFractionDigits: 2 })}`} subtitle="In savings" />
          <StatCard title="Savings Rate" value={`${dsrAPY.toFixed(2)}%`} subtitle="APY" />
        </div>

        {/* Debt Stats */}
        <div className="grid gap-6 md:grid-cols-2 mb-8">
          <StatCard title="Queued Debt (Sin)" value={`${queuedDebt.toLocaleString('en-US', { maximumFractionDigits: 2 })}`} subtitle="Waiting in queue" />
          <StatCard title="Auctioned Debt (Ash)" value={`${auctionedDebt.toLocaleString('en-US', { maximumFractionDigits: 2 })}`} subtitle="Being auctioned" />
        </div>

        {/* PSM & Keeper Status */}
        <div className="grid gap-6 md:grid-cols-2 mb-8">
          {/* PSM Pocket Status */}
          <div className="bg-[#1a1a1a] border border-[#262626] rounded-xl p-6">
            <h3 className="text-lg font-bold text-white mb-4">📦 PSM Pocket Status</h3>
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-[#9ca3af]">USDC Balance</span>
                <span className={`font-bold ${pocketUsdc < 100 ? 'text-red-400' : pocketUsdc < 1000 ? 'text-yellow-400' : 'text-green-400'}`}>
                  {pocketUsdc.toLocaleString('en-US', { maximumFractionDigits: 2 })} USDC
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-[#9ca3af]">KUSD Balance</span>
                <span className="text-white font-medium">
                  {pocketKusd.toLocaleString('en-US', { maximumFractionDigits: 2 })} KUSD
                </span>
              </div>
              <div className="pt-3 border-t border-[#262626]">
                <p className="text-xs text-[#6b7280] mb-2">Pocket Address:</p>
                <code className="text-xs text-[#f59e0b] break-all">{POCKET_ADDRESS || 'Not configured'}</code>
              </div>
              {pocketUsdc < 100 && (
                <div className="mt-3 p-3 bg-red-900/20 border border-red-500/30 rounded-lg">
                  <p className="text-sm text-red-400">⚠️ Low USDC in pocket. Add funds to enable peg arbitrage.</p>
                </div>
              )}
            </div>
          </div>

          {/* Keeper Wallet Status */}
          <div className="bg-[#1a1a1a] border border-[#262626] rounded-xl p-6">
            <h3 className="text-lg font-bold text-white mb-4">🤖 Keeper Wallet Status</h3>
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-[#9ca3af]">KLC Balance</span>
                <span className={`font-bold ${keeperKlc < 0.1 ? 'text-red-400' : keeperKlc < 1 ? 'text-yellow-400' : 'text-green-400'}`}>
                  {keeperKlc.toLocaleString('en-US', { maximumFractionDigits: 4 })} KLC
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-[#9ca3af]">USDC Balance</span>
                <span className="text-white font-medium">
                  {keeperUsdc.toLocaleString('en-US', { maximumFractionDigits: 2 })} USDC
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-[#9ca3af]">KUSD Balance</span>
                <span className="text-white font-medium">
                  {keeperKusd.toLocaleString('en-US', { maximumFractionDigits: 2 })} KUSD
                </span>
              </div>
              <div className="pt-3 border-t border-[#262626]">
                <p className="text-xs text-[#6b7280] mb-2">Keeper Address:</p>
                <code className="text-xs text-[#f59e0b] break-all">{KEEPER_WALLET || 'Not configured'}</code>
              </div>
              {keeperKlc < 0.1 && (
                <div className="mt-3 p-3 bg-red-900/20 border border-red-500/30 rounded-lg">
                  <p className="text-sm text-red-400">⚠️ Low KLC for gas. Keeper may fail to execute transactions.</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* PSM Contract Info with Fees */}
        <div className="bg-[#1a1a1a] border border-[#262626] rounded-xl p-6 mb-8">
          <h3 className="text-lg font-bold text-white mb-4">🔄 PSM Contract & Fees</h3>
          <div className="grid gap-4 md:grid-cols-3">
            <div>
              <p className="text-xs text-[#6b7280] mb-1">PSM Address</p>
              <code className="text-xs text-[#f59e0b] break-all">{PSM_ADDRESS || 'Not configured'}</code>
            </div>
            <div>
              <p className="text-xs text-[#6b7280] mb-1">Buy Fee (tin)</p>
              <p className="text-white font-medium">{tinFee.toFixed(2)}%</p>
              <p className="text-xs text-[#6b7280]">USDC → KUSD</p>
            </div>
            <div>
              <p className="text-xs text-[#6b7280] mb-1">Sell Fee (tout)</p>
              <p className="text-white font-medium">{toutFee.toFixed(2)}%</p>
              <p className="text-xs text-[#6b7280]">KUSD → USDC</p>
            </div>
          </div>
        </div>

        {/* Oracle Status */}
        <div className="bg-[#1a1a1a] border border-[#262626] rounded-xl p-6 mb-8">
          <h3 className="text-lg font-bold text-white mb-4">📡 Oracle Status</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[#262626]">
                  <th className="text-left py-2 text-[#9ca3af] font-medium">Collateral</th>
                  <th className="text-right py-2 text-[#9ca3af] font-medium">Price</th>
                  <th className="text-right py-2 text-[#9ca3af] font-medium">Age</th>
                  <th className="text-right py-2 text-[#9ca3af] font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                <OracleRow symbol="WBTC" data={formatOracleData(wbtcPriceData)} />
                <OracleRow symbol="WETH" data={formatOracleData(wethPriceData)} />
                <OracleRow symbol="USDT" data={formatOracleData(usdtPriceData)} />
                <OracleRow symbol="USDC" data={formatOracleData(usdcPriceData)} />
                <OracleRow symbol="DAI" data={formatOracleData(daiPriceData)} />
              </tbody>
            </table>
          </div>
        </div>

        {/* Collateral Utilization */}
        <div className="bg-[#1a1a1a] border border-[#262626] rounded-xl p-6 mb-8">
          <h3 className="text-lg font-bold text-white mb-4">📊 Collateral Utilization</h3>
          <div className="space-y-4">
            <CollateralUtilizationRow symbol="WBTC-A" data={formatIlkUtilization(wbtcIlk)} />
            <CollateralUtilizationRow symbol="WETH-A" data={formatIlkUtilization(wethIlk)} />
            <CollateralUtilizationRow symbol="USDT-A" data={formatIlkUtilization(usdtIlk)} />
            <CollateralUtilizationRow symbol="USDC-A" data={formatIlkUtilization(usdcIlk)} />
            <CollateralUtilizationRow symbol="DAI-A" data={formatIlkUtilization(daiIlk)} />
          </div>
        </div>

        {/* Emergency Shutdown Section - Placeholder for NFT access control */}
        <EmergencyShutdownSection
          isConnected={isConnected}
          hasAuth={hasAuth}
          isLive={isLive}
          showConfirm={showShutdownConfirm}
          onShutdown={handleEmergencyShutdown}
          onCancel={() => setShowShutdownConfirm(false)}
          isPending={isPending}
          isConfirming={isConfirming}
          isSuccess={isSuccess}
          error={error}
        />
      </main>
    </div>
  )
}

// Helper Components
function StatCard({ title, value, subtitle }: { title: string; value: string; subtitle: string }) {
  return (
    <div className="bg-[#1a1a1a] border border-[#262626] rounded-xl p-6">
      <p className="text-sm text-[#9ca3af] mb-1">{title}</p>
      <p className="text-2xl font-bold text-white mb-1">{value}</p>
      <p className="text-xs text-[#6b7280]">{subtitle}</p>
    </div>
  )
}

function AddressRow({ label, address }: { label: string; address: string }) {
  return (
    <div className="flex justify-between items-center py-2 border-b border-[#262626] last:border-0">
      <span className="text-[#9ca3af]">{label}</span>
      <code className="text-[#f59e0b] font-mono text-xs">{address}</code>
    </div>
  )
}

function OracleRow({ symbol, data }: { symbol: string; data: { price: number; timestamp: number; valid: boolean; isStale: boolean; age?: number } }) {
  const formatAge = (seconds: number) => {
    if (seconds < 60) return `${seconds}s`
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m`
    return `${Math.floor(seconds / 3600)}h ${Math.floor((seconds % 3600) / 60)}m`
  }

  return (
    <tr className="border-b border-[#262626] last:border-0">
      <td className="py-3 text-white font-medium">{symbol}</td>
      <td className="py-3 text-right text-white">
        ${data.price > 0 ? data.price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '-.--'}
      </td>
      <td className="py-3 text-right text-[#9ca3af]">
        {data.age !== undefined ? formatAge(data.age) : '--'}
      </td>
      <td className="py-3 text-right">
        <span className={`inline-flex items-center px-2 py-1 rounded text-xs font-medium ${
          !data.valid ? 'bg-red-900/50 text-red-400' :
          data.isStale ? 'bg-yellow-900/50 text-yellow-400' :
          'bg-green-900/50 text-green-400'
        }`}>
          {!data.valid ? '❌ Invalid' : data.isStale ? '⚠️ Stale' : '✓ Fresh'}
        </span>
      </td>
    </tr>
  )
}

function CollateralUtilizationRow({ symbol, data }: { symbol: string; data: { debt: number; ceiling: number; utilization: number } }) {
  return (
    <div>
      <div className="flex justify-between items-center mb-1">
        <span className="text-white font-medium">{symbol}</span>
        <span className="text-[#9ca3af] text-sm">
          {data.debt.toLocaleString('en-US', { maximumFractionDigits: 0 })} / {data.ceiling.toLocaleString('en-US', { maximumFractionDigits: 0 })} KUSD
        </span>
      </div>
      <div className="h-2 bg-[#262626] rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${
            data.utilization > 90 ? 'bg-red-500' :
            data.utilization > 70 ? 'bg-yellow-500' :
            'bg-green-500'
          }`}
          style={{ width: `${Math.min(data.utilization, 100)}%` }}
        />
      </div>
      <p className="text-xs text-[#6b7280] mt-1">{data.utilization.toFixed(1)}% utilized</p>
    </div>
  )
}

interface EmergencyShutdownProps {
  isConnected: boolean
  hasAuth: boolean
  isLive: boolean
  showConfirm: boolean
  onShutdown: () => void
  onCancel: () => void
  isPending: boolean
  isConfirming: boolean
  isSuccess: boolean
  error: Error | null
}

function EmergencyShutdownSection({
  isConnected,
  hasAuth,
  isLive,
  showConfirm,
  onShutdown,
  onCancel,
  isPending,
  isConfirming,
  isSuccess,
  error,
}: EmergencyShutdownProps) {
  return (
    <div className="bg-red-900/10 border border-red-500/30 rounded-xl p-6">
      <h3 className="text-xl font-bold text-red-400 mb-4">⚠️ Emergency Shutdown</h3>
      <p className="text-[#9ca3af] mb-4">
        Emergency shutdown is an irreversible action that halts all system operations.
        Only authorized addresses can trigger this function.
      </p>

      {!isConnected ? (
        <p className="text-yellow-400">Connect your wallet to access emergency controls.</p>
      ) : !hasAuth ? (
        <div className="bg-[#1a1a1a] border border-[#262626] rounded-lg p-4">
          <p className="text-[#9ca3af]">
            Your address is not authorized to trigger emergency shutdown.
            <br />
            <span className="text-xs text-[#6b7280]">
              Note: Future versions will use NFT-based access control.
            </span>
          </p>
        </div>
      ) : !isLive ? (
        <p className="text-red-400">System is already shut down.</p>
      ) : showConfirm ? (
        <div className="space-y-4">
          <p className="text-red-400 font-bold">
            Are you absolutely sure? This action cannot be undone!
          </p>
          <div className="flex gap-4">
            <button
              onClick={onShutdown}
              disabled={isPending || isConfirming}
              className="px-6 py-3 bg-red-600 hover:bg-red-700 text-white font-bold rounded-lg disabled:opacity-50"
            >
              {isPending ? 'Confirming...' : isConfirming ? 'Processing...' : 'CONFIRM SHUTDOWN'}
            </button>
            <button
              onClick={onCancel}
              className="px-6 py-3 bg-[#262626] hover:bg-[#333] text-white rounded-lg"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <button
          onClick={onShutdown}
          className="px-6 py-3 bg-red-600/50 hover:bg-red-600 text-white font-bold rounded-lg transition-colors"
        >
          Initiate Emergency Shutdown
        </button>
      )}

      {isSuccess && (
        <p className="mt-4 text-green-400">Emergency shutdown triggered successfully.</p>
      )}
      {error && (
        <p className="mt-4 text-red-400">Error: {error.message}</p>
      )}
    </div>
  )
}

