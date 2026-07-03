// Gas settings for KUSD write transactions on KalyChain.
//
// KalyChain (Besu) reports baseFee ~7 wei and eth_maxPriorityFeePerGas = 0, so any wallet
// that ESTIMATES fees — or that is handed a legacy `gasPrice` hint (which the thirdweb
// in-app / social-login wallet DROPS on this EIP-1559 chain) — ends up underpriced and the
// transaction sits PENDING forever. We therefore pin EXPLICIT EIP-1559 fees, matching the
// exact values KalyDAO / KalySwap / kaly-vault already use on this same chain with the same
// in-app wallet (30 gwei / 3 gwei). See KalyDAO/KalyDAO/src/blockchain/config/transaction.ts
// and kaly-vault/src/lib/chain/writes.ts.
export const TRANSACTION_GAS_CONFIG = {
  gas: 300000n, // per-write default; each hook overrides with its own gas limit
  maxFeePerGas: 30_000_000_000n, // 30 gwei
  maxPriorityFeePerGas: 3_000_000_000n, // 3 gwei
} as const

// Gas settings for contract interactions.
export const getTransactionGasConfig = () => TRANSACTION_GAS_CONFIG

// Gas settings with optional overrides (e.g. a per-call `gas` limit).
// Overrides are typed as plain `bigint` (not the `as const` literals) so each hook
// can pass its own gas limit — e.g. `{ gas: 5000000n }`.
export const getTransactionGasConfigWithOverrides = (
  overrides?: { gas?: bigint; maxFeePerGas?: bigint; maxPriorityFeePerGas?: bigint },
) => ({
  ...TRANSACTION_GAS_CONFIG,
  ...overrides,
})
