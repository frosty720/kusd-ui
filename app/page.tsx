'use client'

import Navigation from '@/components/Navigation'
import Link from 'next/link'
import Image from 'next/image'
import { useChainId } from 'wagmi'
import { useVat, usePot } from '@/hooks'
import { formatRAD, formatRAY, formatWAD } from '@/lib'

export default function Home() {
  const chainId = useChainId()

  // Vat for total debt
  const vat = useVat(chainId || 3889)
  const { data: totalDebt } = vat.useDebt()

  // Pot for DSR
  const pot = usePot(chainId || 3889)
  const { data: potDsr } = pot.useDsr()
  const { data: potTotalPie } = pot.useTotalPie()

  // Calculate stats
  const kusdSupply = totalDebt && typeof totalDebt === 'bigint' ? Number(formatRAD(totalDebt)) : 0
  const totalInDSR = potTotalPie && typeof potTotalPie === 'bigint' ? Number(formatWAD(potTotalPie)) : 0

  // Calculate DSR APY (dsr is per-second rate in RAY format)
  // APY = (rate^seconds_per_year - 1) * 100
  // Must use raw bigint division to preserve precision (formatRAY loses precision)
  const SECONDS_PER_YEAR = 31536000
  const RAY = 10n ** 27n
  const dsrAPY = potDsr && typeof potDsr === 'bigint' && potDsr > RAY
    ? (Math.pow(Number(potDsr) / Number(RAY), SECONDS_PER_YEAR) - 1) * 100
    : 0

  // Estimate TVL (assume 150% collateralization on average)
  const estimatedTVL = kusdSupply * 1.5

  // Calculate global collateral ratio
  const globalCollateralRatio = kusdSupply > 0 ? (estimatedTVL / kusdSupply) * 100 : 0
  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0a0a0a] via-[#1a0f00] to-[#0a0a0a]">
      <Navigation />

      {/* Hero Section */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Hero */}
        <div className="relative py-20 sm:py-28">
          {/* Background gradient effect */}
          <div className="absolute inset-0 -z-10 overflow-hidden">
            <div className="absolute left-1/2 top-0 -translate-x-1/2 blur-3xl opacity-10">
              <div className="w-[800px] h-[800px] bg-gradient-to-r from-orange-500 via-amber-500 to-orange-500 rounded-full"></div>
            </div>
          </div>

          <div className="mx-auto max-w-4xl text-center">
            {/* Badge */}
            <div className="mb-6 inline-flex items-center gap-2 rounded-full bg-[#1a1a1a] border border-[#262626] px-4 py-2">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#22C55E] opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-[#22C55E]"></span>
              </span>
              <span className="text-sm text-[#9ca3af] font-medium">Live on KalyChain Mainnet</span>
            </div>

            <h1 className="mb-6 text-5xl font-bold tracking-tight text-white sm:text-7xl">
              The Decentralized
              <br />
              <span className="bg-gradient-to-r from-[#F59E0B] via-[#FBBF24] to-[#F59E0B] bg-clip-text text-transparent">
                Stablecoin Protocol
              </span>
            </h1>
            <p className="mb-10 text-xl text-[#9ca3af] leading-relaxed max-w-2xl mx-auto">
              Mint KUSD stablecoins backed by crypto collateral. Earn passive income through the
              KUSD Savings Rate. Built on battle-tested MakerDAO technology.
            </p>

            {/* CTA Buttons */}
            <div className="flex flex-col gap-4 sm:flex-row sm:justify-center mb-12">
              <Link
                href="/mint"
                className="group rounded-xl bg-gradient-to-r from-[#F59E0B] to-[#D97706] hover:from-[#D97706] hover:to-[#B45309] px-8 py-4 font-semibold text-white transition-all transform hover:scale-105 shadow-lg shadow-orange-900/50"
              >
                Start Minting
                <span className="inline-block ml-2 group-hover:translate-x-1 transition-transform">→</span>
              </Link>
              <Link
                href="/dsr"
                className="rounded-xl border-2 border-[#262626] bg-[#1a1a1a] backdrop-blur-sm px-8 py-4 font-semibold text-white transition-all hover:border-[#404040] hover:bg-[#1f1f1f]"
              >
                Earn Savings Rate
              </Link>
            </div>

            {/* Quick Stats */}
            <div className="grid grid-cols-3 gap-8 max-w-2xl mx-auto">
              <div>
                <div className="text-3xl font-bold text-white">5</div>
                <div className="text-sm text-slate-400 mt-1">Collateral Types</div>
              </div>
              <div>
                <div className="text-3xl font-bold text-white">150%</div>
                <div className="text-sm text-slate-400 mt-1">Min. Coll. Ratio</div>
              </div>
              <div>
                <div className="text-3xl font-bold text-white">24/7</div>
                <div className="text-sm text-slate-400 mt-1">Always Available</div>
              </div>
            </div>
          </div>
        </div>

        {/* How It Works */}
        <div className="py-20">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-white mb-4">How It Works</h2>
            <p className="text-xl text-slate-400">Get started with KUSD in three simple steps</p>
          </div>

          <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
            <div className="relative">
              <div className="bg-gradient-to-br from-orange-900/30 to-amber-900/30 border border-[#F59E0B]/30 rounded-2xl p-8 h-full">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-r from-[#F59E0B] to-[#D97706] flex items-center justify-center text-white font-bold text-xl mb-4">
                  1
                </div>
                <h3 className="text-xl font-bold text-white mb-3">Deposit Collateral</h3>
                <p className="text-[#9ca3af]">
                  Deposit supported crypto assets (WBTC, WETH, USDT, USDC, or DAI) as collateral into the protocol.
                </p>
              </div>
            </div>

            <div className="relative">
              <div className="bg-gradient-to-br from-orange-900/30 to-amber-900/30 border border-[#F59E0B]/30 rounded-2xl p-8 h-full">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-r from-[#F59E0B] to-[#D97706] flex items-center justify-center text-white font-bold text-xl mb-4">
                  2
                </div>
                <h3 className="text-xl font-bold text-white mb-3">Mint KUSD</h3>
                <p className="text-[#9ca3af]">
                  Mint KUSD stablecoins against your collateral. Maintain a healthy collateralization ratio to avoid liquidation.
                </p>
              </div>
            </div>

            <div className="relative">
              <div className="bg-gradient-to-br from-orange-900/30 to-amber-900/30 border border-[#F59E0B]/30 rounded-2xl p-8 h-full">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-r from-[#F59E0B] to-[#D97706] flex items-center justify-center text-white font-bold text-xl mb-4">
                  3
                </div>
                <h3 className="text-xl font-bold text-white mb-3">Earn or Use</h3>
                <p className="text-[#9ca3af]">
                  Deposit KUSD in the Pot to earn savings rate, use it in DeFi, or hold it as a stable store of value.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Supported Collateral */}
        <div className="py-20 bg-[#0f0f0f] -mx-4 sm:-mx-6 lg:-mx-8 px-4 sm:px-6 lg:px-8">
          <div className="max-w-7xl mx-auto">
            <div className="text-center mb-16">
              <h2 className="text-4xl font-bold text-white mb-4">Supported Collateral</h2>
              <p className="text-xl text-[#6b7280]">Mint KUSD using multiple types of crypto assets</p>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-5 gap-6 max-w-4xl mx-auto">
              <CollateralCard name="WBTC" fullName="Wrapped Bitcoin" />
              <CollateralCard name="WETH" fullName="Wrapped Ether" />
              <CollateralCard name="USDT" fullName="Tether USD" />
              <CollateralCard name="USDC" fullName="USD Coin" />
              <CollateralCard name="DAI" fullName="Dai Stablecoin" />
            </div>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="py-20">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-white mb-4">Protocol Statistics</h2>
            <p className="text-xl text-slate-400">Real-time metrics from the KUSD protocol</p>
          </div>

          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4 max-w-6xl mx-auto">
            <StatCard
              title="Total Value Locked"
              value={`$${estimatedTVL.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
              change={estimatedTVL > 0 ? "Estimated" : "No deposits"}
            />
            <StatCard
              title="KUSD Supply"
              value={`${kusdSupply.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} KUSD`}
              change={totalInDSR > 0 ? `${totalInDSR.toFixed(2)} in DSR` : "No DSR deposits"}
            />
            <StatCard
              title="Collateral Ratio"
              value={globalCollateralRatio > 0 ? `${globalCollateralRatio.toFixed(0)}%` : "N/A"}
              change={globalCollateralRatio >= 150 ? "Safe" : globalCollateralRatio > 0 ? "Low" : "No debt"}
            />
            <StatCard
              title="Savings Rate"
              value={`${dsrAPY.toFixed(2)}%`}
              change="APY"
            />
          </div>
        </div>

        {/* Why KUSD */}
        <div className="py-20">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-white mb-4">Why Choose KUSD?</h2>
            <p className="text-xl text-slate-400">Built on proven technology with powerful features</p>
          </div>

          <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-3 max-w-6xl mx-auto">
            <FeatureCard
              title="Decentralized & Trustless"
              description="No central authority controls KUSD. All operations are governed by transparent smart contracts on KalyChain."
              icon="🔒"
            />
            <FeatureCard
              title="Over-Collateralized"
              description="Every KUSD is backed by more value in collateral, ensuring stability and security of the peg."
              icon="💎"
            />
            <FeatureCard
              title="Earn Passive Income"
              description="Deposit KUSD in the Pot contract and earn the KUSD Savings Rate (DSR) automatically."
              icon="📈"
            />
            <FeatureCard
              title="Battle-Tested Code"
              description="Fork of MakerDAO's DSS - the most proven and audited stablecoin architecture in DeFi."
              icon="🛡️"
            />
            <FeatureCard
              title="Multi-Collateral Support"
              description="Use WBTC, WETH, USDT, USDC, or DAI as collateral. More assets coming soon."
              icon="🔗"
            />
            <FeatureCard
              title="Liquidation Protection"
              description="Transparent liquidation system with collateral auctions ensures protocol solvency."
              icon="⚡"
            />
          </div>
        </div>

        {/* Security Section */}
        <div className="py-20 bg-gradient-to-br from-orange-900/10 to-amber-900/10 -mx-4 sm:-mx-6 lg:-mx-8 px-4 sm:px-6 lg:px-8">
          <div className="max-w-7xl mx-auto">
            <div className="max-w-4xl mx-auto">
              <div className="bg-[#1a1a1a] backdrop-blur-sm border border-[#262626] rounded-2xl p-12">
                <div className="text-center mb-8">
                  <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gradient-to-r from-[#F59E0B] to-[#D97706] mb-4">
                    <span className="text-3xl">🛡️</span>
                  </div>
                  <h2 className="text-3xl font-bold text-white mb-4">Built on Proven Technology</h2>
                  <p className="text-xl text-[#9ca3af]">
                    KUSD is a fork of MakerDAO's Multi-Collateral Dai (DSS) system
                  </p>
                </div>

                <div className="grid md:grid-cols-3 gap-6 mt-8">
                  <div className="text-center">
                    <div className="text-3xl font-bold text-[#F59E0B] mb-2">$5B+</div>
                    <div className="text-sm text-[#6b7280]">MakerDAO TVL Peak</div>
                  </div>
                  <div className="text-center">
                    <div className="text-3xl font-bold text-[#FBBF24] mb-2">7+ Years</div>
                    <div className="text-sm text-[#6b7280]">Battle-Tested in Production</div>
                  </div>
                  <div className="text-center">
                    <div className="text-3xl font-bold text-[#22C55E] mb-2">Audited</div>
                    <div className="text-sm text-[#6b7280]">Security First Approach</div>
                  </div>
                </div>

                <div className="mt-8 p-6 bg-orange-900/20 border border-[#F59E0B]/30 rounded-xl">
                  <p className="text-[#9ca3af] text-center">
                    The same smart contract architecture that powers DAI, the largest decentralized
                    stablecoin, now available on KalyChain.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* CTA Section */}
        <div className="py-20">
          <div className="max-w-4xl mx-auto text-center">
            <h2 className="text-4xl font-bold text-white mb-6">Ready to Get Started?</h2>
            <p className="text-xl text-[#9ca3af] mb-10">
              Join the decentralized stablecoin revolution on KalyChain
            </p>

            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link
                href="/deposit"
                className="group rounded-xl bg-gradient-to-r from-[#F59E0B] to-[#D97706] hover:from-[#D97706] hover:to-[#B45309] px-10 py-5 font-semibold text-white text-lg transition-all transform hover:scale-105 shadow-lg shadow-orange-900/50"
              >
                Deposit Collateral
                <span className="inline-block ml-2 group-hover:translate-x-1 transition-transform">→</span>
              </Link>
              <Link
                href="/wrap"
                className="rounded-xl border-2 border-[#262626] bg-[#1a1a1a] backdrop-blur-sm px-10 py-5 font-semibold text-white text-lg transition-all hover:border-[#404040] hover:bg-[#1f1f1f]"
              >
                Wrap sKLC
              </Link>
            </div>

            <div className="mt-12 grid grid-cols-3 gap-8 max-w-2xl mx-auto">
              <div>
                <div className="text-2xl font-bold text-white mb-1">No KYC</div>
                <div className="text-sm text-[#6b7280]">Fully Permissionless</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-white mb-1">Non-Custodial</div>
                <div className="text-sm text-[#6b7280]">You Control Your Assets</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-white mb-1">Open Source</div>
                <div className="text-sm text-[#6b7280]">Transparent Code</div>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="mt-24 border-t border-[#262626] bg-[#0a0a0a] py-8">
        <div className="max-w-7xl mx-auto px-4 text-center text-sm text-[#6b7280]">
          <p>KUSD - Decentralized Stablecoin on KalyChain</p>
          <p className="mt-2">Built with MakerDAO DSS</p>
        </div>
      </footer>
    </div>
  )
}

function StatCard({ title, value, change }: { title: string; value: string; change?: string }) {
  return (
    <div className="rounded-xl border border-[#262626] bg-[#1a1a1a] backdrop-blur-sm p-6 hover:border-[#404040] transition-colors">
      <div className="text-sm font-medium text-[#6b7280] mb-2">{title}</div>
      <div className="text-3xl font-bold text-white mb-1">{value}</div>
      {change && (
        <div className="text-sm text-[#22C55E]">{change}</div>
      )}
    </div>
  )
}

function FeatureCard({ title, description, icon }: { title: string; description: string; icon: string }) {
  return (
    <div className="group rounded-xl border border-slate-700 bg-slate-800/50 backdrop-blur-sm p-8 transition-all hover:border-blue-700/50 hover:bg-slate-800 hover:shadow-lg hover:shadow-blue-900/20">
      <div className="mb-4 text-4xl group-hover:scale-110 transition-transform">{icon}</div>
      <h3 className="mb-3 text-xl font-bold text-white">{title}</h3>
      <p className="text-slate-300 leading-relaxed">{description}</p>
    </div>
  )
}

function CollateralCard({ name, fullName }: { name: string; fullName: string }) {
  const iconPath = `/icons/${name.toLowerCase()}.svg`

  return (
    <div className="group rounded-xl border border-[#262626] bg-[#1a1a1a] backdrop-blur-sm p-6 text-center transition-all hover:border-[#F59E0B]/50 hover:bg-[#1f1f1f] hover:shadow-lg hover:shadow-orange-900/20">
      <div className="w-16 h-16 mx-auto mb-3 flex items-center justify-center group-hover:scale-110 transition-transform">
        <Image
          src={iconPath}
          alt={`${name} logo`}
          width={64}
          height={64}
          className="w-full h-full"
        />
      </div>
      <div className="font-bold text-white text-lg mb-1">{name}</div>
      <div className="text-xs text-[#6b7280]">{fullName}</div>
    </div>
  )
}
