/**
 * Protocol Stats Hook
 *
 * Reads the home page's TVL, circulating KUSD and backing % from the app's chain: the PSM
 * pocket's stable, every collateral type's GemJoin balance priced at Vat spot × Spotter mat,
 * Vat debt, and the KUSD still held by the PSM. The math lives in lib/protocolStats.
 */

import { type Address, parseAbi } from 'viem'
import { useReadContract, useReadContracts } from 'wagmi'
import { getContracts } from '@/config/contracts'
import { APP_CHAIN_ID } from '@/config/networks'
import { type ProtocolStats, protocolStats, type VaultCollateral } from '@/lib/protocolStats'

const PSM_ADDRESS = process.env.NEXT_PUBLIC_PSM_ADDRESS as Address | undefined

const erc20Abi = parseAbi(['function balanceOf(address) view returns (uint256)', 'function decimals() view returns (uint8)'])
const vatAbi = parseAbi([
  'function debt() view returns (uint256)',
  'function ilks(bytes32) view returns (uint256 Art, uint256 rate, uint256 spot, uint256 line, uint256 dust)',
])
const spotterAbi = parseAbi(['function ilks(bytes32) view returns (address pip, uint256 mat)'])
const psmAbi = parseAbi(['function pocket() view returns (address)', 'function gem() view returns (address)'])

const REFRESH_MS = 30000

/** Returns null until every read has landed, so the cards never flash a partial total. */
export function useProtocolStats(): ProtocolStats | null {
  const contracts = getContracts(APP_CHAIN_ID)
  const collateral = Object.values(contracts.collateral)

  const { data: vatDebt } = useReadContract({
    chainId: APP_CHAIN_ID,
    address: contracts.core.vat,
    abi: vatAbi,
    functionName: 'debt',
    query: { refetchInterval: REFRESH_MS },
  })

  const { data: vaultReads } = useReadContracts({
    contracts: collateral.flatMap((c) => [
      { chainId: APP_CHAIN_ID, address: c.token, abi: erc20Abi, functionName: 'balanceOf' as const, args: [c.join] as const },
      { chainId: APP_CHAIN_ID, address: contracts.core.vat, abi: vatAbi, functionName: 'ilks' as const, args: [c.ilk] as const },
      { chainId: APP_CHAIN_ID, address: contracts.core.spotter, abi: spotterAbi, functionName: 'ilks' as const, args: [c.ilk] as const },
    ]),
    query: { refetchInterval: REFRESH_MS },
  })

  const { data: psm } = useReadContracts({
    contracts: PSM_ADDRESS
      ? [
          { chainId: APP_CHAIN_ID, address: contracts.core.kusd, abi: erc20Abi, functionName: 'balanceOf', args: [PSM_ADDRESS] },
          { chainId: APP_CHAIN_ID, address: PSM_ADDRESS, abi: psmAbi, functionName: 'pocket' },
          { chainId: APP_CHAIN_ID, address: PSM_ADDRESS, abi: psmAbi, functionName: 'gem' },
        ]
      : [],
    query: { enabled: Boolean(PSM_ADDRESS), refetchInterval: REFRESH_MS },
  })
  const pocket = psm?.[1]?.result as Address | undefined
  const gem = psm?.[2]?.result as Address | undefined

  const { data: reserve } = useReadContracts({
    contracts:
      pocket && gem
        ? [
            { chainId: APP_CHAIN_ID, address: gem, abi: erc20Abi, functionName: 'balanceOf', args: [pocket] },
            { chainId: APP_CHAIN_ID, address: gem, abi: erc20Abi, functionName: 'decimals' },
          ]
        : [],
    query: { enabled: Boolean(pocket && gem), refetchInterval: REFRESH_MS },
  })

  if (vatDebt === undefined || !vaultReads || vaultReads.some((r) => r.status !== 'success')) return null
  if (PSM_ADDRESS && (!psm || !reserve || [...psm, ...reserve].some((r) => r.status !== 'success'))) return null

  const vaults: VaultCollateral[] = collateral.map((c, i) => ({
    balance: vaultReads[i * 3]?.result as bigint,
    decimals: c.decimals,
    spot: (vaultReads[i * 3 + 1]?.result as readonly [bigint, bigint, bigint, bigint, bigint])[2],
    mat: (vaultReads[i * 3 + 2]?.result as readonly [Address, bigint])[1],
  }))

  return protocolStats({
    vatDebt,
    psmKusd: (psm?.[0]?.result as bigint | undefined) ?? 0n,
    pocketGem: (reserve?.[0]?.result as bigint | undefined) ?? 0n,
    gemDecimals: Number(reserve?.[1]?.result ?? 18),
    vaults,
  })
}
