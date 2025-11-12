/**
 * Contract Type Definitions
 * 
 * TypeScript types for contract data structures.
 */

import { type Address } from 'viem'

/**
 * Vat (CDP Engine) Types
 */

export interface Urn {
  ink: bigint  // Locked collateral
  art: bigint  // Normalized debt
}

export interface Ilk {
  Art: bigint   // Total normalized debt
  rate: bigint  // Accumulated rate (RAY)
  spot: bigint  // Price with safety margin (RAY)
  line: bigint  // Debt ceiling (RAD)
  dust: bigint  // Minimum debt (RAD)
}

/**
 * Spotter (Oracle) Types
 */

export interface SpotIlk {
  pip: Address  // Oracle address
  mat: bigint   // Liquidation ratio (RAY)
}

/**
 * Pot (DSR) Types
 */

export interface PotData {
  pie: bigint   // User's DSR deposit
  Pie: bigint   // Total DSR deposits
  dsr: bigint   // DSR rate (RAY)
  chi: bigint   // DSR accumulator (RAY)
  rho: bigint   // Last drip timestamp
}

/**
 * Clipper (Collateral Auction) Types
 */

export interface Sale {
  pos: bigint   // Index in active auctions array
  tab: bigint   // KUSD to raise (RAD)
  lot: bigint   // Collateral for sale (WAD)
  usr: Address  // Liquidated CDP owner
  tic: bigint   // Auction start time
  top: bigint   // Starting price (RAY)
}

export interface AuctionStatus {
  needsRedo: boolean  // Whether auction needs reset
  price: bigint       // Current price (RAY)
  lot: bigint         // Collateral available (WAD)
  tab: bigint         // KUSD to raise (RAD)
}

/**
 * Flapper (Surplus Auction) Types
 */

export interface FlapBid {
  bid: bigint   // sKLC bid amount (WAD)
  lot: bigint   // KUSD lot size (RAD)
  guy: Address  // High bidder
  tic: bigint   // Bid expiry time
  end: bigint   // Auction end time
}

/**
 * Flopper (Debt Auction) Types
 */

export interface FlopBid {
  bid: bigint   // KUSD bid amount (RAD)
  lot: bigint   // sKLC lot size (WAD)
  guy: Address  // High bidder
  tic: bigint   // Bid expiry time
  end: bigint   // Auction end time
}

/**
 * Transaction Status Types
 */

export interface TransactionStatus {
  hash?: `0x${string}`
  isPending: boolean
  isConfirming: boolean
  isSuccess: boolean
  error: Error | null
}

/**
 * Token Types
 */

export interface TokenInfo {
  address: Address
  symbol: string
  name: string
  decimals: number
  logoURI?: string
}

export interface TokenBalance {
  token: TokenInfo
  balance: bigint
  formattedBalance: string
}

/**
 * Collateral Types
 */

export type CollateralSymbol = 'WBTC' | 'WETH' | 'USDT' | 'USDC' | 'DAI'
export type CollateralVariant = 'A' | 'B' | 'C'
export type CollateralIlk = `${CollateralSymbol}-${CollateralVariant}`

/**
 * Network Types
 */

export interface NetworkConfig {
  chainId: number
  name: string
  rpcUrl: string
  blockExplorer: string
  nativeCurrency: {
    name: string
    symbol: string
    decimals: number
  }
}

/**
 * Contract Address Types
 */

export interface CoreContracts {
  vat: Address
  kusd: Address
  sklc: Address
  spotter: Address
  jug: Address
  pot: Address
  dog: Address
  vow: Address
  flapper: Address
  flopper: Address
  end: Address
  cure: Address
  kusdJoin: Address
}

export interface CollateralContracts {
  token: Address
  join: Address
  clipper: Address
  oracle: Address
}

/**
 * Oracle Types
 */

export interface OraclePrice {
  value: bigint     // Price in WAD
  timestamp: bigint // Last update timestamp
  isValid: boolean  // Whether price is valid
}

/**
 * System State Types
 */

export interface SystemState {
  globalDebt: bigint        // Total system debt (RAD)
  globalDebtCeiling: bigint // Global debt ceiling (RAD)
  surplusBuffer: bigint     // Surplus buffer (RAD)
  debtQueueSize: bigint     // Debt queue size
  isLive: boolean           // Whether system is live
}

/**
 * Governance Types
 */

export interface GovernanceAction {
  target: Address
  signature: string
  calldata: `0x${string}`
  eta: bigint
  executed: boolean
}

