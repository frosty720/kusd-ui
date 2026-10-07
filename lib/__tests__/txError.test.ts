/**
 * What a failed write tells the user. A wallet that refused to sign must never read as an on-chain
 * revert (that sends people looking for a transaction that does not exist), and errors the app
 * raises itself keep their own words.
 */
import { describe, expect, it } from 'vitest'
import { TransactionRevertedError } from '../kusdSteps'
import { describeError, UserError } from '../txError'

describe('describeError', () => {
  it("shows the app's own errors as written", () => {
    expect(describeError(new UserError('Connect your wallet first.'))).toBe('Connect your wallet first.')
    expect(describeError(new TransactionRevertedError('0x1', 'swap'))).toBe('Swap failed: the transaction was reverted on-chain.')
  })

  it('recognises a wallet rejection by code or wording, however deep it is wrapped', () => {
    expect(describeError({ code: 4001 })).toBe('Transaction rejected in your wallet.')
    expect(describeError({ code: 'ACTION_REJECTED' })).toBe('Transaction rejected in your wallet.')
    expect(describeError(new Error('outer', { cause: { name: 'UserRejectedRequestError', message: 'User rejected the request.' } }))).toBe(
      'Transaction rejected in your wallet.',
    )
  })

  it('names the common wallet and network failures', () => {
    expect(describeError(new Error('insufficient funds for gas * price + value'))).toBe('You do not have enough funds for this transaction.')
    expect(describeError(new Error('gas required exceeds allowance'))).toBe('Not enough KMT to pay for transaction fees.')
    expect(describeError(new Error('ChainMismatchError: does not match the target chain'))).toBe('Switch your wallet to KalyChain and try again.')
    expect(describeError(new TypeError('Failed to fetch'))).toBe('Could not reach the network. Check your connection and try again.')
    expect(describeError(new Error('request timed out'))).toBe('The request timed out. Please try again.')
  })

  it('reports a revert only when the chain said so', () => {
    expect(describeError({ shortMessage: 'x', cause: { raw: '0x08c379a0' } })).toBe('The transaction was reverted on-chain.')
    expect(describeError(new Error('execution reverted: PSM/insufficient'))).toBe('The transaction was reverted on-chain.')
  })

  it("keeps the wallet's own first line for anything else, and a generic text when there is none", () => {
    expect(describeError(new Error('outer', { cause: { shortMessage: 'Signer locked\nsecond line' } }))).toBe('Something went wrong. Signer locked')
    expect(describeError({ message: 'x'.repeat(200) })).toBe(`Something went wrong. ${'x'.repeat(159)}…`)
    expect(describeError('plain text')).toBe('Something went wrong. plain text')
    expect(describeError(null)).toBe('Something went wrong. Please try again.')
    expect(describeError({})).toBe('Something went wrong. Please try again.')
    expect(describeError(42)).toBe('Something went wrong. Please try again.')
  })
})
