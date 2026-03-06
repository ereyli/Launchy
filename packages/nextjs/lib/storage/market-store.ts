import 'server-only';

import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { createClient } from '@supabase/supabase-js';
import { env } from '~~/lib/config';
import { canonicalAddress } from '~~/lib/starknet/address';

type CursorRow = {
  id: string;
  last_block: number;
  updated_at: string;
};

type SwapRow = {
  id: string;
  pair: string;
  block_number: number;
  ts: number;
  token_in: string;
  token_out: string;
  amount_in: string;
  amount_out: string;
  tx_hash: string;
  event_index: number;
  quote_per_token: number;
  volume_quote: number;
};

type CandleRow = {
  pair: string;
  bucket_start: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume_quote: number;
  updated_at: string;
};

type TokenProfileRow = {
  token_address: string;
  image_cid: string;
  image_url: string;
  name: string;
  symbol: string;
  created_at: string;
  updated_at: string;
};

type TokenLaunchRow = {
  token_address: string;
  owner: string;
  name: string;
  symbol: string;
  total_supply: string;
  total_supply_formatted: string;
  is_launched: boolean;
  quote_token: string | null;
  created_tx_hash: string | null;
  created_at_block: number | null;
  updated_at: string;
};

type NftCollectionRow = {
  collection_address: string;
  idx: number;
  name: string;
  symbol: string;
  creator: string;
  model: 'free' | 'paid';
  mint_price_strk: string;
  minted: number;
  max_supply: number;
  progress_pct: number;
  base_uri: string;
  image_url: string | null;
  created_tx_hash: string | null;
  updated_at: string;
};

const HIDDEN_NFT_MARKER = '__hidden__:';

function isHiddenNftRow(row: Pick<NftCollectionRow, 'created_tx_hash'>) {
  return String(row.created_tx_hash || '').startsWith(HIDDEN_NFT_MARKER);
}

type NftLaunchpadMetaRow = {
  factory_address: string;
  deploy_fee_strk: string;
  mint_fee_strk: string;
  collection_count: number;
  updated_at: string;
};

export type CandleRecord = {
  start: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
};

type SqliteDb = {
  exec: (sql: string) => void;
  prepare: (sql: string) => {
    get: (...args: unknown[]) => any;
    all: (...args: unknown[]) => any[];
    run: (...args: unknown[]) => any;
  };
};

let sqliteDbPromise: Promise<SqliteDb | null> | null = null;

function nowIso() {
  return new Date().toISOString();
}

function hasSupabase() {
  return Boolean(env.SUPABASE_URL && env.SUPABASE_SERVICE_ROLE_KEY);
}

function supabase() {
  if (!hasSupabase()) return null;
  return createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });
}

