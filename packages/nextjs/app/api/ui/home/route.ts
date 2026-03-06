import { NextResponse } from 'next/server';
import { fetchLaunchpadData } from '~~/lib/launchpad/collections';
import { fetchLatestTokenLaunches } from '~~/lib/token-launchpad/tokens';

export const revalidate = 60;

export async function GET() {
  const [nftData, tokens] = await Promise.all([
    fetchLaunchpadData(),
    fetchLatestTokenLaunches(24),
  ]);

  return NextResponse.json({
    collections: nftData.collections,
    deployFeeStrk: nftData.deployFeeStrk,
    mintFeeStrk: nftData.mintFeeStrk,
    factoryAddress: nftData.factoryAddress,
    tokens: tokens.map((token) => ({
      address: token.address,
      name: token.name,
      symbol: token.symbol,
      logoImageUrl: token.logoImageUrl,
      totalSupplyFormatted: token.totalSupplyFormatted,
      isLaunched: token.isLaunched,
      initialMarketCapUsd: token.initialMarketCapUsd ?? 0,
    })),
  });
}
