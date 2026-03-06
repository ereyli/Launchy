import { NextRequest, NextResponse } from 'next/server';
import { env } from '~~/lib/config';
import { canonicalAddress } from '~~/lib/starknet/address';
import { fetchTokenByAddress } from '~~/lib/token-launchpad/tokens';

export async function GET(_req: NextRequest, context: { params: Promise<{ address: string }> }) {
  try {
    const { address } = await context.params;
    const token = await fetchTokenByAddress(address);
    const tokenAddress = canonicalAddress(token.address);
    const quoteToken = canonicalAddress(
      token.launchData?.quoteToken ||
      env.NEXT_PUBLIC_STRK_ADDRESS ||
      '0x04718f5a0fc34cc1af16a1cdee98ffb20c31f5cd61d6ab07201858f4287c938d',
    );

    const tokenBig = BigInt(tokenAddress);
    const quoteBig = BigInt(quoteToken);
    const poolKey = token.launchData
      ? {
          token0: tokenBig < quoteBig ? tokenAddress : quoteToken,
          token1: tokenBig < quoteBig ? quoteToken : tokenAddress,
          fee: BigInt(token.launchData.fee).toString(),
          tickSpacing: BigInt(token.launchData.tickSpacing).toString(),
          extension: '0x0',
        }
      : null;

    return NextResponse.json({
      token: {
        address: token.address,
        owner: token.owner,
        name: token.name,
        symbol: token.symbol,
        logoUrl: token.logoImageUrl || null,
        totalSupply: token.totalSupplyFormatted,
        isLaunched: token.isLaunched,
        quoteToken,
        poolKey,
      },
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unexpected mobile token detail error' },
      { status: 500 },
    );
  }
}
