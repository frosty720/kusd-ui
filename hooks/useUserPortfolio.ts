/**
 * User Portfolio Hook
 * 
 * Aggregates all user positions across all collateral types,
 * DSR savings, and calculates portfolio-wide metrics.
 */

import { type Address } from 'viem'
import { useUserPosition } from './useUserPosition'
import { usePot } from './contracts/usePot'
import { useVat } from './contracts/useVat'
import { type CollateralType } from '@/config/contracts'
import { RAY, TOKEN_DECIMALS } from '@/lib/constants'
import { formatRAY, formatWAD } from '@/lib/formatting'

// All supported collateral types
const COLLATERAL_TYPES: CollateralType[] = ['WBTC-A', 'WETH-A', 'USDT-A', 'USDC-A', 'DAI-A']

export interface VaultPosition {
  collateralType: CollateralType
  collateral: bigint
  collateralValue: bigint
  totalDebt: bigint
  healthFactor: bigint
  collateralRatio: bigint
  liquidationPrice: bigint
  isSafe: boolean
  hasPosition: boolean
  isLoading: boolean
}

export interface DSRPosition {
  deposited: bigint       // pie (normalized)
  balance: bigint         // pie * chi (actual KUSD value)
  earnings: bigint        // balance - deposited (estimated)
  apy: number             // Current APY
  isLoading: boolean
}

export interface PortfolioSummary {
  totalCollateralValue: bigint   // Sum of all collateral values in USD
  totalDebt: bigint              // Sum of all debts
  totalDSRBalance: bigint        // DSR balance
  netWorth: bigint               // Total collateral + DSR - debt
  overallHealthFactor: number    // Weighted average health
  vaultsAtRisk: number           // Count of vaults with low health
  activeVaults: number           // Count of vaults with positions
}

export function useUserPortfolio(chainId: number, userAddress: Address | undefined) {
  // Fetch all vault positions
  const wbtcPosition = useUserPosition(chainId, 'WBTC-A', userAddress)
  const wethPosition = useUserPosition(chainId, 'WETH-A', userAddress)
  const usdtPosition = useUserPosition(chainId, 'USDT-A', userAddress)
  const usdcPosition = useUserPosition(chainId, 'USDC-A', userAddress)
  const daiPosition = useUserPosition(chainId, 'DAI-A', userAddress)

  // DSR data
  const pot = usePot(chainId)
  const { data: userPie, isLoading: pieLoading } = pot.usePie(userAddress)
  const { data: chi, isLoading: chiLoading } = pot.useChi()
  const { data: dsr, isLoading: dsrLoading } = pot.useDsr()

  // KUSD wallet balance
  const vat = useVat(chainId)
  const { data: vatBalance } = vat.useKusd(userAddress)

  // Build vault positions array
  const vaults: VaultPosition[] = [
    { collateralType: 'WBTC-A', ...wbtcPosition },
    { collateralType: 'WETH-A', ...wethPosition },
    { collateralType: 'USDT-A', ...usdtPosition },
    { collateralType: 'USDC-A', ...usdcPosition },
    { collateralType: 'DAI-A', ...daiPosition },
  ]

  // Calculate DSR position
  const pie = userPie && typeof userPie === 'bigint' ? userPie : 0n
  const chiValue = chi && typeof chi === 'bigint' ? chi : RAY
  const dsrRate = dsr && typeof dsr === 'bigint' ? dsr : RAY
  
  // DSR balance = pie * chi / RAY
  const dsrBalance = (pie * chiValue) / RAY
  // NOTE: Earnings cannot be calculated accurately without deposit history.
  // The Pot contract only stores 'pie' (share count), not the original KUSD amount.
  // We would need chi_at_deposit_time to calculate: originalDeposit = pie * chi_at_deposit
  // Setting to 0 to avoid showing inaccurate numbers.
  const dsrEarnings = 0n
  
  // Calculate DSR APY: (rate^seconds_per_year - 1) * 100
  // Must use raw bigint division to preserve precision (formatRAY loses precision)
  const SECONDS_PER_YEAR = 31536000
  const dsrAPY = dsrRate > RAY
    ? (Math.pow(Number(dsrRate) / Number(RAY), SECONDS_PER_YEAR) - 1) * 100
    : 0

  const dsrPosition: DSRPosition = {
    deposited: pie,
    balance: dsrBalance,
    earnings: dsrEarnings,
    apy: dsrAPY,
    isLoading: pieLoading || chiLoading || dsrLoading,
  }

  // Calculate portfolio summary
  const activeVaults = vaults.filter(v => v.hasPosition)
  const vaultsAtRisk = vaults.filter(v => v.hasPosition && !v.isSafe)
  
  const totalCollateralValue = vaults.reduce((sum, v) => sum + v.collateralValue, 0n)
  const totalDebt = vaults.reduce((sum, v) => sum + v.totalDebt, 0n)
  
  // Calculate weighted average health factor
  // Note: healthFactor is in WAD (result of wadDiv on RAY/RAY)
  let weightedHealthSum = 0
  let totalWeight = 0
  for (const vault of activeVaults) {
    if (vault.totalDebt > 0n) {
      const weight = Number(formatWAD(vault.totalDebt))
      weightedHealthSum += Number(formatWAD(vault.healthFactor)) * weight
      totalWeight += weight
    }
  }
  const overallHealthFactor = totalWeight > 0 ? weightedHealthSum / totalWeight : 999

  const summary: PortfolioSummary = {
    totalCollateralValue,
    totalDebt,
    totalDSRBalance: dsrBalance,
    netWorth: totalCollateralValue + dsrBalance - totalDebt,
    overallHealthFactor,
    vaultsAtRisk: vaultsAtRisk.length,
    activeVaults: activeVaults.length,
  }

  const isLoading = vaults.some(v => v.isLoading) || dsrPosition.isLoading

  // KUSD in wallet (vat dai balance)
  const kusdWalletBalance = vatBalance && typeof vatBalance === 'bigint' ? vatBalance : 0n

  return {
    vaults,
    dsrPosition,
    summary,
    kusdWalletBalance,
    isLoading,
    COLLATERAL_TYPES,
  }
}

