# Mainnet Security Runbook

## LP Lock Policy

Current token launch model uses Ekubo position NFTs minted to factory-owned custody. The flow intentionally keeps LP principal locked.

- Principal liquidity: locked in factory-controlled Ekubo position.
- Creator claim path: fee-only claim via `withdraw_creator_fees`.
- Principal withdrawal: not exposed in external ABI.

Policy statement:
- "Principal liquidity is locked. Only accrued quote fees are withdrawable by token owner."

## Emergency Pause Controls

Two contracts now include emergency pause:

- `TokenFactory.set_paused(bool)`
  - Pauses create/launch flows.
- `EkuboFeeSwapper.set_paused(bool)`
  - Pauses swap execution (`swap_exact_input`).

Use cases:
- compromised dependency or suspicious pool behavior,
- abnormal fee routing,
- exploit in integration path.

## Operational Alert Rules (Event Monitoring)

Monitor these events in real-time and trigger pager/webhook alerts:

1. Critical config changes
- `TokenFactory::PlatformConfigUpdated`
- `TokenFactory::EkuboCoreUpdated`
- `TokenFactory::EkuboPositionsUpdated`
- `TokenFactory::PauseUpdated`
- `EkuboFeeSwapper::FeeConfigUpdated`
- `EkuboFeeSwapper::EkuboCoreUpdated`
- `EkuboFeeSwapper::PauseUpdated`

2. Launch/swap anomalies
- `MemecoinLaunched` with unexpected quote token (should always be STRK under current policy)
- `SwapExecuted` where `platform_fee_amount` deviates from configured bps
- bursts of failed swap tx around same pool

3. Admin key risk indicators
- Any admin transaction outside deployment window
- Multiple config writes in short period

## Incident Response

1. Immediately call:
- `TokenFactory.set_paused(true)`
- `EkuboFeeSwapper.set_paused(true)`

2. Snapshot state:
- affected token addresses,
- Ekubo pool keys,
- recent tx hashes and event logs.

3. Publish status update and remediation plan.

4. Resume only after root-cause validation and postmortem.

## Quote Token Policy

For MVP/mainnet safety, launch quote token is restricted to `platform_fee_token` (STRK policy).

Benefits:
- removes malicious/illiquid quote token attack surface,
- standardizes launch math and UX,
- simplifies monitoring.
