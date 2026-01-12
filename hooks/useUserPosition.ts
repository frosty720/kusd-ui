/**
 * User Position Hook
 * 
 * High-level hook that combines multiple contract reads to get
 * a complete view of a user's CDP position.
 */

import { type Address } from 'viem'
import { useVat } from './contracts/useVat'
import { useSpotter } from './contracts/useSpotter'
import { type CollateralType } from '@/config/contracts'
import { COLLATERAL_ILKS } from '@/lib/constants'
import {
  calculateCollateralRatio,
  calculateLiquidationPrice,
  calculateMaxMint,
  calculateMaxWithdraw,
  calculateHealthFactor,
  calculateTotalDebt,
} from '@/lib/calculations'
import { rayMul } from '@/lib/math'

export function useUserPosition(
  chainId: number,
  collateralType: CollateralType,
  userAddress: Address | undefined
) {
  const ilk = COLLATERAL_ILKS[collateralType]
  
  const vat = useVat(chainId)
  const spotter = useSpotter(chainId)
  
  // Get user's CDP (urn) data
  const { data: urnData, isLoading: urnLoading } = vat.useUrn(ilk, userAddress)
  
  // Get collateral type configuration
  const { data: ilkData, isLoading: ilkLoading } = vat.useIlk(ilk)
  
  // Get spot price configuration
  const { data: spotData, isLoading: spotLoading } = spotter.useIlk(ilk)
  
  const isLoading = urnLoading || ilkLoading || spotLoading
  
  // Parse data
  const collateral = urnData ? (urnData as any)[0] as bigint : 0n // ink
  const normalizedDebt = urnData ? (urnData as any)[1] as bigint : 0n // art
  
  const rate = ilkData ? (ilkData as any)[1] as bigint : 0n // Accumulated rate
  const spot = ilkData ? (ilkData as any)[2] as bigint : 0n // Spot price (with safety margin)
  const line = ilkData ? (ilkData as any)[3] as bigint : 0n // Debt ceiling
  const dust = ilkData ? (ilkData as any)[4] as bigint : 0n // Minimum debt
  
  const pip = spotData ? (spotData as any)[0] as Address : undefined // Oracle address
  const mat = spotData ? (spotData as any)[1] as bigint : 0n // Liquidation ratio
  
  // Calculate derived values
  const totalDebt = calculateTotalDebt(normalizedDebt, rate)
  
  // Get oracle price (spot includes safety margin, we need raw price)
  // price = spot * mat / RAY
  const price = mat > 0n ? rayMul(spot, mat) : 0n
  
  const collateralRatio = calculateCollateralRatio(collateral, price, totalDebt)
  const liquidationPrice = calculateLiquidationPrice(collateral, totalDebt, mat)
  const healthFactor = calculateHealthFactor(collateralRatio, mat)
  
  const maxMint = calculateMaxMint(
    collateral,
    price,
    mat,
    totalDebt,
    line,
    ilkData ? (ilkData as any)[0] as bigint : 0n // Total ilk debt (Art)
  )
  
  const maxWithdraw = calculateMaxWithdraw(collateral, totalDebt, price, mat)
  
  // Calculate collateral value in USD
  const collateralValue = collateral > 0n && price > 0n 
    ? (collateral * price) / 10n ** 27n 
    : 0n
  
  // Check if position is safe
  const isSafe = collateralRatio >= mat || totalDebt === 0n
  
  // Check if position exists
  const hasPosition = collateral > 0n || normalizedDebt > 0n
  
  return {
    // Raw data
    collateral,
    normalizedDebt,
    totalDebt,
    rate,
    spot,
    price,
    mat,
    line,
    dust,
    pip,
    
    // Calculated values
    collateralRatio,
    liquidationPrice,
    healthFactor,
    maxMint,
    maxWithdraw,
    collateralValue,
    
    // Status
    isSafe,
    hasPosition,
    isLoading,
  }
}

