# KUSD Contract ABIs

This directory contains all the Application Binary Interfaces (ABIs) for the KUSD stablecoin system contracts.

## Core System Contracts

### **Vat.json**
- **Purpose:** Core CDP (Collateralized Debt Position) engine
- **Key Functions:** `frob()`, `fork()`, `grab()`, `slip()`, `flux()`, `move()`
- **Used For:** Managing collateral deposits, debt positions, and internal accounting

### **Kusd.json**
- **Purpose:** KUSD stablecoin ERC20 token
- **Key Functions:** `transfer()`, `approve()`, `mint()`, `burn()`
- **Used For:** KUSD token transfers and balance queries

### **sKLC.json**
- **Purpose:** Wrapped KLC token for auction participation (Lock Model)
- **Key Functions:** `wrap()`, `unwrap()`, `mint()`, `burn()`
- **Used For:** Wrapping KLC to sKLC for participating in auctions

## Join Adapters

### **KusdJoin.json**
- **Purpose:** Adapter for KUSD token to Vat
- **Key Functions:** `join()`, `exit()`
- **Used For:** Moving KUSD between user wallets and the Vat

### **GemJoin.json**
- **Purpose:** Adapter for 18-decimal collateral tokens (WETH, DAI)
- **Key Functions:** `join()`, `exit()`
- **Used For:** Depositing/withdrawing 18-decimal collateral

### **GemJoin5.json**
- **Purpose:** Adapter for non-18-decimal collateral tokens (WBTC-8, USDT-6, USDC-6)
- **Key Functions:** `join()`, `exit()`
- **Used For:** Depositing/withdrawing non-18-decimal collateral with proper scaling

## Oracle & Rates

### **Spotter.json**
- **Purpose:** Oracle price feed interface
- **Key Functions:** `poke()`, `file()`
- **Used For:** Reading collateral prices and updating spot prices

### **Jug.json**
- **Purpose:** Stability fee accumulator
- **Key Functions:** `drip()`, `file()`
- **Used For:** Accruing stability fees on debt positions

## Savings & Liquidations

### **Pot.json**
- **Purpose:** KUSD Savings Rate (DSR) module
- **Key Functions:** `join()`, `exit()`, `drip()`
- **Used For:** Depositing KUSD to earn savings rate

### **Dog.json**
- **Purpose:** Liquidation engine
- **Key Functions:** `bark()`, `digs()`
- **Used For:** Triggering liquidations of undercollateralized positions

## Auctions

### **Clipper.json**
- **Purpose:** Collateral liquidation auctions (Dutch auction)
- **Key Functions:** `kick()`, `take()`, `redo()`
- **Used For:** Bidding on liquidated collateral

### **Flapper.json**
- **Purpose:** Surplus auctions (sell KUSD for sKLC)
- **Key Functions:** `kick()`, `tend()`, `deal()`
- **Used For:** Participating in surplus auctions

### **Flopper.json**
- **Purpose:** Debt auctions (mint sKLC for KUSD)
- **Key Functions:** `kick()`, `dent()`, `deal()`
- **Used For:** Participating in debt auctions

### **LinearDecrease.json**
- **Purpose:** Price calculation for Dutch auctions
- **Key Functions:** `price()`
- **Used For:** Calculating current auction prices

## Emergency & Settlement

### **End.json**
- **Purpose:** Emergency shutdown module
- **Key Functions:** `cage()`, `skim()`, `free()`, `pack()`, `cash()`
- **Used For:** Emergency shutdown and collateral redemption

### **Cure.json**
- **Purpose:** Bad debt settlement
- **Key Functions:** `load()`, `keep()`
- **Used For:** Settling bad debt during emergency shutdown

## Token Interface

### **ERC20.json**
- **Purpose:** Standard ERC20 token interface
- **Key Functions:** `balanceOf()`, `allowance()`, `approve()`, `transfer()`, `transferFrom()`
- **Used For:** Interacting with collateral tokens (WBTC, WETH, USDT, USDC, DAI)

---

## Usage in UI

Import ABIs in your hooks/components:

\`\`\`typescript
import VatABI from '@/abis/Vat.json'
import KusdABI from '@/abis/Kusd.json'
import sKLCABI from '@/abis/sKLC.json'
import ERC20ABI from '@/abis/ERC20.json'

// Use with wagmi
const { data } = useReadContract({
  address: contracts.core.vat,
  abi: VatABI.abi,
  functionName: 'urns',
  args: [ilk, userAddress]
})
\`\`\`

---

**Last Updated:** 2025-11-10  
**Source:** Compiled from kusd-core/out/ (Foundry build artifacts)
