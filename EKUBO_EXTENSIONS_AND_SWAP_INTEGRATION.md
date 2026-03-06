# Ekubo Integration Notes (Extensions + Swap Fee Wrapper)

Date: 2026-03-02

## 1) What was studied

- Extensions guide: <https://docs.ekubo.org/integration-guides/extensions>
- Swapping guide: <https://docs.ekubo.org/integration-guides/swapping>
- Till pattern: <https://docs.ekubo.org/integration-guides/contract-reference/till-pattern>
- Pool price reference: <https://docs.ekubo.org/integration-guides/contract-reference/pool-price>
- Starknet contract addresses: <https://docs.ekubo.org/integration-guides/contract-reference/starknet-contracts>
- Ekubo Starknet contracts (source):
  - Router: <https://github.com/EkuboProtocol/starknet-contracts/blob/main/src/router.cairo>
  - Router interface: <https://github.com/EkuboProtocol/starknet-contracts/blob/main/src/interfaces/router.cairo>
  - Core interface: <https://github.com/EkuboProtocol/starknet-contracts/blob/main/src/interfaces/core.cairo>

## 2) Key Ekubo architecture points

- Core swap execution is lock/callback based.
  - `ICore.lock(data)` calls `ILocker.locked(id, data)` on the caller contract.
  - Token settlement during lock is done with:
    - `core.pay(token)` for inputs.
    - `core.withdraw(token, recipient, amount)` for outputs.
- `Delta` sign meaning is from **core perspective**:
  - positive = core receives token.
  - negative = core owes token.
- Router uses this same lock model and settles deltas internally.
- Extensions are optional pool hooks (`before_swap`, `after_swap`, etc.) and are registered in pool key.
- Pool price data in core is sqrt-price + tick based (`PoolPrice`), and analytics/charting should account for this model.

## 3) Why trade was failing in current app

- Previous route-based quote/execution path was not reliable on Sepolia meme pools.
- Result: quote and execute flow failed even when pool existed on-chain.

## 4) Implemented solution in this repository

### New Cairo contract

- Added: `packages/cairo/src/ekubo_fee_swapper.cairo`
- Added module export in `packages/cairo/src/lib.cairo`

Contract behavior:

- Executes direct exact-input swap against Ekubo Core in one pool.
- Charges platform fee per swap (`fee_bps`, default `30` = `0.3%`).
- Fee is transferred to treasury before swap.
- Remaining input is swapped through `core.swap(...)` inside lock callback.
- Output is withdrawn to recipient via `core.withdraw(...)`.
- Any unconsumed input is refunded to caller.
- Admin can update:
  - treasury
  - fee bps
  - ekubo core address

### New deployment helper

- Added script:
  - `packages/cairo/scripts/deploy_ekubo_fee_swapper_sepolia.sh`
- Script declares + deploys `EkuboFeeSwapper` and writes:
  - `.deploy/sepolia/ekubo_fee_swapper_deployment.json`
  - `NEXT_PUBLIC_EKUBO_SWAP_FEE_ROUTER_ADDRESS` to `packages/nextjs/.env.local`

### Frontend integration changes

- `packages/nextjs/lib/config.ts`
  - Added `NEXT_PUBLIC_EKUBO_SWAP_FEE_ROUTER_ADDRESS`.
- `packages/nextjs/lib/token-launchpad/tokens.ts`
  - Fixed `launch_data` Option parsing (`Some` tag fix).
- `packages/nextjs/lib/trade/ekubo.ts`
  - Direct Ekubo fee-router trade execution.
- `packages/nextjs/components/token-trade-panel.tsx`
  - Trade is not blocked by quote availability.
  - Shows fee-router mode status and executes direct swap path.
- `packages/nextjs/app/token/[address]/page.tsx`
  - Builds pool key from on-chain token + quote and passes to trade panel.

## 5) Current fee model (swap side)

- Platform fee: `0.3%` per swap (configurable in contract).
- Destination: treasury wallet in contract storage.

## 6) Recommended next steps

1. Deploy `EkuboFeeSwapper` on Sepolia and set `NEXT_PUBLIC_EKUBO_SWAP_FEE_ROUTER_ADDRESS`.
2. Run live buy/sell tests against launched token pools.
3. Add on-chain quote function (or reliable router quote path) for accurate `min_out` guard.
4. Add indexer-based chart/ohlc (instead of relying only on public API availability).
