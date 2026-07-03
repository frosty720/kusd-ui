'use client'

import { useEffect } from 'react'
import { useQueryClient } from '@tanstack/react-query'

/**
 * Refresh on-chain reads the moment a transaction confirms.
 *
 * The contract read hooks poll on a ~10s `refetchInterval`, so after a write the
 * UI (balances, positions, allowances) can show stale values for up to one poll
 * interval — which makes a (correct, receipt-gated) success message look like it
 * landed "ahead" of the chain. This hook invalidates all active queries when a
 * transaction's receipt success flag flips true, so reads refetch immediately.
 *
 * Call it once per receipt-success flag on a page — each flag is a hook's
 * `isSuccess` from `useWaitForTransactionReceipt`, so this fires only after the
 * tx is actually mined, not on submission.
 */
export function useRefetchOnTxSuccess(isSuccess: boolean) {
  const queryClient = useQueryClient()

  useEffect(() => {
    if (isSuccess) {
      queryClient.invalidateQueries()
    }
  }, [isSuccess, queryClient])
}
