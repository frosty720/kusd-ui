'use client'

import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useCallback } from 'react'
import { erc20Abi } from 'viem'
import { useAccount, usePublicClient } from 'wagmi'
import { psmAbi } from '@/abis/hyperlane'
import type { KusdTrade, TradeToken } from '@/config/kusdTrade'
import { APP_CHAIN_ID } from '@/config/networks'
import { approveStep, psmSwapStep } from '@/lib/kusdSteps'
import type { PsmDirection } from '@/lib/psm'
import { UserError } from '@/lib/txError'
import { useKusdWriter } from './useKusdWriter'

export interface PsmState {
  tin: bigint
  tout: bigint
  /** KUSD the PSM holds: the most a USDT → KUSD swap can pay out right now. */
  kusdCash: bigint
  /** USDT in the pocket: the most a KUSD → USDT swap can pay out right now. */
  pocketGem: bigint
}

export function usePsmState(trade: KusdTrade) {
  const client = usePublicClient({ chainId: APP_CHAIN_ID })
  return useQuery({
    queryKey: ['kusdPsm'],
    enabled: Boolean(client),
    refetchInterval: 30_000,
    queryFn: async (): Promise<PsmState> => {
      const [tin, tout, kusdCash, pocketGem] = await Promise.all([
        client!.readContract({ address: trade.psm, abi: psmAbi, functionName: 'tin' }),
        client!.readContract({ address: trade.psm, abi: psmAbi, functionName: 'tout' }),
        client!.readContract({ address: trade.kusd.address, abi: erc20Abi, functionName: 'balanceOf', args: [trade.psm] }),
        client!.readContract({ address: trade.gem.address, abi: erc20Abi, functionName: 'balanceOf', args: [trade.pocket] }),
      ])
      return { tin, tout, kusdCash, pocketGem }
    },
  })
}

export interface PsmWallet {
  gemBalance: bigint
  gemAllowance: bigint
  kusdBalance: bigint
  kusdAllowance: bigint
  /** Native KMT, for the network fees. */
  kmtBalance: bigint
}

/** The owner's USDT and KUSD balances, their allowances to the PSM, and the KMT for fees. */
export function usePsmWallet(trade: KusdTrade, owner: `0x${string}` | undefined) {
  const client = usePublicClient({ chainId: APP_CHAIN_ID })
  return useQuery({
    queryKey: ['kusdPsmWallet', owner],
    enabled: Boolean(client && owner),
    refetchInterval: 30_000,
    queryFn: async (): Promise<PsmWallet> => {
      const balance = (token: `0x${string}`) => client!.readContract({ address: token, abi: erc20Abi, functionName: 'balanceOf', args: [owner!] })
      const allowance = (token: `0x${string}`) => client!.readContract({ address: token, abi: erc20Abi, functionName: 'allowance', args: [owner!, trade.psm] })
      const [gemBalance, gemAllowance, kusdBalance, kusdAllowance, kmtBalance] = await Promise.all([
        balance(trade.gem.address),
        allowance(trade.gem.address),
        balance(trade.kusd.address),
        allowance(trade.kusd.address),
        client!.getBalance({ address: owner! }),
      ])
      return { gemBalance, gemAllowance, kusdBalance, kusdAllowance, kmtBalance }
    },
  })
}

/** The token the owner pays with in a direction: USDT when selling it to the PSM, KUSD when buying USDT back. */
export function psmPayToken(trade: KusdTrade, direction: PsmDirection): TradeToken {
  return direction === 'sell' ? trade.gem : trade.kusd
}

/** Queries a PSM swap or approval changes. */
const PSM_QUERY_KEYS = [['kusdPsm'], ['kusdPsmWallet']]

/** Approves exactly `amount` of the pay token to the PSM (never unlimited), then refreshes the allowance. */
export function useApprovePsm(trade: KusdTrade): (direction: PsmDirection, amount: bigint) => Promise<`0x${string}`> {
  const send = useKusdWriter()
  const queryClient = useQueryClient()
  return useCallback(
    async (direction, amount) => {
      const hash = await send(approveStep(psmPayToken(trade, direction).address, trade.psm, amount))
      await queryClient.invalidateQueries({ queryKey: ['kusdPsmWallet'] })
      return hash
    },
    [send, queryClient, trade],
  )
}

/** sellGem / buyGem to the connected wallet; waits for the receipt and throws on a revert. */
export function usePsmSwap(trade: KusdTrade): (args: { direction: PsmDirection; gemAmt: bigint }) => Promise<`0x${string}`> {
  const send = useKusdWriter()
  const { address } = useAccount()
  const queryClient = useQueryClient()
  return useCallback(
    async ({ direction, gemAmt }) => {
      if (!address) throw new UserError('Connect your wallet first.')
      const hash = await send(psmSwapStep(trade.psm, direction, address, gemAmt))
      await Promise.all(PSM_QUERY_KEYS.map((queryKey) => queryClient.invalidateQueries({ queryKey })))
      return hash
    },
    [send, address, queryClient, trade],
  )
}
