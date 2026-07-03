'use client'

/**
 * Fire a toast when a transaction confirms or fails.
 *
 * Success fires once per confirmed hash, with a link to the connected network's
 * explorer. Failure fires once per error. Pass each write hook's `isSuccess`,
 * `hash`, and `error` (from `useWriteContract` / `useWaitForTransactionReceipt`).
 */

import { useEffect, useRef } from 'react'
import { useChainId } from 'wagmi'
import { useToast } from '@/providers/ToastProvider'
import { getExplorerTxUrl } from '@/lib/explorer'

interface TxToastOptions {
  isSuccess?: boolean
  hash?: `0x${string}`
  error?: unknown
  successMessage: string
  errorMessage?: string
}

export function useTxToast({ isSuccess, hash, error, successMessage, errorMessage }: TxToastOptions) {
  const chainId = useChainId()
  const { showToast } = useToast()
  const shownForHash = useRef<string | null>(null)
  const errorShown = useRef(false)

  useEffect(() => {
    if (isSuccess && hash && shownForHash.current !== hash) {
      shownForHash.current = hash
      showToast({ type: 'success', message: successMessage, href: getExplorerTxUrl(chainId, hash) })
    }
  }, [isSuccess, hash, successMessage, chainId, showToast])

  useEffect(() => {
    if (error && !errorShown.current) {
      errorShown.current = true
      showToast({ type: 'error', message: errorMessage || 'Transaction failed.' })
    } else if (!error) {
      errorShown.current = false
    }
  }, [error, errorMessage, showToast])
}
