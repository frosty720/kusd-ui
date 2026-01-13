'use client'

import Navigation from '@/components/Navigation'
import Link from 'next/link'
import Image from 'next/image'
import { useChainId, useAccount, useBalance } from 'wagmi'
import { useUserPortfolio, type VaultPosition, type DSRPosition, type PortfolioSummary, useVat, usePot, useKusdPrice, useTokenBalance, useOracle } from '@/hooks'
import { formatWAD, formatRAY, formatRAD } from '@/lib'
import { RAY } from '@/lib/constants'
import { MAINNET_CONTRACTS, TESTNET_CONTRACTS } from '@/config/contracts'
import { formatUnits } from 'viem'

export default function DashboardPage() {
  const chainId = useChainId()
  const { address, isConnected } = useAccount()

  // Get contracts based on chain
  const contracts = chainId === 3888 ? MAINNET_CONTRACTS : TESTNET_CONTRACTS
  const kusdAddress = contracts.core.kusd
  const usdcAddress = contracts.collateral['USDC-A'].token

  const { vaults, dsrPosition, summary, kusdWalletBalance, isLoading } = useUserPortfolio(
    chainId || 3889,
    address as `0x${string}` | undefined
  )

  // Additional hooks for enhanced dashboard
  const vat = useVat(chainId || 3889)
  const pot = usePot(chainId || 3889)

  // KUSD price from DEX
  const { price: kusdPrice, deviation: pegDeviation, status: pegStatus } = useKusdPrice(kusdAddress, usdcAddress)

  // Wallet balances
  const { data: klcBalance } = useBalance({ address })
  const { data: usdcBalance } = useTokenBalance(usdcAddress, address)

  // Protocol stats
  const { data: totalDebt } = vat.useDebt()
  const { data: potDsr } = pot.useDsr()
  const { data: potTotalPie } = pot.useTotalPie()

  // Oracle prices
  const wbtcOracle = useOracle(contracts.collateral['WBTC-A'].oracle as `0x${string}`)
  const wethOracle = useOracle(contracts.collateral['WETH-A'].oracle as `0x${string}`)
  const { data: wbtcPriceData } = wbtcOracle.useGetPriceData()
  const { data: wethPriceData } = wethOracle.useGetPriceData()

  // Format protocol stats
  const kusdSupply = totalDebt && typeof totalDebt === 'bigint'
    ? Number(formatRAD(totalDebt)) : 0
  // Calculate DSR APY correctly: APY = (rate^seconds_per_year - 1) * 100
  // Must use raw bigint division to preserve precision (formatRAY loses precision)
  const SECONDS_PER_YEAR = 31536000
  const RAY = 10n ** 27n
  const dsrAPY = potDsr && typeof potDsr === 'bigint' && potDsr > RAY
    ? (Math.pow(Number(potDsr) / Number(RAY), SECONDS_PER_YEAR) - 1) * 100
    : 0
  const totalInDSR = potTotalPie && typeof potTotalPie === 'bigint'
    ? Number(formatWAD(potTotalPie)) : 0

  // Format wallet balances
  const klcBalanceNum = klcBalance?.value ? Number(formatUnits(klcBalance.value, 18)) : 0
  const usdcBalanceNum = usdcBalance && typeof usdcBalance === 'bigint'
    ? Number(formatUnits(usdcBalance, 6)) : 0
  const kusdBalanceNum = kusdWalletBalance ? Number(formatRAD(kusdWalletBalance)) : 0

  // Format oracle prices
  const wbtcPrice = wbtcPriceData ? Number(formatUnits((wbtcPriceData as [bigint, bigint, boolean])[0], 18)) : 0
  const wethPrice = wethPriceData ? Number(formatUnits((wethPriceData as [bigint, bigint, boolean])[0], 18)) : 0

  if (!isConnected) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#0a0a0a] via-[#1a0f00] to-[#0a0a0a]">
        <Navigation />
        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="text-center py-20">
            <h1 className="text-4xl font-bold text-white mb-4">Portfolio Dashboard</h1>
            <p className="text-[#9ca3af] mb-8">Connect your wallet to view your positions</p>
            <div className="inline-block p-8 bg-[#1a1a1a] border border-[#262626] rounded-xl">
              <p className="text-[#6b7280]">Please connect your wallet to continue</p>
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
          <h1 className="text-4xl font-bold text-white mb-2">Portfolio Dashboard</h1>
          <p className="text-[#9ca3af]">Overview of all your KUSD positions</p>
        </div>

        {/* KUSD Peg Status */}
        <KusdPegStatusBanner
          price={kusdPrice}
          deviation={pegDeviation}
          status={pegStatus}
        />

        {/* Wallet & Protocol Overview Row */}
        <div className="grid gap-6 md:grid-cols-2 mb-8">
          {/* Wallet Balances */}
          <div className="bg-[#1a1a1a] border border-[#262626] rounded-xl p-6">
            <h3 className="text-lg font-bold text-white mb-4">💰 Your Balances</h3>
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-[#9ca3af]">KUSD (Vat Balance)</span>
                <span className="text-white font-medium">{kusdBalanceNum.toLocaleString('en-US', { maximumFractionDigits: 2 })}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-[#9ca3af]">USDC</span>
                <span className="text-white font-medium">{usdcBalanceNum.toLocaleString('en-US', { maximumFractionDigits: 2 })}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-[#9ca3af]">KLC</span>
                <span className="text-white font-medium">{klcBalanceNum.toLocaleString('en-US', { maximumFractionDigits: 4 })}</span>
              </div>
              {usdcBalanceNum > 0 && (
                <div className="pt-3 border-t border-[#262626]">
                  <Link
                    href="/mint"
                    className="text-sm text-[#f59e0b] hover:text-[#d97706] flex items-center gap-1"
                  >
                    💱 Swap USDC for KUSD via PSM →
                  </Link>
                </div>
              )}
            </div>
          </div>

          {/* Protocol Overview */}
          <div className="bg-[#1a1a1a] border border-[#262626] rounded-xl p-6">
            <h3 className="text-lg font-bold text-white mb-4">📊 Protocol Stats</h3>
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-[#9ca3af]">Total KUSD Supply</span>
                <span className="text-white font-medium">{kusdSupply.toLocaleString('en-US', { maximumFractionDigits: 0 })}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-[#9ca3af]">Savings Rate (DSR)</span>
                <span className="text-green-400 font-medium">{dsrAPY.toFixed(2)}% APY</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-[#9ca3af]">Total in Savings</span>
                <span className="text-white font-medium">{totalInDSR.toLocaleString('en-US', { maximumFractionDigits: 0 })} KUSD</span>
              </div>
              <div className="pt-3 border-t border-[#262626]">
                <div className="flex justify-between text-xs text-[#6b7280]">
                  <span>BTC: ${wbtcPrice.toLocaleString('en-US', { maximumFractionDigits: 0 })}</span>
                  <span>ETH: ${wethPrice.toLocaleString('en-US', { maximumFractionDigits: 0 })}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Portfolio Summary Cards */}
        <PortfolioSummarySection summary={summary} kusdBalance={kusdWalletBalance} isLoading={isLoading} />

        {/* Health Alert Banner */}
        {summary.vaultsAtRisk > 0 && (
          <div className="mb-8 p-4 bg-red-900/20 border border-red-500/30 rounded-xl">
            <div className="flex items-center gap-3">
              <span className="text-2xl">⚠️</span>
              <div>
                <p className="text-red-400 font-bold">
                  {summary.vaultsAtRisk} vault{summary.vaultsAtRisk > 1 ? 's' : ''} at risk of liquidation!
                </p>
                <p className="text-sm text-[#9ca3af]">
                  Add collateral or repay debt to avoid liquidation
                </p>
              </div>
            </div>
          </div>
        )}

        {/* DSR Savings Section */}
        <DSRSection dsrPosition={dsrPosition} />

        {/* Vault Positions */}
        <div className="mb-8">
          <h2 className="text-2xl font-bold text-white mb-4">Your Vaults</h2>
          {summary.activeVaults === 0 ? (
            <div className="bg-[#1a1a1a] border border-[#262626] rounded-xl p-8 text-center">
              <p className="text-[#9ca3af] mb-4">You don&apos;t have any active vaults yet</p>
              <Link
                href="/borrow"
                className="inline-block px-6 py-3 bg-[#f59e0b] hover:bg-[#d97706] text-black font-bold rounded-lg transition-colors"
              >
                Open a Vault
              </Link>
            </div>
          ) : (
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {vaults.filter(v => v.hasPosition).map((vault) => (
                <VaultCard key={vault.collateralType} vault={vault} />
              ))}
            </div>
          )}
        </div>

        {/* All Vaults (including empty) */}
        <div className="mb-8">
          <h2 className="text-xl font-bold text-white mb-4">Available Collateral Types</h2>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
            {vaults.map((vault) => (
              <CollateralTypeCard key={vault.collateralType} vault={vault} />
            ))}
          </div>
        </div>

        {/* Quick Actions */}
        <QuickActionsSection />
      </main>
    </div>
  )
}


// Portfolio Summary Section
function PortfolioSummarySection({
  summary,
  kusdBalance,
  isLoading
}: {
  summary: PortfolioSummary
  kusdBalance: bigint
  isLoading: boolean
}) {
  const totalCollateral = Number(formatWAD(summary.totalCollateralValue))
  const totalDebt = Number(formatWAD(summary.totalDebt))
  const dsrBalance = Number(formatWAD(summary.totalDSRBalance))
  const netWorth = Number(formatWAD(summary.netWorth))
  const walletKusd = Number(formatRAD(kusdBalance))

  return (
    <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4 mb-8">
      <SummaryCard
        title="Total Collateral"
        value={`$${totalCollateral.toLocaleString('en-US', { maximumFractionDigits: 2 })}`}
        subtitle={`${summary.activeVaults} active vault${summary.activeVaults !== 1 ? 's' : ''}`}
        icon="🏦"
        isLoading={isLoading}
      />
      <SummaryCard
        title="Total Debt"
        value={`${totalDebt.toLocaleString('en-US', { maximumFractionDigits: 2 })} KUSD`}
        subtitle={summary.vaultsAtRisk > 0 ? `${summary.vaultsAtRisk} at risk` : 'All vaults healthy'}
        icon="📊"
        color={summary.vaultsAtRisk > 0 ? 'red' : undefined}
        isLoading={isLoading}
      />
      <SummaryCard
        title="DSR Savings"
        value={`${dsrBalance.toLocaleString('en-US', { maximumFractionDigits: 2 })} KUSD`}
        subtitle="Earning interest"
        icon="💰"
        color="green"
        isLoading={isLoading}
      />
      <SummaryCard
        title="Net Worth"
        value={`$${netWorth.toLocaleString('en-US', { maximumFractionDigits: 2 })}`}
        subtitle={`${walletKusd.toFixed(2)} KUSD in wallet`}
        icon="💎"
        isLoading={isLoading}
      />
    </div>
  )
}

function SummaryCard({
  title, value, subtitle, icon, color, isLoading
}: {
  title: string; value: string; subtitle: string; icon: string; color?: 'red' | 'green'; isLoading: boolean
}) {
  const colorClass = color === 'red' ? 'text-red-400' : color === 'green' ? 'text-green-400' : 'text-white'
  return (
    <div className="bg-[#1a1a1a] border border-[#262626] rounded-xl p-6">
      <div className="flex items-start justify-between mb-2">
        <p className="text-sm text-[#9ca3af]">{title}</p>
        <span className="text-2xl">{icon}</span>
      </div>
      {isLoading ? (
        <div className="h-8 bg-[#262626] rounded animate-pulse mb-1" />
      ) : (
        <p className={`text-2xl font-bold ${colorClass} mb-1`}>{value}</p>
      )}
      <p className="text-xs text-[#6b7280]">{subtitle}</p>
    </div>
  )
}

// KUSD Peg Status Banner
function KusdPegStatusBanner({
  price,
  deviation,
  status
}: {
  price: number | null
  deviation: number | null
  status: 'loading' | 'on-peg' | 'above-peg' | 'below-peg' | 'critical' | 'no-liquidity'
}) {
  const getStatusInfo = () => {
    switch (status) {
      case 'on-peg':
        return { bg: 'bg-green-900/20 border-green-500/30', icon: '✓', text: 'On Peg', color: 'text-green-400' }
      case 'above-peg':
        return { bg: 'bg-yellow-900/20 border-yellow-500/30', icon: '↑', text: 'Above Peg', color: 'text-yellow-400' }
      case 'below-peg':
        return { bg: 'bg-yellow-900/20 border-yellow-500/30', icon: '↓', text: 'Below Peg', color: 'text-yellow-400' }
      case 'critical':
        return { bg: 'bg-red-900/20 border-red-500/30', icon: '⚠️', text: 'Off Peg', color: 'text-red-400' }
      case 'no-liquidity':
        return { bg: 'bg-gray-900/20 border-gray-500/30', icon: '?', text: 'No Liquidity', color: 'text-gray-400' }
      default:
        return { bg: 'bg-[#1a1a1a] border-[#262626]', icon: '⏳', text: 'Loading...', color: 'text-[#9ca3af]' }
    }
  }

  const info = getStatusInfo()

  return (
    <div className={`mb-6 p-4 rounded-xl border ${info.bg}`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-xl">{info.icon}</span>
          <div>
            <span className={`font-medium ${info.color}`}>KUSD {info.text}</span>
            {deviation !== null && (
              <span className="text-[#9ca3af] text-sm ml-2">
                ({deviation >= 0 ? '+' : ''}{deviation.toFixed(2)}%)
              </span>
            )}
          </div>
        </div>
        <div className="text-right">
          <span className={`text-2xl font-bold ${info.color}`}>
            ${price?.toFixed(4) || '-.----'}
          </span>
          <p className="text-xs text-[#6b7280]">KalySwap Price</p>
        </div>
      </div>
    </div>
  )
}

// DSR Section
function DSRSection({ dsrPosition }: { dsrPosition: DSRPosition }) {
  const balance = Number(formatWAD(dsrPosition.balance))
  const earnings = Number(formatWAD(dsrPosition.earnings))

  // Calculate projected earnings
  const dailyEarnings = balance * (dsrPosition.apy / 100 / 365)
  const monthlyEarnings = balance * (dsrPosition.apy / 100 / 12)
  const yearlyEarnings = balance * (dsrPosition.apy / 100)

  return (
    <div className="mb-8">
      <h2 className="text-2xl font-bold text-white mb-4">KUSD Savings</h2>
      <div className="bg-gradient-to-r from-green-900/20 to-[#1a1a1a] border border-green-500/30 rounded-xl p-6">
        <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-6">
          <div className="flex-1">
            <p className="text-sm text-[#9ca3af] mb-1">DSR Balance</p>
            <p className="text-3xl font-bold text-white">
              {balance.toLocaleString('en-US', { maximumFractionDigits: 4 })} KUSD
            </p>
            <p className="text-sm text-green-400 mb-4">
              +{earnings.toFixed(4)} KUSD earned • {dsrPosition.apy.toFixed(2)}% APY
            </p>

            {/* Projected Earnings */}
            {balance > 0 && (
              <div className="grid grid-cols-3 gap-4 pt-4 border-t border-green-500/20">
                <div>
                  <p className="text-xs text-[#6b7280]">Daily</p>
                  <p className="text-sm text-green-400 font-medium">+{dailyEarnings.toFixed(4)}</p>
                </div>
                <div>
                  <p className="text-xs text-[#6b7280]">Monthly</p>
                  <p className="text-sm text-green-400 font-medium">+{monthlyEarnings.toFixed(2)}</p>
                </div>
                <div>
                  <p className="text-xs text-[#6b7280]">Yearly</p>
                  <p className="text-sm text-green-400 font-medium">+{yearlyEarnings.toFixed(2)}</p>
                </div>
              </div>
            )}
          </div>
          <div className="flex gap-3">
            <Link
              href="/dsr"
              className="px-6 py-3 bg-green-600 hover:bg-green-700 text-white font-bold rounded-lg transition-colors"
            >
              Deposit More
            </Link>
            <Link
              href="/dsr"
              className="px-6 py-3 bg-[#262626] hover:bg-[#333] text-white rounded-lg transition-colors"
            >
              Withdraw
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}

// Vault Card for active positions
function VaultCard({ vault }: { vault: VaultPosition }) {
  const collateral = Number(formatWAD(vault.collateral))
  const collateralValue = Number(formatWAD(vault.collateralValue))
  const debt = Number(formatWAD(vault.totalDebt))
  // healthFactor is in WAD (from wadDiv of RAY/RAY), not RAY
  const healthFactor = Number(formatWAD(vault.healthFactor))
  const liquidationPrice = Number(formatWAD(vault.liquidationPrice))
  const collateralRatio = Number(formatRAY(vault.collateralRatio)) * 100

  const healthColor = healthFactor >= 2 ? 'text-green-400' : healthFactor >= 1.5 ? 'text-yellow-400' : 'text-red-400'
  const healthBg = healthFactor >= 2 ? 'bg-green-500' : healthFactor >= 1.5 ? 'bg-yellow-500' : 'bg-red-500'
  const symbol = vault.collateralType.split('-')[0]

  return (
    <div className={`bg-[#1a1a1a] border rounded-xl p-6 ${vault.isSafe ? 'border-[#262626]' : 'border-red-500/50'}`}>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <CollateralIcon symbol={symbol} size={28} />
          <h3 className="text-lg font-bold text-white">{vault.collateralType}</h3>
        </div>
        <HealthBadge healthFactor={healthFactor} />
      </div>

      <div className="space-y-3">
        <div className="flex justify-between text-sm">
          <span className="text-[#9ca3af]">Collateral</span>
          <span className="text-white">{collateral.toFixed(4)} {symbol}</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-[#9ca3af]">Value</span>
          <span className="text-white">${collateralValue.toLocaleString('en-US', { maximumFractionDigits: 2 })}</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-[#9ca3af]">Debt</span>
          <span className="text-white">{debt.toFixed(2)} KUSD</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-[#9ca3af]">Collateral Ratio</span>
          <span className={healthColor}>{collateralRatio.toFixed(0)}%</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-[#9ca3af]">Liq. Price</span>
          <span className="text-[#f59e0b]">${liquidationPrice.toFixed(2)}</span>
        </div>
      </div>

      <div className="mt-4 pt-4 border-t border-[#262626] flex gap-2">
        <Link href="/borrow" className="flex-1 px-3 py-2 bg-[#262626] hover:bg-[#333] text-white text-sm rounded-lg text-center transition-colors">
          Manage
        </Link>
        <Link href="/deposit" className="flex-1 px-3 py-2 bg-[#f59e0b] hover:bg-[#d97706] text-black text-sm font-bold rounded-lg text-center transition-colors">
          Add Collateral
        </Link>
      </div>
    </div>
  )
}

// Health Badge
function HealthBadge({ healthFactor }: { healthFactor: number }) {
  const color = healthFactor >= 2 ? 'bg-green-500/20 text-green-400 border-green-500/30'
    : healthFactor >= 1.5 ? 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30'
    : 'bg-red-500/20 text-red-400 border-red-500/30'
  const label = healthFactor >= 2 ? 'Healthy' : healthFactor >= 1.5 ? 'Caution' : 'At Risk'

  return (
    <span className={`px-2 py-1 text-xs font-medium rounded border ${color}`}>
      {label} ({healthFactor.toFixed(2)})
    </span>
  )
}

// Collateral Type Card (for available collaterals)
function CollateralTypeCard({ vault }: { vault: VaultPosition }) {
  const symbol = vault.collateralType.split('-')[0]
  const hasPosition = vault.hasPosition

  return (
    <Link
      href="/borrow"
      className={`block p-4 rounded-xl border transition-all hover:border-[#f59e0b]/50 ${
        hasPosition
          ? 'bg-[#1a1a1a] border-[#f59e0b]/30'
          : 'bg-[#1a1a1a] border-[#262626]'
      }`}
    >
      <div className="flex items-center gap-3 mb-2">
        <CollateralIcon symbol={symbol} size={28} />
        <span className="font-bold text-white">{symbol}</span>
      </div>
      <p className="text-xs text-[#9ca3af]">
        {hasPosition ? 'Active vault' : 'Open vault'}
      </p>
    </Link>
  )
}

// Quick Actions Section
function QuickActionsSection() {
  return (
    <div className="mb-8">
      <h2 className="text-xl font-bold text-white mb-4">Quick Actions</h2>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <ActionCard
          title="Open Vault"
          description="Deposit collateral and mint KUSD"
          href="/borrow"
          icon="🏦"
          color="amber"
        />
        <ActionCard
          title="Earn Savings"
          description="Deposit KUSD and earn interest"
          href="/dsr"
          icon="💰"
          color="green"
        />
        <ActionCard
          title="Bid on Auctions"
          description="Get discounted collateral"
          href="/auctions"
          icon="🔨"
          color="purple"
        />
        <ActionCard
          title="Wrap KLC"
          description="Convert your KLC to sKLC"
          href="/wrap"
          icon="🔄"
          color="blue"
        />
      </div>
    </div>
  )
}

function ActionCard({
  title, description, href, icon, color
}: {
  title: string; description: string; href: string; icon: string; color: 'amber' | 'green' | 'purple' | 'blue'
}) {
  const colorClasses = {
    amber: 'hover:border-[#f59e0b]/50 hover:bg-[#f59e0b]/5',
    green: 'hover:border-green-500/50 hover:bg-green-500/5',
    purple: 'hover:border-purple-500/50 hover:bg-purple-500/5',
    blue: 'hover:border-blue-500/50 hover:bg-blue-500/5',
  }

  return (
    <Link
      href={href}
      className={`block p-6 bg-[#1a1a1a] border border-[#262626] rounded-xl transition-all ${colorClasses[color]}`}
    >
      <span className="text-3xl mb-3 block">{icon}</span>
      <h3 className="font-bold text-white mb-1">{title}</h3>
      <p className="text-sm text-[#9ca3af]">{description}</p>
    </Link>
  )
}

// Collateral Icon Component
function CollateralIcon({ symbol, size = 24 }: { symbol: string; size?: number }) {
  const iconMap: Record<string, string> = {
    'WBTC': '/icons/wbtc.svg',
    'WETH': '/icons/weth.svg',
    'USDT': '/icons/usdt.svg',
    'USDC': '/icons/usdc.svg',
    'DAI': '/icons/dai.svg',
    'KUSD': '/icons/kusd.svg',
  }

  const iconPath = iconMap[symbol]

  if (iconPath) {
    return (
      <Image
        src={iconPath}
        alt={symbol}
        width={size}
        height={size}
        className="rounded-full"
      />
    )
  }

  // Fallback for tokens without icons
  return (
    <div
      className="rounded-full bg-[#262626] flex items-center justify-center text-xs font-bold text-white"
      style={{ width: size, height: size }}
    >
      {symbol.charAt(0)}
    </div>
  )
}
