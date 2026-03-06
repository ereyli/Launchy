import { NextResponse } from 'next/server';
import { env } from '~~/lib/config';
import { canonicalAddress } from '~~/lib/starknet/address';
import { pairKey, getCandles } from '~~/lib/storage/market-store';
import { fetchLatestTokenLaunches } from '~~/lib/token-launchpad/tokens';
const COINGECKO_URL = 'https://api.coingecko.com/api/v3/simple/price?ids=starknet&vs_currencies=usd';

function toNumberSafe(value: string) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

export async function GET() {
  try {
    const quote = canonicalAddress(
      env.NEXT_PUBLIC_STRK_ADDRESS || '0x04718f5a0fc34cc1af16a1cdee98ffb20c31f5cd61d6ab07201858f4287c938d',
    );
    const strkUsd = await fetch(COINGECKO_URL, { headers: { accept: 'application/json' }, next: { revalidate: 60 } })
      .then((res) => (res.ok ? res.json() : null))
      .then((json) => Number((json as any)?.starknet?.usd || 0))
      .catch(() => 0);

    const tokens = await fetchLatestTokenLaunches(100);
    const items = await Promise.all(
      tokens.map(async (token) => {
        const pair = pairKey(token.address, quote);
        const candles = await getCandles(pair, 60, 1);
        const quotePerToken = candles[candles.length - 1]?.close || 0;
        const supply = toNumberSafe(token.totalSupplyFormatted);
        const liveMcUsd = quotePerToken > 0 && strkUsd > 0 ? supply * quotePerToken * strkUsd : null;
        const marketCapUsd = liveMcUsd ?? token.initialMarketCapUsd ?? null;

        return {
          address: token.address,
          name: token.name,
          symbol: token.symbol,
          owner: token.owner,
          totalSupply: token.totalSupplyFormatted,
          logoUrl: token.logoImageUrl || null,
          isLaunched: token.isLaunched,
          quoteToken: token.launchData?.quoteToken || quote,
          poolKey: token.launchData
            ? {
                fee: BigInt(token.launchData.fee).toString(),
                tickSpacing: BigInt(token.launchData.tickSpacing).toString(),
                extension: '0x0',
              }
            : null,
          marketCapUsd,
          createdAtBlock: token.createdAtBlock || null,
        };
      }),
    );

    return NextResponse.json({ items });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unexpected mobile tokens error' },
      { status: 500 },
    );
  }
}
