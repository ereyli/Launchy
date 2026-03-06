import { NextResponse } from 'next/server';
import { fetchLatestTokenLaunches } from '~~/lib/token-launchpad/tokens';

export const revalidate = 60;

export async function GET() {
  const tokens = await fetchLatestTokenLaunches(100);
  return NextResponse.json({
    items: tokens.map((item) => ({
      address: item.address,
      name: item.name,
      symbol: item.symbol,
      logoImageUrl: item.logoImageUrl,
      totalSupplyFormatted: item.totalSupplyFormatted,
      isLaunched: item.isLaunched,
      marketCapUsd: item.initialMarketCapUsd ?? 0,
    })),
  });
}
