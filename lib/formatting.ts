/**
 * Formatting Utilities
 * 
 * Functions for formatting numbers, currencies, and blockchain values
 * for display in the UI.
 */

import { formatUnits, parseUnits } from 'viem'
import { WAD, RAY, RAD, TOKEN_DECIMALS } from './constants'

/**
 * Format WAD values (18 decimals) to human-readable strings
 */
export function formatWAD(value: bigint, decimals: number = 2): string {
  const formatted = formatUnits(value, 18)
  return parseFloat(formatted).toFixed(decimals)
}

/**
 * Format RAY values (27 decimals) to human-readable strings
 */
export function formatRAY(value: bigint, decimals: number = 4): string {
  const formatted = formatUnits(value, 27)
  return parseFloat(formatted).toFixed(decimals)
}

/**
 * Format RAD values (45 decimals) to human-readable strings
 */
export function formatRAD(value: bigint, decimals: number = 2): string {
  const formatted = formatUnits(value, 45)
  return parseFloat(formatted).toFixed(decimals)
}

/**
 * Parse human-readable string to WAD
 */
export function parseWAD(value: string): bigint {
  return parseUnits(value, 18)
}

/**
 * Parse human-readable string to RAY
 */
export function parseRAY(value: string): bigint {
  return parseUnits(value, 27)
}

/**
 * Parse human-readable string to RAD
 */
export function parseRAD(value: string): bigint {
  return parseUnits(value, 45)
}

/**
 * Format token amount based on token decimals
 */
export function formatTokenAmount(
  value: bigint,
  tokenSymbol: string,
  displayDecimals: number = 2
): string {
  const decimals = TOKEN_DECIMALS[tokenSymbol] || 18
  const formatted = formatUnits(value, decimals)
  return parseFloat(formatted).toFixed(displayDecimals)
}

/**
 * Parse token amount based on token decimals
 */
export function parseTokenAmount(value: string, tokenSymbol: string): bigint {
  const decimals = TOKEN_DECIMALS[tokenSymbol] || 18
  return parseUnits(value, decimals)
}

/**
 * Format as USD currency
 */
export function formatCurrency(value: string | number, decimals: number = 2): string {
  const numValue = typeof value === 'string' ? parseFloat(value) : value
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(numValue)
}

/**
 * Format bigint as USD currency
 */
export function formatCurrencyFromWAD(value: bigint, decimals: number = 2): string {
  const formatted = formatWAD(value, decimals)
  return formatCurrency(formatted, decimals)
}

/**
 * Format percentage
 */
export function formatPercent(value: number, decimals: number = 2): string {
  return `${value.toFixed(decimals)}%`
}

/**
 * Format percentage from basis points
 */
export function formatPercentFromBps(bps: bigint, decimals: number = 2): string {
  const percent = Number(bps) / 100
  return formatPercent(percent, decimals)
}

/**
 * Format percentage from RAY (stability fee rate)
 * 
 * Stability fees are stored as RAY values representing the per-second rate.
 * We need to convert to APY for display.
 */
export function formatAPYFromRate(rate: bigint, decimals: number = 2): string {
  // Convert RAY rate to decimal
  const rateDecimal = Number(rate) / Number(RAY)
  
  // Calculate APY: (rate ^ seconds_per_year) - 1
  const secondsPerYear = 365.25 * 24 * 60 * 60
  const apy = (Math.pow(rateDecimal, secondsPerYear) - 1) * 100
  
  return formatPercent(apy, decimals)
}

/**
 * Format collateral ratio
 */
export function formatCollateralRatio(ratio: bigint, decimals: number = 2): string {
  // Ratio is in basis points (15000 = 150%)
  const percent = Number(ratio) / 100
  return formatPercent(percent, decimals)
}

/**
 * Format large numbers with abbreviations (K, M, B)
 */
export function formatCompact(value: number): string {
  const absValue = Math.abs(value)
  
  if (absValue >= 1e9) {
    return `${(value / 1e9).toFixed(2)}B`
  }
  if (absValue >= 1e6) {
    return `${(value / 1e6).toFixed(2)}M`
  }
  if (absValue >= 1e3) {
    return `${(value / 1e3).toFixed(2)}K`
  }
  
  return value.toFixed(2)
}

/**
 * Format large bigint with abbreviations
 */
export function formatCompactFromWAD(value: bigint): string {
  const formatted = formatWAD(value, 2)
  return formatCompact(parseFloat(formatted))
}

/**
 * Format address (truncate middle)
 */
export function formatAddress(address: string, startChars: number = 6, endChars: number = 4): string {
  if (address.length <= startChars + endChars) return address
  return `${address.slice(0, startChars)}...${address.slice(-endChars)}`
}

/**
 * Format transaction hash
 */
export function formatTxHash(hash: string): string {
  return formatAddress(hash, 10, 8)
}

/**
 * Format time duration
 */
export function formatDuration(seconds: number): string {
  const days = Math.floor(seconds / 86400)
  const hours = Math.floor((seconds % 86400) / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  
  if (days > 0) {
    return `${days}d ${hours}h`
  }
  if (hours > 0) {
    return `${hours}h ${minutes}m`
  }
  return `${minutes}m`
}

/**
 * Format timestamp to date string
 */
export function formatDate(timestamp: number): string {
  return new Date(timestamp * 1000).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

/**
 * Format timestamp to date and time string
 */
export function formatDateTime(timestamp: number): string {
  return new Date(timestamp * 1000).toLocaleString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

/**
 * Format number with thousands separators
 */
export function formatNumber(value: number, decimals: number = 2): string {
  return new Intl.NumberFormat('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value)
}

/**
 * Format bigint with thousands separators
 */
export function formatNumberFromWAD(value: bigint, decimals: number = 2): string {
  const formatted = formatWAD(value, decimals)
  return formatNumber(parseFloat(formatted), decimals)
}

/**
 * Truncate decimal places without rounding
 */
export function truncateDecimals(value: string, decimals: number): string {
  const parts = value.split('.')
  if (parts.length === 1) return value
  
  const truncated = parts[1].slice(0, decimals)
  return `${parts[0]}.${truncated}`
}

/**
 * Format input value (remove leading zeros, limit decimals)
 */
export function formatInputValue(value: string, maxDecimals: number = 18): string {
  // Remove non-numeric characters except decimal point
  let cleaned = value.replace(/[^\d.]/g, '')
  
  // Only allow one decimal point
  const parts = cleaned.split('.')
  if (parts.length > 2) {
    cleaned = `${parts[0]}.${parts.slice(1).join('')}`
  }
  
  // Limit decimal places
  if (parts.length === 2 && parts[1].length > maxDecimals) {
    cleaned = `${parts[0]}.${parts[1].slice(0, maxDecimals)}`
  }
  
  // Remove leading zeros (except for "0.")
  if (cleaned.startsWith('0') && !cleaned.startsWith('0.') && cleaned.length > 1) {
    cleaned = cleaned.replace(/^0+/, '')
  }
  
  return cleaned
}

