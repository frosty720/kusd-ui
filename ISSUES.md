
Let me investigate all 3 issues thoroughly.

Good, I found the relevant code. Now let me look at the specific `cut()` function in the LitePSM contract and understand the overflow issue:

Now I understand the issues. Let me check the PSM state on-chain by looking at the PSM keeper to understand what data it reads:

Now I have a clear picture. Let me analyze the `cut()` overflow and understand what's happening:

## Investigation Results - Honest Assessment

---

### Issue #1: `cut()` Overflow in LitePSM ⚠️

**Root Cause Found:**

Looking at `KssLitePsm.sol` line 510:
```solidity
wad = _min(cash, cash + gem.balanceOf(pocket) * to18ConversionFactor - art);
```

The overflow happens because:
- `art` = PSM's debt recorded in the Vat (how much KUSD it has minted)
- `cash + gems` = PSM's actual backing assets

**If `art > cash + gems`, the subtraction underflows!**

This means: **The PSM has minted more KUSD than it can account for with its current balances.** This is an accounting inconsistency that needs on-chain investigation.

---

### Issue #2: Price vs DEX Swap Discrepancy 🔍

**Why the arb simulation shows no profit despite 9% price deviation:**

From the logs:
```
Pocket balance: 12.212418 USDC
max pool: 10.024109 USDC
```

**The ENTIRE liquidity pool has only ~10-12 USDC!**

When you try to trade 10 USDC in a pool with 10 USDC total:
- You're moving 100% of the pool's liquidity
- The AMM formula with that much slippage gives you almost nothing extra
- The price you see ($0.9072) is the *spot price*, but after your trade moves the pool, you get the *execution price* which is near $1

**This is not a bug - it's the math of how AMMs work with low liquidity.**

---

### Issue #3: Why KUSD is at $0.9072 📉

The price is calculated from pool reserves:
```
price = (usdcReserve * 1e12) / kusdReserve
```

If USDC reserve is proportionally low, price is low. This could happen if:
1. Someone dumped KUSD for USDC, depleting the USDC side
2. Never enough initial liquidity was added
3. No arb is occurring to restore the peg

---

## The Real Problems (in priority order):

| # | Issue | Severity | Fix |
|---|-------|----------|-----|
| 1 | **Pool liquidity is ~10-12 USDC** | 🔴 Critical | Add significant liquidity (thousands of USDC + KUSD) |
| 2 | **PSM cut() overflow** - accounting inconsistency | 🟡 Medium | Investigate on-chain state, may need PSM reinitialization |
| 3 | **Arb can't work** with current liquidity | 🔴 Critical | Blocked by #1 |
| 4 | **KUSD keeper module error** | 🟢 Low | Just rebuild: `npm run build` |

---

## Recommended Action Plan:

### Phase 1: Immediate (Today)
1. **Query the on-chain PSM state** to understand the cut() overflow
   - Check `vat.urns(ilk, psm)` for art value
   - Check `kusd.balanceOf(psm)` 
   - Check `gem.balanceOf(pocket)`
   
2. **Check pool reserves** on KalySwap to confirm liquidity

3. **Fix keeper deployment**: `cd /home/dev/kusd-keeper && npm run build && pm2 restart kusd-keeper`

### Phase 2: Liquidity Fix (Required for peg stability)
1. **Add liquidity to KUSD/USDC pool** - Need at least $1,000-10,000 on each side for arb to work
2. If you don't have liquidity, the arb keeper is pointless

### Phase 3: PSM Fix (If needed)
1. Investigate why `art > cash + gems` 
2. May need to add KUSD to PSM or adjust Vat state

---

