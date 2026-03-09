import { NextResponse } from 'next/server';
import { attachLiveTokenMarket } from '~~/lib/token-launchpad/live-market';
import { fetchLatestTokenLaunches } from '~~/lib/token-launchpad/tokens';

export const revalidate = 60;

export async function GET() {
  const tokens = await fetchLatestTokenLaunches(100);
  const liveTokens = await attachLiveTokenMarket(tokens);
  return NextResponse.json({
    items: liveTokens.map((item) => ({
      address: item.address,
      name: item.name,
      symbol: item.symbol,
      logoImageUrl: item.logoImageUrl,
      totalSupplyFormatted: item.totalSupplyFormatted,
      isLaunched: item.isLaunched,
      marketCapUsd: item.marketCapUsd ?? item.initialMarketCapUsd ?? 0,
      change24hPct: item.change24hPct ?? 0,
    })),
  });
}
