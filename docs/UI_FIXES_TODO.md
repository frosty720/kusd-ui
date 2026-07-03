# kusd-ui — UI Fixes TODO

Tracked fix list from the read-only audit (2026-07-02). **Real-money project — scope discipline applies:** fix only the tasks listed here; if a new issue is found mid-task, report it and stop (do not fix). Every change must be verifiable **1:1 on testnet** before mainnet.

Status legend: `[ ]` todo · `[~]` in progress · `[x]` done · `[?]` needs decision · `[report]` report-only (do not change without sign-off)

---

## Tier 0 — Gas (in-app wallet blocker, found during T1 testnet testing)

- [x] **T0 — In-app wallet txs stuck pending: switch all write hooks to explicit EIP-1559 fees**
  - Root cause (proven on-chain): thirdweb in-app/social wallet DROPS the legacy `gasPrice: 21 gwei` and sends a type-2 tx at ~1,100 wei → never mines (Besu advertises ~7 wei but mining floor ~21 gwei).
  - Fix: added `config/transaction.ts` (maxFeePerGas 30 gwei / maxPriorityFeePerGas 3 gwei, per-call `gas` override) mirroring KalyDAO/KalySwap/kaly-vault; replaced the legacy gas block in ALL write hooks + deposit `mintTokens`. No legacy `gasPrice` remains. Build + 360 tests green.
  - Files: useApproveToken, useVat, useSKLC, useSpotter, useGemJoin, useKusdJoin, usePot, useEnd, useDSProxy, useMulticall3, useAuctions, app/deposit (mintTokens).
  - Testnet verify: with a FRESH social wallet, approve → deposit → lock all mine (previous wallet 0x6c0c…95f3 is jammed with 8 stuck txs).

## Tier 1 — Functional / fund-safety

