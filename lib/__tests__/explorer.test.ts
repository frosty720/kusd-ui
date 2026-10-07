/**
 * Explorer links must follow the connected chain: a 3890 tx linked to the
 * testnet explorer is a dead link for the user.
 */

import { describe, expect, it } from 'vitest'
import { getExplorerAddressUrl, getExplorerTxUrl } from '../explorer'

const HASH = `0x${'ab'.repeat(32)}`
const ADDR = `0x${'cd'.repeat(20)}`

describe('explorer links', () => {
  it('links 3890 txs and addresses to kalyscan.io', () => {
    expect(getExplorerTxUrl(3890, HASH)).toBe(`https://kalyscan.io/tx/${HASH}`)
    expect(getExplorerAddressUrl(3890, ADDR)).toBe(`https://kalyscan.io/address/${ADDR}`)
  })

  it('links 3888 to kalyscan.io', () => {
    expect(getExplorerTxUrl(3888, HASH)).toBe(`https://kalyscan.io/tx/${HASH}`)
  })

  it('links 3889 and an unknown chain to the testnet explorer', () => {
    expect(getExplorerTxUrl(3889, HASH)).toBe(`https://testnet.kalyscan.io/tx/${HASH}`)
    expect(getExplorerTxUrl(undefined, HASH)).toBe(`https://testnet.kalyscan.io/tx/${HASH}`)
  })
})
