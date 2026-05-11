import { NextResponse } from 'next/server';
import { assertRateLimit, assertSameOrigin, RouteGuardError } from '~~/lib/server/mutation-guard';
import { canonicalAddress } from '~~/lib/starknet/address';
import { persistTokenLaunchFromChain, syncTokenLaunchesFromChain } from '~~/lib/token-launchpad/tokens';

type Body = {
  tokenAddress?: string;
  txHash?: string;
  force?: boolean;
};

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    assertRateLimit(request, { key: 'token-sync-write', limit: 30, windowMs: 5 * 60 * 1000 });

    const body = (await request.json().catch(() => ({}))) as Body;
    const tokenAddressRaw = body.tokenAddress?.trim() || '';
    const txHash = body.txHash?.trim() || '';

    if (tokenAddressRaw) {
      const tokenAddress = canonicalAddress(tokenAddressRaw);
      if (!tokenAddress.startsWith('0x')) {
        return NextResponse.json({ error: 'tokenAddress is invalid.' }, { status: 400 });
      }
      const record = await persistTokenLaunchFromChain({ tokenAddress, txHash: txHash || undefined });
      if (!record) {
        return NextResponse.json({ error: 'Token could not be read from chain.' }, { status: 502 });
      }
      return NextResponse.json({
        ok: true,
        token: {
          address: record.address,
          name: record.name,
          symbol: record.symbol,
          isLaunched: record.isLaunched,
        },
      });
    }

    await syncTokenLaunchesFromChain({ force: Boolean(body.force) });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to sync token launches.' },
      { status: error instanceof RouteGuardError ? error.status : 500 },
    );
  }
}
