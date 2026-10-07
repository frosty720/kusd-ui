/**
 * The message to show for a failed write. Ported from KalySwap's describeError: wallet and RPC errors
 * are recognised by their standard codes and phrases, and only the chain's own wording counts as a
 * revert (viem says "reverted with the following reason" for a wallet that refused to sign, too).
 */
import { TransactionRevertedError } from './kusdSteps'

/** An error the app raises itself, whose message is already written for the user. */
export class UserError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'UserError'
  }
}

/** Every text a wallet, viem or a node may carry, joined so one pattern test sees all of it. */
function rawText(error: unknown): string {
  if (typeof error === 'string') return error
  if (!error || typeof error !== 'object') return String(error)
  const e = error as { name?: unknown; shortMessage?: unknown; message?: unknown; details?: unknown; reason?: unknown; cause?: unknown }
  const parts = [e.name, e.shortMessage, e.message, e.details, e.reason].filter((p): p is string => typeof p === 'string')
  if (e.cause && e.cause !== error) parts.push(rawText(e.cause))
  return parts.join(' | ')
}

/** Only revert data the node returned (`raw`) proves the chain itself rejected the call. */
function isOnChainRevert(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false
  const e = error as { raw?: unknown; cause?: unknown }
  if (typeof e.raw === 'string' && e.raw.startsWith('0x')) return true
  return e.cause !== undefined && e.cause !== error && isOnChainRevert(e.cause)
}

/** The innermost error's own message, in one short line. */
function detailOf(error: unknown): string {
  if (typeof error === 'string') return error.trim().slice(0, 160)
  if (!error || typeof error !== 'object') return ''
  const e = error as { shortMessage?: unknown; details?: unknown; message?: unknown; reason?: unknown; cause?: unknown }
  const fromCause = e.cause && e.cause !== error ? detailOf(e.cause) : ''
  if (fromCause) return fromCause
  const own = [e.reason, e.shortMessage, e.details, e.message].find((v): v is string => typeof v === 'string' && v.trim() !== '')
  if (!own) return ''
  const line =
    own
      .split('\n')
      .map((part) => part.trim())
      .find(Boolean) ?? ''
  return line.length > 160 ? `${line.slice(0, 159)}…` : line
}

function rawCode(error: unknown): unknown {
  if (!error || typeof error !== 'object') return undefined
  const e = error as { code?: unknown; cause?: unknown }
  return e.code ?? (e.cause ? rawCode(e.cause) : undefined)
}

export function describeError(error: unknown): string {
  if (error instanceof UserError || error instanceof TransactionRevertedError) return error.message

  const text = rawText(error)
  const code = rawCode(error)
  if (code === 4001 || code === 'ACTION_REJECTED' || /UserRejectedRequestError|user rejected|user denied|rejected the request|user cancel/i.test(text)) {
    return 'Transaction rejected in your wallet.'
  }
  if (/insufficient funds|insufficient balance|exceeds balance/i.test(text)) return 'You do not have enough funds for this transaction.'
  if (/out of gas|gas required exceeds allowance|intrinsic transaction cost/i.test(text)) return 'Not enough KMT to pay for transaction fees.'
  if (/ChainMismatchError|chain mismatch|does not match the target chain/i.test(text)) return 'Switch your wallet to KalyChain and try again.'
  if (/HttpRequestError|Failed to fetch|fetch failed|NetworkError|\bERR_NAME_NOT_RESOLVED\b|\bENOTFOUND\b|\bECONNREFUSED\b/.test(text)) {
    return 'Could not reach the network. Check your connection and try again.'
  }
  if (/timed? ?out|block height exceeded/i.test(text)) return 'The request timed out. Please try again.'
  if (/execution reverted/i.test(text) || isOnChainRevert(error)) return 'The transaction was reverted on-chain.'
  const detail = detailOf(error)
  return detail ? `Something went wrong. ${detail}` : 'Something went wrong. Please try again.'
}
