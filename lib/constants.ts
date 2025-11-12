/**
 * DeFi Math Constants
 * 
 * MakerDAO DSS uses fixed-point arithmetic with different precision levels:
 * - WAD: 18 decimals (10^18) - Used for basic quantities
 * - RAY: 27 decimals (10^27) - Used for precise rates and ratios
 * - RAD: 45 decimals (10^45) - Used for high-precision calculations
 */

// Precision constants
export const WAD = 10n ** 18n  // 1e18 - 18 decimal precision
export const RAY = 10n ** 27n  // 1e27 - 27 decimal precision
export const RAD = 10n ** 45n  // 1e45 - 45 decimal precision

// Numeric constants for calculations
export const ZERO = 0n
export const ONE_WAD = WAD
export const ONE_RAY = RAY
export const ONE_RAD = RAD

/**
 * Collateral Type Identifiers (ilk)
 * 
 * These are bytes32 representations of collateral types.
 * Format: "TOKEN-VARIANT" padded to 32 bytes
 * 
 * Example: "WBTC-A" -> 0x574254432d41000000000000000000000000000000000000000000000000000
 */

// Helper function to convert string to bytes32 hex
export function stringToBytes32(str: string): `0x${string}` {
  // Pad string to 32 bytes
  const padded = str.padEnd(32, '\0')
  const hex = Array.from(padded)
    .map(char => char.charCodeAt(0).toString(16).padStart(2, '0'))
    .join('')
  return `0x${hex}` as `0x${string}`
}

// Collateral type identifiers
export const ILK_WBTC_A = stringToBytes32('WBTC-A')
export const ILK_WETH_A = stringToBytes32('WETH-A')
export const ILK_USDT_A = stringToBytes32('USDT-A')
export const ILK_USDC_A = stringToBytes32('USDC-A')
export const ILK_DAI_A = stringToBytes32('DAI-A')

// Map collateral symbols to ilk identifiers
export const COLLATERAL_ILKS: Record<string, `0x${string}`> = {
  'WBTC-A': ILK_WBTC_A,
  'WETH-A': ILK_WETH_A,
  'USDT-A': ILK_USDT_A,
  'USDC-A': ILK_USDC_A,
  'DAI-A': ILK_DAI_A,
}

// Reverse mapping: ilk to symbol
export const ILK_TO_SYMBOL: Record<string, string> = {
  [ILK_WBTC_A]: 'WBTC-A',
  [ILK_WETH_A]: 'WETH-A',
  [ILK_USDT_A]: 'USDT-A',
  [ILK_USDC_A]: 'USDC-A',
  [ILK_DAI_A]: 'DAI-A',
}

/**
 * Token Decimals
 * 
 * Different tokens use different decimal precision
 */
export const TOKEN_DECIMALS: Record<string, number> = {
  'WBTC': 8,
  'WETH': 18,
  'USDT': 6,
  'USDC': 6,
  'DAI': 18,
  'KUSD': 18,
  'sKLC': 18,
  'KLC': 18,
}

/**
 * Minimum Values
 */
export const MIN_VAULT_AMOUNT = 100n * WAD  // 100 KUSD minimum

/**
 * Time Constants
 */
export const SECONDS_PER_YEAR = 365n * 24n * 60n * 60n  // 31,536,000 seconds

/**
 * Percentage Constants (in basis points)
 */
export const BPS_BASE = 10000n  // 100% = 10,000 basis points
export const PERCENT_BASE = 100n

/**
 * Default Values
 */
export const DEFAULT_SLIPPAGE_BPS = 50n  // 0.5% slippage tolerance
export const DEFAULT_DEADLINE_MINUTES = 20n  // 20 minutes transaction deadline

