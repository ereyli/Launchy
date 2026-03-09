import 'server-only';

import { env } from '~~/lib/config';
import { getCandles, pairKey } from '~~/lib/storage/market-store';
import type { TokenLaunchRecord } from '~~/lib/token-launchpad/types';
import { canonicalAddress } from '~~/lib/starknet/address';

const COINGECKO_URL = 'https://api.coingecko.com/api/v3/simple/price?ids=starknet&vs_currencies=usd';

function toNumberSafe(value: string) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

export async function fetchStrkUsdPrice() {
  return fetch(COINGECKO_URL, {
    headers: { accept: 'application/json' },
    next: { revalidate: 60 },
  })
    .then((res) => (res.ok ? res.json() : null))
    .then((json) => Number((json as any)?.starknet?.usd || 0))
    .catch(() => 0);
}

export async function attachLiveTokenMarket<T extends TokenLaunchRecord>(tokens: T[]) {
  const quote = canonicalAddress(
    env.NEXT_PUBLIC_STRK_ADDRESS || '0x04718f5a0fc34cc1af16a1cdee98ffb20c31f5cd61d6ab07201858f4287c938d',
  );
  const strkUsd = await fetchStrkUsdPrice();

  const enriched = await Promise.all(
    tokens.map(async (token) => {
      const initialMcUsd = Number(token.initialMarketCapUsd || 0);
      if (!token.isLaunched || strkUsd <= 0) {
        return {
          ...token,
          marketCapUsd: initialMcUsd > 0 ? initialMcUsd : 0,
          change24hPct: 0,
        };
      }

      const pair = pairKey(token.address, token.launchData?.quoteToken || quote);
      const candles = await getCandles(pair, 3600, 25);
      const latest = candles[candles.length - 1];
      const previous24h = candles.length > 1 ? candles[0] : undefined;
      const supply = toNumberSafe(token.totalSupplyFormatted);

      const currentMcUsd =
        latest && latest.close > 0 && supply > 0
          ? latest.close * supply * strkUsd
          : initialMcUsd > 0
            ? initialMcUsd
            : 0;

      let change24hPct = 0;
      if (latest && previous24h && previous24h.close > 0) {
        change24hPct = ((latest.close - previous24h.close) / previous24h.close) * 100;
      }

      return {
        ...token,
        marketCapUsd: currentMcUsd,
        change24hPct: Number.isFinite(change24hPct) ? change24hPct : 0,
      };
    }),
  );

  return enriched;
}