- [x] **T1 — Deposit: stop the auto-`frob` re-fire loop** (done — build+tests green; needs testnet confirmation)
  - File: `app/deposit/page.tsx` (post-deposit lock effect only)
  - Fix: add a `depositStep` state machine (mirrors the Borrow page's `repayStep`) so the lock `frob` fires exactly once per deposit.
  - Scope guard: only the auto-lock effect + its reset. Do NOT alter the manual "Lock in CDP" button (line ~307) or the borrow flow.
  - Testnet verify: deposit WBTC → confirm exactly ONE lock tx on testnet.kalyscan; repeat with a social-login in-app wallet to confirm no duplicate broadcasts.

- [x] **T2 — Borrow: "Max" repay fully closes the vault** — DONE.
  - Added a `repayAll` flag (set by Max, cleared on manual edit). Full close now joins `ceil(art*rate/RAY)` and frobs `dart = -art` → vault reaches exactly `art = 0`; partial repay unchanged (floored, safe). Relaxed the "exceeds current debt" guard for the full-close case only. Build + 360 tests green.
  - Fee transparency (added): KUSD charges a stability fee by design, so a full close = principal + accrued fee (`ceil(art*rate)`). When the wallet can't cover it, the repay error now explains it's the stability fee (not "insufficient balance"), plus a standing note: "closing repays your debt + accrued stability fee." Exact fee line-item deferred (needs borrow history / subgraph).
  - Testnet verify: with wallet KUSD **>** debt (mint a little extra), Max repay → `art`/debt reads exactly `0`, all collateral withdrawable. With wallet == minted principal, you'll see the fee-aware message (expected — you owe the accrued fee).

- [x] **T3 — Auctions: fix Flopper (debt) bid authorization** — DONE. Repurposed the misnamed `vatCanFlapper`/`hopeFlapper`/`handleHopeFlapper` (which were only ever used, incorrectly, in the debt tab — the surplus tab uses sKLC approval) into `vatCanFlopper`/`hopeFlopper`/`handleHopeFlopper` pointing at `flopper.address`, and wired the debt-tab gate/button to them. Zero dead code left. Build + 360 tests green.
  - Testnet verify: seed a debt auction (via keeper) → `dent` bid no longer reverts.

## Tier 2 — Money figures shown wrong (display only)

- [x] **T4 — Auction RAD/WAD display** — DONE. Flapper "KUSD Lot" and Flopper "KUSD Bid (Fixed)" now use `formatRAD` (they're RAD), fixing the 1e27× over-display. Write paths untouched. Build + 360 tests green.
  - Testnet verify: seed surplus + debt auctions; displayed KUSD amounts are sane (not 1e27× inflated).

- [x] **T5 — Dashboard DSR balance reads the proxy, not the EOA** — DONE. `useUserPortfolio.ts` now resolves the user's DSProxy (via `useDSProxy().useHasProxy`) and reads `pot.usePie(proxy || EOA)`, mirroring the DSR page. Dashboard DSR card + Net Worth now reflect proxy deposits. Build + 360 tests green.
  - Testnet verify: deposit to DSR (via proxy) → dashboard DSR card + Net Worth show the balance (not 0).

- [x] **T6 — "Total in Savings" should be `Pie·chi`, not `Pie`** — DONE. Home, dashboard, and admin now fetch `pot.useChi()` and compute `totalInDSR = formatWAD(Pie * chi / RAY)`. Build + 360 tests green.
  - Testnet verify: matches `pot.Pie() * pot.chi() / 1e27`.

- [x] **T7 — Zero-debt vault should not show "At Risk"** — DONE. `VaultCard`/`HealthBadge` now detect `vault.totalDebt === 0n` and render "Safe (∞)" / "∞%" / green instead of "At Risk (0.00)" / 0%. The `calculateCollateralRatio`/`calculateHealthFactor` sentinels are untouched. Build + 360 tests green.
  - Testnet verify: deposit collateral, mint nothing → dashboard shows Safe.

## Tier 3 — Wallet / network (new surface from the thirdweb swap)

- [x] **T8 — Support BOTH networks (no wrong-network block)** — DONE (mirrors kalydao). `Web3Provider` now `chains: [mainnet, testnet]`; `config/thirdweb.ts` `thirdwebChains = [twKalyMainnet, twKalyTestnet]`; the bridge routes the in-app wallet provider through the **currently-selected** thirdweb chain (`twChainFor(twChainId)`) and `switchChain` returns `wagmiChainFor(chainId)` (added `WAGMI_CHAINS`/`TW_CHAINS` maps). Verified nothing resolves contracts from `getCurrentNetwork()` — pages use the connected `chainId`. `NEXT_PUBLIC_NETWORK` remains the default-chain selector. Build + 360 tests green.
  - Testnet verify: connect an in-app wallet (defaults to the `NEXT_PUBLIC_NETWORK` chain); the wallet's Select-Network modal now offers **both** KalyChain networks, and switching updates reads/writes to that chain.

- [x] **T9 — Bridge stuck-state hardening** — DONE. `updateProvider()` in `config/thirdwebBridge.ts` now try/catches `EIP1193.toProvider` and returns a boolean; both call sites release the `isSyncing` lock (and bail/reset) on failure, so a transient provider error can't stall the bridge "syncing" for the page load. Connector shape + dep array untouched. Build + 360 tests green.

- [x] **T10 — Set the thirdweb client id** — DONE (user added `NEXT_PUBLIC_THIRDWEB_CLIENT_ID` to `.env`; in-app/social login works).
  - Optional follow-on (decide later): gate the in-app wallet out of `allWallets` when the key is missing.

## Tier 4 — Lower severity / decisions

- [x] **T11 — Collateral-auction price protection** — DONE. Fixed the `useStatus` hook (`status` → `getStatus`), read the Dutch price (`getStatus[1]`, RAY), display "Current Price" + "Max you'll pay (1% slippage)", and set `take` `maxPrice = price * 101/100` (was `2^256-1` = accept any price). Buy button disabled until price loads. Build + 360 tests green. File: `app/auctions/page.tsx` + `hooks/contracts/useAuctions.ts`.
- [x] **T12 — Max-button precision** — DONE. Deposit/borrow(repay+withdraw)/wrap Max buttons now feed the exact bigint via `formatUnits(x, decimals)` instead of the lossy `formatWAD`/`formatTokenAmount` round-trip. Build + 360 tests green.
- [x] **T13 — Oracle `has` flag** — DONE. deposit/borrow/mint now only trust `peek()`'s value when the `has` boolean is true (`oraclePriceData[1]`), so a stale/unset feed isn't used as a live price. Build + 360 tests green.
- [~] **T14 — `calculateMaxMint` debt-ceiling units (RAD vs WAD)** — DEFERRED (moot). Confirmed `maxMint` is computed in `useUserPosition` but **never rendered** anywhere (not in the `VaultPosition` interface; no `.maxMint` reads). The function is also covered by `lib/__tests__/calculations.test.ts`. Not worth changing tested math for a dead output on a real-money project. Revisit only if maxMint is ever surfaced.
- [x] **T15 — Labels + dead code** — DONE. Dashboard Net Worth subtitle "KUSD in wallet" → "KUSD in Vat" (it's the internal Vat balance). Removed dead/broken `useNativeBalance` from `useTokenBalance.ts`. Build + 360 tests green.
- [x] **T16 — Read invalidation after writes** — DONE. Added `hooks/useRefetchOnTxSuccess.ts` (invalidates all active queries when a receipt-success flag flips true); wired into deposit, wrap, borrow, mint, dsr, auctions (one call per receipt-success flag). Build + 360 tests green. **Admin page intentionally NOT wired (operator-only).** **[confirmed in testing]** This is the cause of "balance takes a bit to update" after withdraw AND the "success toast looks ahead of on-chain" — the success toast is correctly receipt-gated (`useWaitForTransactionReceipt`), but balances poll every ~10s with no refetch on success. Fixing this makes toast + balance update together. Worth prioritizing.

- [x] **T17 — Tx toast notifications with explorer links** (user request) — DONE. Added a self-contained toast system (`providers/ToastProvider.tsx`, no new dependency), a network-aware explorer helper (`lib/explorer.ts`), and a `useTxToast` hook (`hooks/useTxToast.ts`) that fires once per confirmed hash (with a "View on explorer ↗" link for the connected chain) or per error. Wired into deposit, mint, borrow, wrap, dsr, and auctions primary writes. `ToastProvider` added to `Web3Provider`. Build + 360 tests green.
  - Note: toasts are ADDITIVE — the existing inline green/red status boxes are still there. If they feel redundant on success, say so and I'll strip the inline boxes in favor of toasts.
  - Testnet verify: do any tx → a toast appears on confirm with a working explorer link to the correct network; reject/fail a tx → an error toast appears.

---

## Report-only (do NOT change without sign-off)

- **Testnet KUSD address mismatch (found during testing).** RESOLVED in code: user confirmed the canonical testnet KUSD is **`0x6c52f4afB0f23296D8D1C32485207a1e7c9AA3c3`** (what the live `KusdJoin.kusd()` uses; where their minted KUSD sits). Updated `config/thirdweb.ts` `SUPPORTED_TOKENS` testnet KUSD `0xd15F… → 0x6c52…`. `config/contracts.ts` was already correct. Mainnet unaffected (`0xcd02…`).
  - **Docs updated:** workspace `/home/dude/KalyChain/CLAUDE.md` testnet KUSD corrected `0xd15F… → 0x6c52…` (with a note that `0xd15F…` is an older deployment — do not use).


- **`NEXT_PUBLIC_DEX_PAIR_ADDRESS` is a single mainnet V2 pair, not chain-keyed.** Used by `useDexPair`/`useKusdPrice` (`hooks/contracts/useDexPair.ts`) to read the KalySwap KUSD/USDC **Uniswap V2** pair reserves and show the live KUSD market price + peg deviation on the **Dashboard** and **Admin** pages (display-only, not in any tx path). Because it's a single mainnet address applied regardless of chain, the peg indicator reads null/"loading" on **testnet** (no such pair there), same class as the mainnet PSM/multicall `.env` values. To fix: make it chain-keyed (like `getContracts`) with a testnet KUSD/USDC pair. **Bigger opportunity:** KalySwap now has **V3 pools** — the peg price should move to a V3 pool read (slot0/sqrtPriceX96) rather than V2 `getReserves`. Ties into the upcoming keeper / market-maker bot work for KUSD pairs. Not fixing now — flagged for that track.

- **wKLC mainnet address in `SUPPORTED_TOKENS`** — RESOLVED: confirmed identical on mainnet and testnet; leaving as-is.
- **Mint under-draws by a rounding wei** (`dart` floored) — safe direction, no fund risk. Leave.
- **Partial-repay dust** — same rounding, safe direction. Leave (T2 covers full-close only).
- **DSR/stability-fee APY float precision** — imprecise in theory, fine at 2-decimal display. Leave.

## Verified correct (do not touch)

Decimal scaling for non-18 collateral · `dink` always WAD · borrow's guarded two-step repay · `needsApproval` off-by-one · `useUserPosition` ratio/health/liq scales · Clipper `tab`/`lot` display · all write hooks now use explicit EIP-1559 fees via `config/transaction.ts` (T0 — 30/3 gwei, works for in-app + MetaMask on Besu).

---

## Subgraph — decision: build one as a separate track

Not required to fix the bugs above (active collateral auctions can be enumerated via `Clip.list()`/`count()`), but recommended. It unlocks: enumerating/listing ALL active auctions (surplus/debt have no on-chain `list()`), accurate accrued-fee display (needs per-user initial borrow rate — currently stubbed), DSR earnings (needs chi-at-deposit — currently stubbed), and dashboard analytics/liquidation history. Index Vat, Dog/Clip, Pot, Vow, Jug. Graph tooling + a deployed `v3-subgraph` already exist in the workspace. Ship Tier 1-2 first; spec the subgraph in parallel.