async function sqliteDb() {
  if (!env.INDEXER_SQLITE_PATH) return null;
  if (sqliteDbPromise) return sqliteDbPromise;
  sqliteDbPromise = (async () => {
    try {
      const mod = await import('better-sqlite3');
      const Database = (mod.default ?? mod) as any;
      const filePath = path.isAbsolute(env.INDEXER_SQLITE_PATH)
        ? env.INDEXER_SQLITE_PATH
        : path.join(process.cwd(), env.INDEXER_SQLITE_PATH);
      await mkdir(path.dirname(filePath), { recursive: true });
      const db = new Database(filePath) as SqliteDb;
      db.exec(`
        CREATE TABLE IF NOT EXISTS indexer_cursors (
          id TEXT PRIMARY KEY,
          last_block INTEGER NOT NULL,
          updated_at TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS swaps (
          id TEXT PRIMARY KEY,
          pair TEXT NOT NULL,
          block_number INTEGER NOT NULL,
          ts INTEGER NOT NULL,
          token_in TEXT NOT NULL,
          token_out TEXT NOT NULL,
          amount_in TEXT NOT NULL,
          amount_out TEXT NOT NULL,
          tx_hash TEXT NOT NULL,
          event_index INTEGER NOT NULL,
          quote_per_token REAL NOT NULL,
          volume_quote REAL NOT NULL
        );
        CREATE INDEX IF NOT EXISTS swaps_pair_ts_idx ON swaps(pair, ts DESC);
        CREATE TABLE IF NOT EXISTS token_profiles (
          token_address TEXT PRIMARY KEY,
          image_cid TEXT NOT NULL,
          image_url TEXT NOT NULL,
          name TEXT NOT NULL DEFAULT '',
          symbol TEXT NOT NULL DEFAULT '',
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS token_launches (
          token_address TEXT PRIMARY KEY,
          owner TEXT NOT NULL,
          name TEXT NOT NULL,
          symbol TEXT NOT NULL,
          total_supply TEXT NOT NULL,
          total_supply_formatted TEXT NOT NULL,
          is_launched INTEGER NOT NULL,
          quote_token TEXT,
          created_tx_hash TEXT,
          created_at_block INTEGER,
          updated_at TEXT NOT NULL
        );
        CREATE INDEX IF NOT EXISTS token_launches_block_idx ON token_launches(created_at_block DESC);
        CREATE TABLE IF NOT EXISTS token_launch_meta (
          token_address TEXT PRIMARY KEY,
          initial_market_cap_usd REAL,
          updated_at TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS nft_collections (
          collection_address TEXT PRIMARY KEY,
          idx INTEGER NOT NULL,
          name TEXT NOT NULL,
          symbol TEXT NOT NULL,
          creator TEXT NOT NULL,
          model TEXT NOT NULL,
          mint_price_strk TEXT NOT NULL,
          minted INTEGER NOT NULL,
          max_supply INTEGER NOT NULL,
          progress_pct REAL NOT NULL,
          base_uri TEXT NOT NULL,
          image_url TEXT,
          created_tx_hash TEXT,
          updated_at TEXT NOT NULL
        );
        CREATE INDEX IF NOT EXISTS nft_collections_idx_desc ON nft_collections(idx DESC);
        CREATE TABLE IF NOT EXISTS nft_launchpad_meta (
          factory_address TEXT PRIMARY KEY,
          deploy_fee_strk TEXT NOT NULL,
          mint_fee_strk TEXT NOT NULL,
          collection_count INTEGER NOT NULL,
          updated_at TEXT NOT NULL
        );
      `);
      for (const tf of ['1m', '5m', '15m', '1h']) {
        db.exec(`
          CREATE TABLE IF NOT EXISTS candles_${tf} (
            pair TEXT NOT NULL,
            bucket_start INTEGER NOT NULL,
            open REAL NOT NULL,
            high REAL NOT NULL,
            low REAL NOT NULL,
            close REAL NOT NULL,
            volume_quote REAL NOT NULL,
            updated_at TEXT NOT NULL,
            PRIMARY KEY (pair, bucket_start)
          );
          CREATE INDEX IF NOT EXISTS candles_${tf}_pair_bucket_idx ON candles_${tf}(pair, bucket_start DESC);
        `);
      }
      return db;
    } catch {
      return null;
    }
  })();
  return sqliteDbPromise;
}

function normalizePair(base: string, quote: string) {
  return `${canonicalAddress(base).toLowerCase()}_${canonicalAddress(quote).toLowerCase()}`;
}

export function pairKey(base: string, quote: string) {
  return normalizePair(base, quote);
}

const tableByTf: Record<string, 'candles_1m' | 'candles_5m' | 'candles_15m' | 'candles_1h'> = {
  '60': 'candles_1m',
  '300': 'candles_5m',
  '900': 'candles_15m',
  '3600': 'candles_1h',
};

const sqliteTableByTf: Record<string, 'candles_1m' | 'candles_5m' | 'candles_15m' | 'candles_1h'> = {
  '60': 'candles_1m',
  '300': 'candles_5m',
  '900': 'candles_15m',
  '3600': 'candles_1h',
};

