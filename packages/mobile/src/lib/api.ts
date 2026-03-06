import { mobileEnv } from '~/lib/config';
import type { CandleRow, NftCard, TokenCard, TokenDetail, TradeRow } from '~/types/market';

async function fetchJson<T>(path: string): Promise<T> {
  const response = await fetch(`${mobileEnv.apiBaseUrl}${path}`);
  if (!response.ok) {
    throw new Error(`API failed: ${response.status}`);
  }
  return response.json() as Promise<T>;
}

export async function fetchTokens(): Promise<TokenCard[]> {
  const data = await fetchJson<{ items?: TokenCard[] }>('/api/mobile/tokens');
  return data.items ?? [];
}

export async function fetchTokenDetail(address: string): Promise<TokenDetail | null> {
  const data = await fetchJson<{ token?: TokenDetail }>(`/api/mobile/token/${encodeURIComponent(address)}`);
  return data.token ?? null;
}

export async function fetchNfts(): Promise<NftCard[]> {
  const data = await fetchJson<{ items?: NftCard[] }>('/api/nft/collection-meta?limit=50');
  return data.items ?? [];
}

export async function fetchCandles(base: string, quote: string, timeframe: 60 | 300 | 900 | 3600) {
  const data = await fetchJson<{ series?: CandleRow[] }>(
    `/api/market/candles?base=${encodeURIComponent(base)}&quote=${encodeURIComponent(quote)}&timeframe=${timeframe}`,
  );
  return data.series ?? [];
}

export async function fetchTrades(base: string, quote: string, limit = 8) {
  const data = await fetchJson<{ trades?: TradeRow[] }>(
    `/api/market/trades?base=${encodeURIComponent(base)}&quote=${encodeURIComponent(quote)}&limit=${limit}`,
  );
  return data.trades ?? [];
}
