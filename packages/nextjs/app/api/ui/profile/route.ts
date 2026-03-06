import { NextResponse } from 'next/server';
import { fetchLaunchpadData } from '~~/lib/launchpad/collections';
import { fetchLatestTokenLaunches } from '~~/lib/token-launchpad/tokens';

export const revalidate = 60;

export async function GET() {
  const [tokens, nftData] = await Promise.all([fetchLatestTokenLaunches(120), fetchLaunchpadData()]);
  return NextResponse.json({
    tokens: tokens.map((token) => ({
      address: token.address,
      owner: token.owner,
      name: token.name,
      symbol: token.symbol,
      logoImageUrl: token.logoImageUrl,
      isLaunched: token.isLaunched,
      quoteAmountFormatted: token.launchData?.quoteAmountFormatted,
    })),
    collections: nftData.collections,
  });
}
