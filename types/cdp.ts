/**
 * CDP (Vault) Type Definitions
 * 
 * TypeScript types for CDP positions and operations.
 */

import { type Address } from 'viem'
import { type CollateralIlk } from './contracts'

/**
 * CDP Position
 */

export interface CDPPosition {
  // Identity
  owner: Address
  ilk: CollateralIlk
  
  // Collateral
  collateral: bigint           // Locked collateral (WAD)
  collateralValue: bigint      // Collateral value in USD (WAD)
  
  // Debt
  normalizedDebt: bigint       // Normalized debt (WAD)
  totalDebt: bigint            // Total debt including fees (WAD)
  accruedFees: bigint          // Accrued stability fees (WAD)
  
  // Ratios and Prices
  collateralRatio: bigint      // Current collateral ratio (WAD)
  liquidationRatio: bigint     // Liquidation ratio (RAY)
  liquidationPrice: bigint     // Liquidation price (WAD)
  currentPrice: bigint         // Current collateral price (WAD)
  
  // Health
  healthFactor: bigint         // Health factor (WAD)
  isSafe: boolean              // Whether position is safe
  isLiquidatable: boolean      // Whether position can be liquidated
  
  // Limits
  maxMint: bigint              // Max KUSD that can be minted (WAD)
  maxWithdraw: bigint          // Max collateral that can be withdrawn (WAD)
  minDebt: bigint              // Minimum debt requirement (RAD)
  
  // Status
  hasPosition: boolean         // Whether position exists
  isLoading: boolean           // Whether data is loading
}

/**
 * CDP Action Types
 */

export type CDPActionType = 
  | 'deposit'      // Deposit collateral
  | 'withdraw'     // Withdraw collateral
  | 'mint'         // Mint KUSD (draw debt)
  | 'repay'        // Repay KUSD (wipe debt)
  | 'depositAndMint'   // Deposit collateral and mint KUSD
  | 'repayAndWithdraw' // Repay KUSD and withdraw collateral

export interface CDPAction {
  type: CDPActionType
  collateralAmount?: bigint
  debtAmount?: bigint
}

/**
 * CDP Transaction
 */

export interface CDPTransaction {
  hash: `0x${string}`
  type: CDPActionType
  collateralAmount?: bigint
  debtAmount?: bigint
  timestamp: number
  status: 'pending' | 'confirmed' | 'failed'
  blockNumber?: number
}

/**
 * CDP Summary (for list views)
 */

export interface CDPSummary {
  owner: Address
  ilk: CollateralIlk
  collateral: bigint
  debt: bigint
  collateralRatio: bigint
  healthFactor: bigint
  isSafe: boolean
}

/**
 * Collateral Type Info
 */

export interface CollateralTypeInfo {
  ilk: CollateralIlk
  symbol: string
  name: string
  decimals: number
  
  // Addresses
  tokenAddress: Address
  joinAddress: Address
  clipperAddress: Address
  oracleAddress: Address
  
  // Parameters
  liquidationRatio: bigint     // Liquidation ratio (RAY)
  stabilityFee: bigint         // Stability fee rate (RAY)
  debtCeiling: bigint          // Debt ceiling (RAD)
  debtFloor: bigint            // Minimum debt (RAD)
  
  // Current state
  totalDebt: bigint            // Total debt for this collateral type (RAD)
  currentPrice: bigint         // Current price (WAD)
  
  // UI
  logoURI?: string
  color?: string
}

/**
 * CDP Operation Result
 */

export interface CDPOperationResult {
  success: boolean
  hash?: `0x${string}`
  error?: string
  
  // Updated position (if successful)
  newCollateral?: bigint
  newDebt?: bigint
  newCollateralRatio?: bigint
  newHealthFactor?: bigint
}

/**
 * CDP Validation
 */

export interface CDPValidation {
  isValid: boolean
  errors: string[]
  warnings: string[]
}

export interface DepositValidation extends CDPValidation {
  hasBalance: boolean
  hasAllowance: boolean
  meetsMinimum: boolean
}

export interface WithdrawValidation extends CDPValidation {
  hasCollateral: boolean
  remainsSafe: boolean
  meetsMinDebt: boolean
}

export interface MintValidation extends CDPValidation {
  hasCollateral: boolean
  withinDebtCeiling: boolean
  meetsMinDebt: boolean
  remainsSafe: boolean
}

export interface RepayValidation extends CDPValidation {
  hasBalance: boolean
  hasAllowance: boolean
  hasDebt: boolean
}

/**
 * DSR (KUSD Savings Rate) Types
 */

export interface DSRPosition {
  owner: Address
  deposit: bigint              // Deposited amount (WAD)
  currentValue: bigint         // Current value with earnings (WAD)
  earnings: bigint             // Total earnings (WAD)
  apy: number                  // Current APY (percentage)
  isLoading: boolean
}

export interface DSRAction {
  type: 'deposit' | 'withdraw' | 'withdrawAll'
  amount?: bigint
}

/**
 * Auction Types
 */

export interface CollateralAuction {
  id: bigint
  ilk: CollateralIlk
  collateralAmount: bigint     // Collateral for sale (WAD)
  debtToRaise: bigint          // KUSD to raise (RAD)
  currentPrice: bigint         // Current price (RAY)
  startPrice: bigint           // Starting price (RAY)
  startTime: bigint            // Auction start timestamp
  owner: Address               // Liquidated CDP owner
  isActive: boolean
  needsRedo: boolean
}

export interface SurplusAuction {
  id: bigint
  kusdAmount: bigint           // KUSD lot size (RAD)
  sklcBid: bigint              // Current sKLC bid (WAD)
  bidder: Address              // Current high bidder
  bidExpiry: bigint            // Bid expiry timestamp
  auctionEnd: bigint           // Auction end timestamp
  isActive: boolean
}

export interface DebtAuction {
  id: bigint
  kusdBid: bigint              // Current KUSD bid (RAD)
  sklcAmount: bigint           // sKLC lot size (WAD)
  bidder: Address              // Current high bidder
  bidExpiry: bigint            // Bid expiry timestamp
  auctionEnd: bigint           // Auction end timestamp
  isActive: boolean
}

/**
 * User Portfolio
 */

export interface UserPortfolio {
  address: Address
  
  // Balances
  klcBalance: bigint
  sklcBalance: bigint
  kusdBalance: bigint
  
  // CDPs
  cdps: CDPSummary[]
  totalCollateralValue: bigint
  totalDebt: bigint
  
  // DSR
  dsrDeposit: bigint
  dsrValue: bigint
  dsrEarnings: bigint
  
  // Overall health
  overallCollateralRatio: bigint
  overallHealthFactor: bigint
  isHealthy: boolean
}