export async function getCursor(id: string): Promise<number | null> {
  const sb = supabase();
  if (sb) {
    const { data } = await sb.from('indexer_cursors').select('last_block').eq('id', id).maybeSingle();
    return typeof data?.last_block === 'number' ? data.last_block : null;
  }
  const db = await sqliteDb();
  if (!db) return null;
  const row = db.prepare('SELECT last_block FROM indexer_cursors WHERE id = ?').get(id) as
    | { last_block: number }
    | undefined;
  return row?.last_block ?? null;
}

export async function setCursor(id: string, lastBlock: number) {
  const updated = nowIso();
  const row: CursorRow = { id, last_block: lastBlock, updated_at: updated };
  const sb = supabase();
  if (sb) {
    await sb.from('indexer_cursors').upsert(row, { onConflict: 'id' });
    return;
  }
  const db = await sqliteDb();
  if (!db) return;
  db.prepare(
    `INSERT INTO indexer_cursors (id, last_block, updated_at)
     VALUES (?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET last_block=excluded.last_block, updated_at=excluded.updated_at`,
  ).run(row.id, row.last_block, row.updated_at);
}

export async function saveSwaps(rows: SwapRow[]) {
  if (!rows.length) return;
  const sb = supabase();
  if (sb) {
    await sb.from('swaps').upsert(rows, { onConflict: 'id' });
    return;
  }
  const db = await sqliteDb();
  if (!db) return;
  const stmt = db.prepare(
    `INSERT INTO swaps (id, pair, block_number, ts, token_in, token_out, amount_in, amount_out, tx_hash, event_index, quote_per_token, volume_quote)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET quote_per_token=excluded.quote_per_token, volume_quote=excluded.volume_quote`,
  );
  for (const row of rows) {
    stmt.run(
      row.id,
      row.pair,
      row.block_number,
      row.ts,
      row.token_in,
      row.token_out,
      row.amount_in,
      row.amount_out,
      row.tx_hash,
      row.event_index,
      row.quote_per_token,
      row.volume_quote,
    );
  }
}

export async function saveCandles(pair: string, intervalSec: number, rows: CandleRecord[]) {
  const table = tableByTf[String(intervalSec)];
  if (!table || !rows.length) return;
  const updated = nowIso();
  const payload: CandleRow[] = rows.map((row) => ({
    pair,
    bucket_start: row.start,
    open: row.open,
    high: row.high,
    low: row.low,
    close: row.close,
    volume_quote: row.volume,
    updated_at: updated,
  }));
  const sb = supabase();
  if (sb) {
    await sb.from(table).upsert(payload, { onConflict: 'pair,bucket_start' });
    return;
  }
  const db = await sqliteDb();
  if (!db) return;
  const sqliteTable = sqliteTableByTf[String(intervalSec)];
  const stmt = db.prepare(
    `INSERT INTO ${sqliteTable} (pair, bucket_start, open, high, low, close, volume_quote, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(pair, bucket_start) DO UPDATE SET
      open=excluded.open, high=excluded.high, low=excluded.low, close=excluded.close, volume_quote=excluded.volume_quote, updated_at=excluded.updated_at`,
  );
  for (const row of payload) {
    stmt.run(row.pair, row.bucket_start, row.open, row.high, row.low, row.close, row.volume_quote, row.updated_at);
  }
}

