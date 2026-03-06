# Ekubo Price Feed Strategy (Current + Next)

## Chosen MVP Approach

We use:

1. `Ekubo candles` (`/api/ekubo/price-history`) as primary chart source.
2. `Spot fallback` (`/api/ekubo/spot-quote`) when candles are missing or not yet indexed.

This is best for current launchpad architecture because:

- No extra infra is required.
- Works immediately after token launch.
- Keeps UI responsive while pair data is still warming up.

## How Fallback Works

- Frontend first requests candle history.
- If candle list is empty or unavailable, frontend starts polling spot quotes every ~8s.
- Spot quotes are sampled and rendered as a micro-chart.
- UI label switches to `Spot micro-chart`.

## Current Limitations

- Spot fallback is a sampled quote series, not true OHLC candles.
- Candles remain the source of truth for historical charting.

## Advanced Plan: Custom Indexer (Event -> OHLC)

For long-term accurate charting:

1. Index Ekubo swap events for selected pools.
2. Store normalized trade ticks (`timestamp`, `price`, `amount`, `side`).
3. Build OHLC candles in multiple resolutions (1m, 5m, 1h).
4. Expose chart API from our backend, with pagination and caching.
5. Keep spot quote endpoint only as a fail-safe.

This provides deterministic and fully owned analytics, including market-cap and volume series.
