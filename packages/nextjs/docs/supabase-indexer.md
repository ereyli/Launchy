# Supabase + SQLite Indexer Setup

## 1) Env

Add in `packages/nextjs/.env.local`:

```bash
SUPABASE_URL=...
SUPABASE_SERVICE_ROLE_KEY=...
INDEXER_SQLITE_PATH=.deploy/market.db
```

- If Supabase env vars exist, reads/writes use Supabase.
- If not, app falls back to local SQLite (`INDEXER_SQLITE_PATH`).
- If SQLite dependency is missing, app still works with in-memory fallback.

## 2) Schema

Run:

- `packages/nextjs/docs/supabase-schema.sql`

in Supabase SQL Editor.

## 3) What is stored

- `indexer_cursors`: last scanned block per pair/router
- `swaps`: normalized swap events
- `candles_1m/5m/15m/1h`: OHLCV buckets
- `token_profiles`: token logo + metadata (CID, URL, name, symbol)

## 4) Runtime behavior

- Candles API (`/api/market/candles`) indexes latest blocks on request.
- New swaps are persisted, candles upserted, and cursor advanced.
- Chart supports timeframe switch (`1m/5m/15m/1h`) using persisted candles.