export async function getCandles(pair: string, intervalSec: number, limit = 200): Promise<CandleRecord[]> {
  const table = tableByTf[String(intervalSec)];
  if (!table) return [];
  const sb = supabase();
  if (sb) {
    const { data } = await sb
      .from(table)
      .select('bucket_start,open,high,low,close,volume_quote')
      .eq('pair', pair)
      .order('bucket_start', { ascending: false })
      .limit(limit);
    if (!data) return [];
    return [...data]
      .reverse()
      .map((row: any) => ({
        start: Number(row.bucket_start),
        open: Number(row.open),
        high: Number(row.high),
        low: Number(row.low),
        close: Number(row.close),
        volume: Number(row.volume_quote),
      }));
  }
  const db = await sqliteDb();
  if (!db) return [];
  const sqliteTable = sqliteTableByTf[String(intervalSec)];
  const rows = db
    .prepare(
      `SELECT bucket_start, open, high, low, close, volume_quote
       FROM ${sqliteTable}
       WHERE pair = ?
       ORDER BY bucket_start DESC
       LIMIT ?`,
    )
    .all(pair, limit) as Array<{
    bucket_start: number;
    open: number;
    high: number;
    low: number;
    close: number;
    volume_quote: number;
  }>;
  return rows
    .reverse()
    .map((row) => ({
      start: Number(row.bucket_start),
      open: Number(row.open),
      high: Number(row.high),
      low: Number(row.low),
      close: Number(row.close),
      volume: Number(row.volume_quote),
    }));
}

export async function upsertTokenProfile(row: Omit<TokenProfileRow, 'created_at' | 'updated_at'>) {
  const stamp = nowIso();
  const payload: TokenProfileRow = {
    ...row,
    token_address: canonicalAddress(row.token_address).toLowerCase(),
    created_at: stamp,
    updated_at: stamp,
  };
  const sb = supabase();
  if (sb) {
    await sb.from('token_profiles').upsert(payload, { onConflict: 'token_address' });
    return;
  }
  const db = await sqliteDb();
  if (!db) return;
  db.prepare(
    `INSERT INTO token_profiles (token_address, image_cid, image_url, name, symbol, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(token_address) DO UPDATE SET
      image_cid=excluded.image_cid,
      image_url=excluded.image_url,
      name=excluded.name,
      symbol=excluded.symbol,
      updated_at=excluded.updated_at`,
  ).run(
    payload.token_address,
    payload.image_cid,
    payload.image_url,
    payload.name,
    payload.symbol,
    payload.created_at,
    payload.updated_at,
  );
}

export async function getTokenProfileRow(tokenAddress: string): Promise<TokenProfileRow | null> {
  const address = canonicalAddress(tokenAddress).toLowerCase();
  const sb = supabase();
  if (sb) {
    const { data } = await sb.from('token_profiles').select('*').eq('token_address', address).maybeSingle();
    return (data as TokenProfileRow | null) ?? null;
  }
  const db = await sqliteDb();
  if (!db) return null;
  const row = db.prepare('SELECT * FROM token_profiles WHERE token_address = ?').get(address) as TokenProfileRow | undefined;
  return row ?? null;
}

export async function getTokenProfilesRows(): Promise<Record<string, TokenProfileRow>> {
  const sb = supabase();
  if (sb) {
    const { data } = await sb.from('token_profiles').select('*');
    const mapped: Record<string, TokenProfileRow> = {};
    for (const row of data ?? []) {
      const r = row as TokenProfileRow;
      mapped[r.token_address] = r;
    }
    return mapped;
  }
  const db = await sqliteDb();
  if (!db) return {};
  const rows = db.prepare('SELECT * FROM token_profiles').all() as TokenProfileRow[];
  const mapped: Record<string, TokenProfileRow> = {};
  for (const row of rows) {
    mapped[row.token_address] = row;
  }
  return mapped;
}

