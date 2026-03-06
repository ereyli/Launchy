-- Run this in Supabase SQL Editor.
create table if not exists public.indexer_cursors (
  id text primary key,
  last_block bigint not null,
  updated_at timestamptz not null default now()
);

create table if not exists public.swaps (
  id text primary key,
  pair text not null,
  block_number bigint not null,
  ts bigint not null,
  token_in text not null,
  token_out text not null,
  amount_in text not null,
  amount_out text not null,
  tx_hash text not null,
  event_index integer not null,
  quote_per_token double precision not null,
  volume_quote double precision not null
);
create index if not exists swaps_pair_ts_idx on public.swaps(pair, ts desc);

create table if not exists public.token_profiles (
  token_address text primary key,
  image_cid text not null,
  image_url text not null,
  name text not null default '',
  symbol text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.token_launches (
  token_address text primary key,
  owner text not null,
  name text not null,
  symbol text not null,
  total_supply text not null,
  total_supply_formatted text not null,
  is_launched boolean not null,
  quote_token text,
  created_tx_hash text,
  created_at_block bigint,
  updated_at timestamptz not null default now()
);
create index if not exists token_launches_block_idx on public.token_launches(created_at_block desc);

create table if not exists public.token_launch_meta (
  token_address text primary key,
  initial_market_cap_usd double precision,
  updated_at timestamptz not null default now()
);

create table if not exists public.candles_1m (
  pair text not null,
  bucket_start bigint not null,
  open double precision not null,
  high double precision not null,
  low double precision not null,
  close double precision not null,
  volume_quote double precision not null,
  updated_at timestamptz not null default now(),
  primary key (pair, bucket_start)
);
create index if not exists candles_1m_pair_bucket_idx on public.candles_1m(pair, bucket_start desc);

create table if not exists public.candles_5m (
  pair text not null,
  bucket_start bigint not null,
  open double precision not null,
  high double precision not null,
  low double precision not null,
  close double precision not null,
  volume_quote double precision not null,
  updated_at timestamptz not null default now(),
  primary key (pair, bucket_start)
);
create index if not exists candles_5m_pair_bucket_idx on public.candles_5m(pair, bucket_start desc);

create table if not exists public.candles_15m (
  pair text not null,
  bucket_start bigint not null,
  open double precision not null,
  high double precision not null,
  low double precision not null,
  close double precision not null,
  volume_quote double precision not null,
  updated_at timestamptz not null default now(),
  primary key (pair, bucket_start)
);
create index if not exists candles_15m_pair_bucket_idx on public.candles_15m(pair, bucket_start desc);

create table if not exists public.candles_1h (
  pair text not null,
  bucket_start bigint not null,
  open double precision not null,
  high double precision not null,
  low double precision not null,
  close double precision not null,
  volume_quote double precision not null,
  updated_at timestamptz not null default now(),
  primary key (pair, bucket_start)
);
create index if not exists candles_1h_pair_bucket_idx on public.candles_1h(pair, bucket_start desc);

create table if not exists public.nft_collections (
  collection_address text primary key,
  idx bigint not null,
  name text not null,
  symbol text not null,
  creator text not null,
  model text not null,
  mint_price_strk text not null,
  minted bigint not null,
  max_supply bigint not null,
  progress_pct double precision not null,
  base_uri text not null,
  image_url text,
  created_tx_hash text,
  updated_at timestamptz not null default now()
);
create index if not exists nft_collections_idx_desc on public.nft_collections(idx desc);

create table if not exists public.nft_launchpad_meta (
  factory_address text primary key,
  deploy_fee_strk text not null,
  mint_fee_strk text not null,
  collection_count bigint not null,
  updated_at timestamptz not null default now()
);
