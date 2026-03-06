import { NextResponse } from 'next/server';
import { assertRateLimit, assertSameOrigin, RouteGuardError } from '~~/lib/server/mutation-guard';
import { setNftCollectionHidden } from '~~/lib/storage/market-store';

type Body = {
  collectionAddress?: string;
  hidden?: boolean;
};

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    assertRateLimit(request, { key: 'nft-hide-write', limit: 30, windowMs: 10 * 60 * 1000 });

    const body = (await request.json()) as Body;
    const collectionAddress = String(body.collectionAddress || '').trim();
    if (!collectionAddress.startsWith('0x')) {
      return NextResponse.json({ error: 'collectionAddress is required.' }, { status: 400 });
    }

    await setNftCollectionHidden(collectionAddress, Boolean(body.hidden));
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to update NFT visibility.' },
      { status: error instanceof RouteGuardError ? error.status : 500 },
    );
  }
}