export async function upsertTokenLaunchRow(
  row: Omit<TokenLaunchRow, 'updated_at'> & { updated_at?: string },
) {
  const payload: TokenLaunchRow = {
    ...row,
    token_address: canonicalAddress(row.token_address).toLowerCase(),
    owner: canonicalAddress(row.owner).toLowerCase(),
    quote_token: row.quote_token ? canonicalAddress(row.quote_token).toLowerCase() : null,
    updated_at: row.updated_at || nowIso(),
  };
  const sb = supabase();
  if (sb) {
    await sb.from('token_launches').upsert(payload, { onConflict: 'token_address' });
    return;
  }
  const db = await sqliteDb();
  if (!db) return;
  db.prepare(
    `INSERT INTO token_launches (
      token_address, owner, name, symbol, total_supply, total_supply_formatted, is_launched, quote_token, created_tx_hash, created_at_block, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(token_address) DO UPDATE SET
      owner=excluded.owner,
      name=excluded.name,
      symbol=excluded.symbol,
      total_supply=excluded.total_supply,
      total_supply_formatted=excluded.total_supply_formatted,
      is_launched=excluded.is_launched,
      quote_token=excluded.quote_token,
      created_tx_hash=excluded.created_tx_hash,
      created_at_block=excluded.created_at_block,
      updated_at=excluded.updated_at`,
  ).run(
    payload.token_address,
    payload.owner,
    payload.name,
    payload.symbol,
    payload.total_supply,
    payload.total_supply_formatted,
    payload.is_launched ? 1 : 0,
    payload.quote_token,
    payload.created_tx_hash,
    payload.created_at_block,
    payload.updated_at,
  );
}

export async function listTokenLaunchRows(limit = 40): Promise<TokenLaunchRow[]> {
  const sb = supabase();
  if (sb) {
    const { data } = await sb
      .from('token_launches')
      .select('*')
      .order('created_at_block', { ascending: false, nullsFirst: false })
      .limit(limit);
    return (data as TokenLaunchRow[] | null) ?? [];
  }
  const db = await sqliteDb();
  if (!db) return [];
  return db
    .prepare('SELECT * FROM token_launches ORDER BY created_at_block DESC LIMIT ?')
    .all(limit) as TokenLaunchRow[];
}

export async function getTokenLaunchRow(tokenAddress: string): Promise<TokenLaunchRow | null> {
  const key = canonicalAddress(tokenAddress).toLowerCase();
  const sb = supabase();
  if (sb) {
    const { data } = await sb.from('token_launches').select('*').eq('token_address', key).maybeSingle();
    return (data as TokenLaunchRow | null) ?? null;
  }
  const db = await sqliteDb();
  if (!db) return null;
  const row = db.prepare('SELECT * FROM token_launches WHERE token_address = ?').get(key) as TokenLaunchRow | undefined;
  return row ?? null;
}

export async function upsertTokenInitialMarketCapUsd(tokenAddress: string, initialMarketCapUsd: number) {
  const payload = {
    token_address: canonicalAddress(tokenAddress).toLowerCase(),
    initial_market_cap_usd: initialMarketCapUsd,
    updated_at: nowIso(),
  };
  const sb = supabase();
  if (sb) {
    const { error } = await sb.from('token_launch_meta').upsert(payload, { onConflict: 'token_address' });
    if (error) return;
    return;
  }
  const db = await sqliteDb();
  if (!db) return;
  db.prepare(
    `INSERT INTO token_launch_meta (token_address, initial_market_cap_usd, updated_at)
     VALUES (?, ?, ?)
     ON CONFLICT(token_address) DO UPDATE SET
      initial_market_cap_usd=excluded.initial_market_cap_usd,
      updated_at=excluded.updated_at`,
  ).run(payload.token_address, payload.initial_market_cap_usd, payload.updated_at);
}

export async function getTokenInitialMarketCapUsdMap() {
  const mapped: Record<string, number> = {};
  const sb = supabase();
  if (sb) {
    const { data, error } = await sb.from('token_launch_meta').select('token_address,initial_market_cap_usd');
    if (!error) {
      for (const row of data ?? []) {
        const key = String((row as any).token_address || '').toLowerCase();
        const value = Number((row as any).initial_market_cap_usd || 0);
        if (key && Number.isFinite(value) && value > 0) mapped[key] = value;
      }
      return mapped;
    }
  }
  const db = await sqliteDb();
  if (!db) return mapped;
  const rows = db
    .prepare('SELECT token_address, initial_market_cap_usd FROM token_launch_meta')
    .all() as Array<{ token_address: string; initial_market_cap_usd: number }>;
  for (const row of rows) {
    if (row.token_address && Number.isFinite(row.initial_market_cap_usd) && row.initial_market_cap_usd > 0) {
      mapped[row.token_address.toLowerCase()] = row.initial_market_cap_usd;
    }
  }
  return mapped;
}

