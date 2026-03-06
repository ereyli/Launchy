# Starknet Token Launchpad Research (Unruggable Model)

## Scope
- Goal: extend this project from NFT-only to **dual mode**:
  - NFT Launchpad (already live)
  - Token Launchpad (new)
- Reference architecture: [unruggable.meme](https://github.com/keep-starknet-strange/unruggable.meme)

## What was studied from Unruggable

### 1) Contract architecture
- `Factory` is the main entrypoint.
  - `create_memecoin(owner, name, symbol, initial_supply, salt)`
  - launch entrypoints per DEX:
    - `launch_on_ekubo(...)`
    - `launch_on_jediswap(...)`
    - `launch_on_starkdefi(...)`
- `UnruggableMemecoin` token extends ERC20 behavior with launch metadata and anti-rug restrictions.
  - `is_launched`
  - launch liquidity metadata
  - transfer restriction window after launch
- `EkuboLauncher` owns/manages Ekubo LP NFT position and enables fee withdrawal by token owner.
- `LockManager`/locker pattern used for LP lock management on AMMs that return LP tokens.

### 2) Ekubo launch model
- Capital-efficient launch with concentrated liquidity.
- Team allocation buyback logic at launch.
- LP position held in launcher/manager contract.
- Fee collection is allowed, while liquidity principal remains locked by design.

### 3) Frontend flow model
- Multi-step launch UX:
  1. AMM selection
  2. Team allocation
  3. Anti-bot/hold limits
  4. Liquidity parameters
  5. Confirm + execute multicall
- Data layer:
  - Factory SDK-style abstraction
  - event + contract reads for launch state

## Mapping to this project

### Product structure decision
- Keep NFT Launchpad untouched.
- Add **separate Token Launchpad routes** and logic:
  - `/token/create`
  - `/tokens`
  - `/token/[address]`

### Technical decisions
- Token module uses `NEXT_PUBLIC_TOKEN_FACTORY_ADDRESS`.
- Use existing wallet session layer (Cartridge + injected + paymaster setup already present).
- Keep all text in English in UI.

## Implemented in this phase

### Frontend routes
- Token deploy page: `/token/create`
- Token list page: `/tokens`
- Token details page: `/token/[address]`

### Token client layer
- Added `lib/token-launchpad/client.ts`
  - `createMemecoin(...)` transaction flow
  - event parsing for `MemecoinCreated`
- Added `lib/token-launchpad/tokens.ts`
  - fetch latest token deployments via factory events
  - token metadata reads (name, symbol, owner, total_supply, is_launched)

### Sepolia deployment (this repository)
- Token memecoin class hash:
  - `0x06b8ea97697a6ae23d34905036ac8e622ef958dddcf107d5f72afa13003fed10`
- Token factory class hash:
  - `0x048d53f4cb0a495d9001ada82e75b24e79bf2a861dd5310db9824007719b4054`
- Token factory address:
  - `0x0753e072415d04d15d6bef1b8936b509349e98b43f2b2649e6072f8088eb5dfc`
- Deployment tx:
  - `0x037198edae7dbf467423466c1532c98084b3873db0e26c280f0f3a8c926e964c`
- Deployment artifact:
  - `.deploy/sepolia/token_deployment.json`

### Shared/config updates
- Added `NEXT_PUBLIC_TOKEN_FACTORY_ADDRESS` to env config.
- Added nav links for token module.
- Home page now explicitly shows NFT and Token launchpad modules separately.

## Remaining work (next phase)

### Phase 2: real Ekubo core integration (completed)
1. `TokenFactory.launch_on_ekubo` now opens a real Ekubo pool on-chain:
   - transfers token LP supply from creator to Ekubo `positions`
   - computes `PoolKey` + bounded range from launch params
   - calls `core.maybe_initialize_pool(...)`
   - calls `positions.mint_and_deposit(...)` and stores `position_id`
2. Sepolia Ekubo contracts wired:
   - Core: `0x0444a09d96389aa7148f1aada508e30b71299ffe650d9c97fdaae38cb9a23384`
   - Positions: `0x06a2aee84bb0ed5dded4384ddd0e40e9c1372b818668375ab8e3ec08807417e5`
3. Frontend launch flow updated:
   - launch now approves memecoin balance to factory before `launch_on_ekubo`
   - optional quote seed amount (`0` by default)
4. Trade panel is now moving to direct Ekubo fee-router execution (single-pool first).

### Phase 3: production hardening
1. Add indexer-backed token discovery (instead of event scan only).
2. Add stricter input validation and simulation before signing.
3. Add test suite:
   - unit tests for calldata builders
   - integration tests for create + launch flow on Sepolia.

## Security notes
- Token launch flow must enforce:
  - bounded team allocation
  - minimum/maximum anti-bot parameters
  - strict quote token allowlist
- All launch paths should be protected with simulation + explicit user confirmation.

## Ops notes
- This repo currently supports Sepolia-first rollout.
- Mainnet rollout should only happen after:
  - successful end-to-end test on Sepolia
  - parameter freeze review
  - deployment checklist signoff.
