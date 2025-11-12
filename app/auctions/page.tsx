'use client'

import { useState, useEffect } from 'react'
import { useAccount, useChainId } from 'wagmi'
import { formatUnits } from 'viem'
import Navigation from '@/components/Navigation'
import { useFlapper, useFlopper, useClipper, useSKLC, useVat } from '@/hooks'
import { formatWAD, formatRAD, parseWAD } from '@/lib'
import { type CollateralType } from '@/config/contracts'

type AuctionType = 'surplus' | 'debt' | 'collateral'

interface FlapperAuction {
  id: bigint
  lot: bigint  // KUSD amount
  bid: bigint  // sKLC bid
  guy: string  // Current high bidder
  tic: bigint  // Bid expiry time
  end: bigint  // Auction end time
}

interface FlopperAuction {
  id: bigint
  bid: bigint  // KUSD bid (fixed)
  lot: bigint  // sKLC amount (decreasing)
  guy: string  // Current high bidder
  tic: bigint  // Bid expiry time
  end: bigint  // Auction end time
}

interface ClipperAuction {
  id: bigint
  pos: bigint  // Index in active array
  tab: bigint  // KUSD to raise
  lot: bigint  // Collateral amount
  usr: string  // Vault owner
  tic: bigint  // Auction start time
  top: bigint  // Starting price
}

const collateralTypes: CollateralType[] = ['WBTC-A', 'WETH-A', 'USDT-A', 'USDC-A', 'DAI-A']
const collateralSymbols: Record<CollateralType, string> = {
  'WBTC-A': 'WBTC',
  'WETH-A': 'WETH',
  'USDT-A': 'USDT',
  'USDC-A': 'USDC',
  'DAI-A': 'DAI',
}