export async function getTokenInitialMarketCapUsd(tokenAddress: string) {
  const key = canonicalAddress(tokenAddress).toLowerCase();
  const sb = supabase();
  if (sb) {
    const { data } = await sb
      .from('token_launch_meta')
      .select('initial_market_cap_usd')
      .eq('token_address', key)
      .maybeSingle();
    const value = Number((data as { initial_market_cap_usd?: number } | null)?.initial_market_cap_usd ?? 0);
    return Number.isFinite(value) && value > 0 ? value : null;
  }
  const db = await sqliteDb();
  if (!db) return null;
  const row = db
    .prepare('SELECT initial_market_cap_usd FROM token_launch_meta WHERE token_address = ?')
    .get(key) as { initial_market_cap_usd?: number } | undefined;
  const value = Number(row?.initial_market_cap_usd ?? 0);
  return Number.isFinite(value) && value > 0 ? value : null;
}

export async function upsertNftCollections(rows: Array<Omit<NftCollectionRow, 'updated_at'> & { updated_at?: string }>) {
  if (!rows.length) return;
  const payload = rows.map((row) => ({
    ...row,
    collection_address: canonicalAddress(row.collection_address).toLowerCase(),
    creator: canonicalAddress(row.creator).toLowerCase(),
    updated_at: row.updated_at || nowIso(),
  }));
  const sb = supabase();
  if (sb) {
    await sb.from('nft_collections').upsert(payload, { onConflict: 'collection_address' });
    return;
  }
  const db = await sqliteDb();
  if (!db) return;
  const stmt = db.prepare(
    `INSERT INTO nft_collections (
      collection_address, idx, name, symbol, creator, model, mint_price_strk, minted, max_supply, progress_pct, base_uri, image_url, created_tx_hash, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(collection_address) DO UPDATE SET
      idx=excluded.idx, name=excluded.name, symbol=excluded.symbol, creator=excluded.creator,
      model=excluded.model, mint_price_strk=excluded.mint_price_strk, minted=excluded.minted, max_supply=excluded.max_supply,
      progress_pct=excluded.progress_pct, base_uri=excluded.base_uri, image_url=excluded.image_url,
      created_tx_hash=excluded.created_tx_hash, updated_at=excluded.updated_at`,
  );
  for (const row of payload) {
    stmt.run(
      row.collection_address,
      row.idx,
      row.name,
      row.symbol,
      row.creator,
      row.model,
      row.mint_price_strk,
      row.minted,
      row.max_supply,
      row.progress_pct,
      row.base_uri,
      row.image_url,
      row.created_tx_hash,
      row.updated_at,
    );
  }
}

export async function listNftCollections(limit = 500): Promise<NftCollectionRow[]> {
  const sb = supabase();
  if (sb) {
    const { data } = await sb.from('nft_collections').select('*').order('idx', { ascending: false }).limit(limit * 3);
    return ((data as NftCollectionRow[] | null) ?? []).filter(row => !isHiddenNftRow(row)).slice(0, limit);
  }
  const db = await sqliteDb();
  if (!db) return [];
  return (db.prepare('SELECT * FROM nft_collections ORDER BY idx DESC LIMIT ?').all(limit * 3) as NftCollectionRow[])
    .filter((row) => !isHiddenNftRow(row))
    .slice(0, limit);
}

