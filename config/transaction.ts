import { APP_CHAIN_ID } from './networks'

// Gas settings for KUSD write transactions on KalyChain.
//
// KalyChain (Besu) reports baseFee ~7 wei and eth_maxPriorityFeePerGas = 0, so any wallet
// that ESTIMATES fees — or that is handed a legacy `gasPrice` hint (which the thirdweb
// in-app / social-login wallet DROPS on this EIP-1559 chain) — ends up underpriced. We pin
// EXPLICIT EIP-1559 fees at the chain's working floor: validators prioritise a 21 gwei tip,
// and below it inclusion is a lottery (seconds vs. 40+ minutes; the 3890 RPC rejects
// underpriced transactions outright). These are KalySwap's values (src/config/gas.ts):
// maxFee sits just above the tip because gas limit x maxFee is the wallet's spend ceiling.
//
// chainId pins every write to the app's chain (NEXT_PUBLIC_NETWORK): wagmi refuses to sign
// when the wallet is on another chain instead of sending the transaction there.
export const TRANSACTION_GAS_CONFIG = {
  gas: 300000n, // per-write default; each hook overrides with its own gas limit
  maxFeePerGas: 26_000_000_000n, // 26 gwei
  maxPriorityFeePerGas: 21_000_000_000n, // 21 gwei
  chainId: APP_CHAIN_ID,
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