export default function AuctionsPage() {
  const { address } = useAccount()
  const chainId = useChainId()
  const [activeTab, setActiveTab] = useState<AuctionType>('collateral')
  const [selectedCollateral, setSelectedCollateral] = useState<CollateralType>('WBTC-A')
  const [flapperAuctions, setFlapperAuctions] = useState<FlapperAuction[]>([])
  const [flopperAuctions, setFlopperAuctions] = useState<FlopperAuction[]>([])
  const [clipperAuctions, setClipperAuctions] = useState<ClipperAuction[]>([])
  const [bidAmounts, setBidAmounts] = useState<Record<string, string>>({})

  // Flapper (Surplus Auctions)
  const flapper = useFlapper(chainId || 3889)
  const { data: flapKicks } = flapper.useKicks()

  // Flopper (Debt Auctions)
  const flopper = useFlopper(chainId || 3889)
  const { data: flopKicks } = flopper.useKicks()

  // Clipper (Collateral Auctions)
  const clipper = useClipper(chainId || 3889, selectedCollateral)
  const { data: clipKicks } = clipper.useKicks()

  // sKLC token (for Flapper/Flopper bidding)
  const sklc = useSKLC(chainId || 3889)
  const { data: sklcBalance } = sklc.useBalance(address)
  const { data: sklcAllowanceFlapper } = sklc.useAllowance(address, flapper.address)
  const { data: sklcAllowanceFlopper } = sklc.useAllowance(address, flopper.address)

  // Vat (for KUSD balance and approvals)
  const vat = useVat(chainId || 3889)
  const { data: vatKusd } = vat.useKusd(address)
  const { data: vatCanFlapper } = vat.useCan(address, flapper.address)
  const { data: vatCanClipper } = vat.useCan(address, clipper.address)

  // Fetch most recent auction for each type
  const { data: latestFlapBid } = flapper.useBid(typeof flapKicks === 'bigint' && flapKicks > 0n ? flapKicks : undefined)
  const { data: latestFlopBid } = flopper.useBid(typeof flopKicks === 'bigint' && flopKicks > 0n ? flopKicks : undefined)
  const { data: latestClipSale } = clipper.useSale(typeof clipKicks === 'bigint' && clipKicks > 0n ? clipKicks : undefined)

  // Approval hooks
  const { approve: approveSklcFlapper, isPending: isApprovingSklcFlapper } = sklc.useApprove()
  const { approve: approveSklcFlopper, isPending: isApprovingSklcFlopper } = sklc.useApprove()
  const { hope: hopeFlapper, isPending: isHopingFlapper } = vat.useHope()
  const { hope: hopeClipper, isPending: isHopingClipper } = vat.useHope()

  // Bidding hooks
  const { tend, isPending: isTendPending, isConfirming: isTendConfirming, isSuccess: isTendSuccess } = flapper.useTend()
  const { dent, isPending: isDentPending, isConfirming: isDentConfirming, isSuccess: isDentSuccess } = flopper.useDent()
  const { take, isPending: isTakePending, isConfirming: isTakeConfirming, isSuccess: isTakeSuccess } = clipper.useTake()

  // Deal hooks (claim won auctions)
  const { deal: dealFlapper, isPending: isDealFlapPending } = flapper.useDeal()
  const { deal: dealFlopper, isPending: isDealFlopPending } = flopper.useDeal()

  // Get total auction counts
  const totalFlapAuctions = flapKicks ? Number(flapKicks) : 0
  const totalFlopAuctions = flopKicks ? Number(flopKicks) : 0
  const totalClipAuctions = clipKicks ? Number(clipKicks) : 0

  // Handlers
  const handleApproveSklcFlapper = () => {
    const maxUint = BigInt('0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff')
    approveSklcFlapper(flapper.address, maxUint)
  }

  const handleApproveSklcFlopper = () => {
    const maxUint = BigInt('0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff')
    approveSklcFlopper(flopper.address, maxUint)
  }

  const handleHopeFlapper = () => {
    hopeFlapper(flapper.address)
  }

  const handleHopeClipper = () => {
    hopeClipper(clipper.address)
  }

  const handleTendBid = (auctionId: bigint, lot: bigint) => {
    const bidAmount = bidAmounts[`flap-${auctionId}`]
    if (!bidAmount) return

    const bidWad = parseWAD(bidAmount)
    console.log('Placing Flapper bid:', { auctionId, lot, bid: bidWad })
    tend(auctionId, lot, bidWad)
  }

  const handleDentBid = (auctionId: bigint, currentBid: bigint) => {
    const lotAmount = bidAmounts[`flop-${auctionId}`]
    if (!lotAmount) return

    const lotWad = parseWAD(lotAmount)
    console.log('Placing Flopper bid:', { auctionId, lot: lotWad, bid: currentBid })
    dent(auctionId, lotWad, currentBid)
  }

  const handleTakeBid = (auctionId: bigint) => {
    const amount = bidAmounts[`clip-${auctionId}`]
    if (!amount || !address) return

    const amtWad = parseWAD(amount)
    const maxPrice = BigInt('0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff') // Max price
    console.log('Taking from Clipper:', { auctionId, amt: amtWad, maxPrice, recipient: address })
    take(auctionId, amtWad, maxPrice, address, '0x')
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0a0a0a] via-[#1a0f00] to-[#0a0a0a]">
      <Navigation />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-white mb-4">
            KUSD Auctions
          </h1>
          <p className="text-[#9ca3af] text-lg">
            Participate in surplus, debt, and collateral liquidation auctions
          </p>
        </div>

        {/* Auction Type Tabs */}
        <div className="flex bg-[#1a1a1a] backdrop-blur-sm border border-[#262626] rounded-xl p-1 mb-8 max-w-2xl mx-auto">
          <button
            onClick={() => setActiveTab('surplus')}
            className={`flex-1 py-3 px-4 rounded-lg text-sm font-medium transition-colors ${
              activeTab === 'surplus'
                ? 'bg-[#F59E0B] text-white'
                : 'text-[#6b7280] hover:text-white'
            }`}
          >
            <div>Surplus (Flapper)</div>
            <div className="text-xs mt-1 opacity-75">{totalFlapAuctions} active</div>
          </button>
          <button
            onClick={() => setActiveTab('debt')}
            className={`flex-1 py-3 px-4 rounded-lg text-sm font-medium transition-colors ${
              activeTab === 'debt'
                ? 'bg-[#F59E0B] text-white'
                : 'text-[#6b7280] hover:text-white'
            }`}
          >
            <div>Debt (Flopper)</div>
            <div className="text-xs mt-1 opacity-75">{totalFlopAuctions} active</div>
          </button>
          <button
            onClick={() => setActiveTab('collateral')}
            className={`flex-1 py-3 px-4 rounded-lg text-sm font-medium transition-colors ${
              activeTab === 'collateral'
                ? 'bg-[#F59E0B] text-white'
                : 'text-[#6b7280] hover:text-white'
            }`}
          >
            <div>Collateral (Clipper)</div>
            <div className="text-xs mt-1 opacity-75">{totalClipAuctions} active</div>
          </button>
        </div>

        {/* Auction Info */}
        <div className="bg-orange-900/20 border border-[#F59E0B]/30 rounded-xl p-6 mb-8 max-w-4xl mx-auto">
          {activeTab === 'surplus' && (
            <div>
              <h3 className="text-white font-semibold mb-2">Surplus Auctions (Flapper)</h3>
              <p className="text-[#9ca3af] text-sm">
                When the system has excess KUSD, it's auctioned off for sKLC (wrapped KLC). Bid sKLC to buy KUSD at a discount.
              </p>
            </div>
          )}
          {activeTab === 'debt' && (
            <div>
              <h3 className="text-white font-semibold mb-2">Debt Auctions (Flopper)</h3>
              <p className="text-[#9ca3af] text-sm">
                When the system has bad debt, new sKLC is minted and auctioned for KUSD. Bid KUSD to buy newly minted sKLC.
              </p>
            </div>
          )}
          {activeTab === 'collateral' && (
            <div>
              <h3 className="text-white font-semibold mb-2">Collateral Auctions (Clipper)</h3>
              <p className="text-[#9ca3af] text-sm">
                Liquidated collateral from undercollateralized vaults is auctioned off for KUSD. Buy collateral at a discount using KUSD.
              </p>
              {/* Collateral selector */}
              <div className="mt-4">
                <label className="text-[#9ca3af] text-xs mb-2 block">Select Collateral Type:</label>
                <select
                  value={selectedCollateral}
                  onChange={(e) => setSelectedCollateral(e.target.value as CollateralType)}
                  className="bg-[#0a0a0a]/50 border border-[#262626] rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-[#F59E0B]"
                >
                  {collateralTypes.map((type) => (
                    <option key={type} value={type}>
                      {collateralSymbols[type]}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          )}
        </div>

        {/* Active Auctions */}
        <div className="max-w-4xl mx-auto">
          <h2 className="text-2xl font-bold text-white mb-6">
            Active {activeTab === 'surplus' ? 'Surplus' : activeTab === 'debt' ? 'Debt' : 'Collateral'} Auctions
          </h2>

          {/* Auction Stats */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <div className="bg-[#1a1a1a] backdrop-blur-sm border border-[#262626] rounded-xl p-4">
              <div className="text-[#6b7280] text-sm mb-1">Total Auctions</div>
              <div className="text-white font-bold text-2xl">
                {activeTab === 'surplus' ? totalFlapAuctions :
                 activeTab === 'debt' ? totalFlopAuctions :
                 totalClipAuctions}
              </div>
            </div>
            <div className="bg-[#1a1a1a] backdrop-blur-sm border border-[#262626] rounded-xl p-4">
              <div className="text-[#6b7280] text-sm mb-1">Contract Address</div>
              <div className="text-white font-mono text-xs truncate">
                {activeTab === 'surplus' ? flapper.address :
                 activeTab === 'debt' ? flopper.address :
                 clipper.address}
              </div>
            </div>
            <div className="bg-[#1a1a1a] backdrop-blur-sm border border-[#262626] rounded-xl p-4">
              <div className="text-[#6b7280] text-sm mb-1">Status</div>
              <div className="text-[#22C55E] font-semibold">Active</div>
            </div>
          </div>

          {/* Surplus Auctions (Flapper) */}
          {activeTab === 'surplus' && (
            <div>
              {!address ? (
                <div className="bg-[#1a1a1a] backdrop-blur-sm border border-[#262626] rounded-2xl p-12 text-center">
                  <div className="text-[#6b7280] text-lg">Connect your wallet to view and bid on auctions</div>
                </div>
              ) : totalFlapAuctions === 0 ? (
                <div className="bg-[#1a1a1a] backdrop-blur-sm border border-[#262626] rounded-2xl p-12 text-center">
                  <div className="text-[#6b7280] text-lg">No active surplus auctions</div>
                  <p className="text-[#6b7280] text-sm mt-2">Surplus auctions start when the system has excess KUSD</p>
                </div>
              ) : latestFlapBid && typeof latestFlapBid === 'object' && latestFlapBid !== null && 'lot' in latestFlapBid && typeof latestFlapBid.lot === 'bigint' && latestFlapBid.lot > 0n ? (
                <div className="space-y-4">
                  <div className="bg-[#1a1a1a] backdrop-blur-sm border border-[#262626] rounded-2xl p-6">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-white font-bold text-lg">Auction #{flapKicks?.toString()}</h3>
                      {(latestFlapBid as any).guy === address && (
                        <span className="px-3 py-1 bg-green-900/50 border border-green-500/50 rounded-full text-green-400 text-xs font-medium">
                          You're winning!
                        </span>
                      )}
                    </div>

                    <div className="grid grid-cols-2 gap-4 mb-4">
                      <div>
                        <div className="text-[#6b7280] text-sm mb-1">KUSD Lot</div>
                        <div className="text-white font-medium">{formatWAD((latestFlapBid as any).lot, 18)} KUSD</div>
                      </div>
                      <div>
                        <div className="text-[#6b7280] text-sm mb-1">Current Bid</div>
                        <div className="text-white font-medium">
                          {(latestFlapBid as any).bid > 0n ? `${formatWAD((latestFlapBid as any).bid, 18)} sKLC` : 'No bids yet'}
                        </div>
                      </div>
                    </div>

                    {/* Approval Section */}
                    {!sklcAllowanceFlapper || sklcAllowanceFlapper === 0n ? (
                      <div className="bg-orange-900/20 border border-[#F59E0B]/30 rounded-lg p-4 mb-4">
                        <p className="text-[#FBBF24] text-sm mb-2">You need to approve sKLC spending first</p>
                        <button
                          onClick={handleApproveSklcFlapper}
                          disabled={isApprovingSklcFlapper}
                          className="bg-[#F59E0B] hover:bg-[#D97706] text-white font-semibold px-4 py-2 rounded-lg transition-all disabled:opacity-50"
                        >
                          {isApprovingSklcFlapper ? 'Approving...' : 'Approve sKLC'}
                        </button>
                      </div>
                    ) : (
                      <div className="flex gap-2">
                        <input
                          type="number"
                          step="0.01"
                          value={bidAmounts[`flap-${flapKicks}`] || ''}
                          onChange={(e) => setBidAmounts({ ...bidAmounts, [`flap-${flapKicks}`]: e.target.value })}
                          placeholder="sKLC bid amount"
                          className="flex-1 bg-[#0a0a0a]/50 border border-[#262626] rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-[#F59E0B]"
                        />
                        <button
                          onClick={() => flapKicks && typeof flapKicks === 'bigint' && handleTendBid(flapKicks, (latestFlapBid as any).lot)}
                          disabled={isTendPending || isTendConfirming || !bidAmounts[`flap-${flapKicks}`]}
                          className="bg-gradient-to-r from-[#F59E0B] to-[#D97706] hover:from-[#D97706] hover:to-[#B45309] text-white font-semibold px-6 py-2 rounded-lg transition-all disabled:opacity-50"
                        >
                          {isTendPending ? 'Confirm...' : isTendConfirming ? 'Bidding...' : 'Place Bid'}
                        </button>
                      </div>
                    )}

                    <div className="mt-4 text-xs text-[#6b7280]">
                      Your sKLC Balance: {sklcBalance && typeof sklcBalance === 'bigint' ? formatWAD(sklcBalance, 18) : '0.00'} sKLC
                    </div>
                  </div>
                </div>
              ) : (
                <div className="bg-[#1a1a1a] backdrop-blur-sm border border-[#262626] rounded-2xl p-12 text-center">
                  <div className="text-[#6b7280] text-lg">Auction has ended or been settled</div>
                </div>
              )}
            </div>
          )}
          {/* Debt Auctions (Flopper) */}
          {activeTab === 'debt' && (
            <div>
              {!address ? (
                <div className="bg-[#1a1a1a] backdrop-blur-sm border border-[#262626] rounded-2xl p-12 text-center">
                  <div className="text-[#6b7280] text-lg">Connect your wallet to view and bid on auctions</div>
                </div>
              ) : totalFlopAuctions === 0 ? (
                <div className="bg-[#1a1a1a] backdrop-blur-sm border border-[#262626] rounded-2xl p-12 text-center">
                  <div className="text-[#6b7280] text-lg">No active debt auctions</div>
                  <p className="text-[#6b7280] text-sm mt-2">Debt auctions start when the system has bad debt to cover</p>
                </div>
              ) : latestFlopBid && typeof latestFlopBid === 'object' && latestFlopBid !== null && 'bid' in latestFlopBid && typeof latestFlopBid.bid === 'bigint' && latestFlopBid.bid > 0n ? (
                <div className="space-y-4">
                  <div className="bg-[#1a1a1a] backdrop-blur-sm border border-[#262626] rounded-2xl p-6">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-white font-bold text-lg">Auction #{flopKicks?.toString()}</h3>
                      {(latestFlopBid as any).guy === address && (
                        <span className="px-3 py-1 bg-green-900/50 border border-green-500/50 rounded-full text-green-400 text-xs font-medium">
                          You're winning!
                        </span>
                      )}
                    </div>

                    <div className="grid grid-cols-2 gap-4 mb-4">
                      <div>
                        <div className="text-[#6b7280] text-sm mb-1">KUSD Bid (Fixed)</div>
                        <div className="text-white font-medium">{formatWAD((latestFlopBid as any).bid, 18)} KUSD</div>
                      </div>
                      <div>
                        <div className="text-[#6b7280] text-sm mb-1">sKLC Lot (Decreasing)</div>
                        <div className="text-white font-medium">{formatWAD((latestFlopBid as any).lot, 18)} sKLC</div>
                      </div>
                    </div>

                    {/* Approval Section */}
                    {!vatCanFlapper || vatCanFlapper === 0n ? (
                      <div className="bg-orange-900/20 border border-[#F59E0B]/30 rounded-lg p-4 mb-4">
                        <p className="text-[#FBBF24] text-sm mb-2">You need to approve Vat KUSD spending first</p>
                        <button
                          onClick={handleHopeFlapper}
                          disabled={isHopingFlapper}
                          className="bg-[#F59E0B] hover:bg-[#D97706] text-white font-semibold px-4 py-2 rounded-lg transition-all disabled:opacity-50"
                        >
                          {isHopingFlapper ? 'Approving...' : 'Approve Vat KUSD'}
                        </button>
                      </div>
                    ) : (
                      <div className="flex gap-2">
                        <input
                          type="number"
                          step="0.01"
                          value={bidAmounts[`flop-${flopKicks}`] || ''}
                          onChange={(e) => setBidAmounts({ ...bidAmounts, [`flop-${flopKicks}`]: e.target.value })}
                          placeholder="sKLC lot amount (lower to win)"
                          className="flex-1 bg-[#0a0a0a]/50 border border-[#262626] rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-[#F59E0B]"
                        />
                        <button
                          onClick={() => flopKicks && typeof flopKicks === 'bigint' && handleDentBid(flopKicks, (latestFlopBid as any).bid)}
                          disabled={isDentPending || isDentConfirming || !bidAmounts[`flop-${flopKicks}`]}
                          className="bg-gradient-to-r from-[#F59E0B] to-[#D97706] hover:from-[#D97706] hover:to-[#B45309] text-white font-semibold px-6 py-2 rounded-lg transition-all disabled:opacity-50"
                        >
                          {isDentPending ? 'Confirm...' : isDentConfirming ? 'Bidding...' : 'Place Bid'}
                        </button>
                      </div>
                    )}

                    <div className="mt-4 text-xs text-[#6b7280]">
                      Your Vat KUSD: {vatKusd && typeof vatKusd === 'bigint' ? formatRAD(vatKusd) : '0.00'} KUSD
                    </div>
                  </div>
                </div>
              ) : (
                <div className="bg-[#1a1a1a] backdrop-blur-sm border border-[#262626] rounded-2xl p-12 text-center">
                  <div className="text-[#6b7280] text-lg">Auction has ended or been settled</div>
                </div>
              )}
            </div>
          )}

          {/* Collateral Auctions (Clipper) */}
          {activeTab === 'collateral' && (
            <div>
              {!address ? (
                <div className="bg-[#1a1a1a] backdrop-blur-sm border border-[#262626] rounded-2xl p-12 text-center">
                  <div className="text-[#6b7280] text-lg">Connect your wallet to view and bid on auctions</div>
                </div>
              ) : totalClipAuctions === 0 ? (
                <div className="bg-[#1a1a1a] backdrop-blur-sm border border-[#262626] rounded-2xl p-12 text-center">
                  <div className="text-[#6b7280] text-lg">No active {collateralSymbols[selectedCollateral]} auctions</div>
                  <p className="text-[#6b7280] text-sm mt-2">Collateral auctions start when vaults are liquidated</p>
                </div>
              ) : latestClipSale && typeof latestClipSale === 'object' && latestClipSale !== null && 'lot' in latestClipSale && typeof latestClipSale.lot === 'bigint' && latestClipSale.lot > 0n ? (
                <div className="space-y-4">
                  <div className="bg-[#1a1a1a] backdrop-blur-sm border border-[#262626] rounded-2xl p-6">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-white font-bold text-lg">Auction #{clipKicks?.toString()}</h3>
                      <span className="px-3 py-1 bg-blue-900/50 border border-blue-500/50 rounded-full text-blue-400 text-xs font-medium">
                        {collateralSymbols[selectedCollateral]}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-4 mb-4">
                      <div>
                        <div className="text-[#6b7280] text-sm mb-1">Collateral Available</div>
                        <div className="text-white font-medium">{formatWAD((latestClipSale as any).lot, 18)} {collateralSymbols[selectedCollateral]}</div>
                      </div>
                      <div>
                        <div className="text-[#6b7280] text-sm mb-1">KUSD to Raise</div>
                        <div className="text-white font-medium">{formatRAD((latestClipSale as any).tab)} KUSD</div>
                      </div>
                    </div>

                    {/* Approval Section */}
                    {!vatCanClipper || vatCanClipper === 0n ? (
                      <div className="bg-orange-900/20 border border-[#F59E0B]/30 rounded-lg p-4 mb-4">
                        <p className="text-[#FBBF24] text-sm mb-2">You need to approve Vat KUSD spending first</p>
                        <button
                          onClick={handleHopeClipper}
                          disabled={isHopingClipper}
                          className="bg-[#F59E0B] hover:bg-[#D97706] text-white font-semibold px-4 py-2 rounded-lg transition-all disabled:opacity-50"
                        >
                          {isHopingClipper ? 'Approving...' : 'Approve Vat KUSD'}
                        </button>
                      </div>
                    ) : (
                      <div className="flex gap-2">
                        <input
                          type="number"
                          step="0.01"
                          value={bidAmounts[`clip-${clipKicks}`] || ''}
                          onChange={(e) => setBidAmounts({ ...bidAmounts, [`clip-${clipKicks}`]: e.target.value })}
                          placeholder={`${collateralSymbols[selectedCollateral]} amount to buy`}
                          className="flex-1 bg-[#0a0a0a]/50 border border-[#262626] rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-[#F59E0B]"
                        />
                        <button
                          onClick={() => clipKicks && typeof clipKicks === 'bigint' && handleTakeBid(clipKicks)}
                          disabled={isTakePending || isTakeConfirming || !bidAmounts[`clip-${clipKicks}`]}
                          className="bg-gradient-to-r from-[#F59E0B] to-[#D97706] hover:from-[#D97706] hover:to-[#B45309] text-white font-semibold px-6 py-2 rounded-lg transition-all disabled:opacity-50"
                        >
                          {isTakePending ? 'Confirm...' : isTakeConfirming ? 'Buying...' : 'Buy Collateral'}
                        </button>
                      </div>
                    )}

                    <div className="mt-4 text-xs text-[#6b7280]">
                      Your Vat KUSD: {vatKusd && typeof vatKusd === 'bigint' ? formatRAD(vatKusd) : '0.00'} KUSD
                    </div>
                  </div>
                </div>
              ) : (
                <div className="bg-[#1a1a1a] backdrop-blur-sm border border-[#262626] rounded-2xl p-12 text-center">
                  <div className="text-[#6b7280] text-lg">Auction has ended or been settled</div>
                </div>
              )}
            </div>
          )}
        </div>
      </main>
    </div>
  )
}