export async function getNftCollectionByAddress(address: string): Promise<NftCollectionRow | null> {
  const key = canonicalAddress(address).toLowerCase();
  const sb = supabase();
  if (sb) {
    const { data } = await sb.from('nft_collections').select('*').eq('collection_address', key).maybeSingle();
    return (data as NftCollectionRow | null) ?? null;
  }
  const db = await sqliteDb();
  if (!db) return null;
  const row = db.prepare('SELECT * FROM nft_collections WHERE collection_address = ?').get(key) as NftCollectionRow | undefined;
  return row ?? null;
}

export async function setNftCollectionHidden(address: string, hidden: boolean) {
  const key = canonicalAddress(address).toLowerCase();
  const stamp = nowIso();
  const sb = supabase();
  if (sb) {
    const { data } = await sb.from('nft_collections').select('created_tx_hash').eq('collection_address', key).maybeSingle();
    const current = (data as Pick<NftCollectionRow, 'created_tx_hash'> | null)?.created_tx_hash || null;
    const nextValue = hidden
      ? `${HIDDEN_NFT_MARKER}${current && !String(current).startsWith(HIDDEN_NFT_MARKER) ? current : ''}`
      : String(current || '').replace(HIDDEN_NFT_MARKER, '') || null;
    await sb.from('nft_collections').update({ created_tx_hash: nextValue, updated_at: stamp }).eq('collection_address', key);
    return;
  }
  const db = await sqliteDb();
  if (!db) return;
  const row = db.prepare('SELECT created_tx_hash FROM nft_collections WHERE collection_address = ?').get(key) as { created_tx_hash?: string | null } | undefined;
  const current = row?.created_tx_hash || null;
  const nextValue = hidden
    ? `${HIDDEN_NFT_MARKER}${current && !String(current).startsWith(HIDDEN_NFT_MARKER) ? current : ''}`
    : String(current || '').replace(HIDDEN_NFT_MARKER, '') || null;
  db.prepare('UPDATE nft_collections SET created_tx_hash = ?, updated_at = ? WHERE collection_address = ?').run(nextValue, stamp, key);
}

export async function upsertNftLaunchpadMeta(row: Omit<NftLaunchpadMetaRow, 'updated_at'> & { updated_at?: string }) {
  const payload: NftLaunchpadMetaRow = {
    ...row,
    factory_address: canonicalAddress(row.factory_address).toLowerCase(),
    updated_at: row.updated_at || nowIso(),
  };
  const sb = supabase();
  if (sb) {
    await sb.from('nft_launchpad_meta').upsert(payload, { onConflict: 'factory_address' });
    return;
  }
  const db = await sqliteDb();
  if (!db) return;
  db.prepare(
    `INSERT INTO nft_launchpad_meta (factory_address, deploy_fee_strk, mint_fee_strk, collection_count, updated_at)
     VALUES (?, ?, ?, ?, ?)
     ON CONFLICT(factory_address) DO UPDATE SET
      deploy_fee_strk=excluded.deploy_fee_strk, mint_fee_strk=excluded.mint_fee_strk, collection_count=excluded.collection_count, updated_at=excluded.updated_at`,
  ).run(payload.factory_address, payload.deploy_fee_strk, payload.mint_fee_strk, payload.collection_count, payload.updated_at);
}

export async function getNftLaunchpadMeta(factoryAddress: string): Promise<NftLaunchpadMetaRow | null> {
  const key = canonicalAddress(factoryAddress).toLowerCase();
  const sb = supabase();
  if (sb) {
    const { data } = await sb.from('nft_launchpad_meta').select('*').eq('factory_address', key).maybeSingle();
    return (data as NftLaunchpadMetaRow | null) ?? null;
  }
  const db = await sqliteDb();
  if (!db) return null;
  const row = db.prepare('SELECT * FROM nft_launchpad_meta WHERE factory_address = ?').get(key) as NftLaunchpadMetaRow | undefined;
  return row ?? null;
}
