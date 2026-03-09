import { NextResponse } from 'next/server';
import { fetchLaunchpadData } from '~~/lib/launchpad/collections';
import { attachLiveTokenMarket } from '~~/lib/token-launchpad/live-market';
import { fetchLatestTokenLaunches } from '~~/lib/token-launchpad/tokens';

export const dynamic = 'force-dynamic';

export async function GET() {
  const [nftData, tokens] = await Promise.all([
    fetchLaunchpadData(),
    fetchLatestTokenLaunches(24),
  ]);
  const liveTokens = await attachLiveTokenMarket(tokens);

  return NextResponse.json({
    collections: nftData.collections,
    deployFeeStrk: nftData.deployFeeStrk,
    mintFeeStrk: nftData.mintFeeStrk,
    factoryAddress: nftData.factoryAddress,
    tokens: liveTokens.map((token) => ({
      address: token.address,
      name: token.name,
      symbol: token.symbol,
      logoImageUrl: token.logoImageUrl,
      totalSupplyFormatted: token.totalSupplyFormatted,
      isLaunched: token.isLaunched,
      marketCapUsd: token.marketCapUsd ?? token.initialMarketCapUsd ?? 0,
      change24hPct: token.change24hPct ?? 0,
    })),
  });
}
