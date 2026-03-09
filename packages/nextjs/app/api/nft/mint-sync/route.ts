import { NextResponse } from 'next/server';
import { fetchCollectionByAddress } from '~~/lib/launchpad/collections';
import { getNftCollectionByAddress, upsertNftCollections } from '~~/lib/storage/market-store';
import { canonicalAddress } from '~~/lib/starknet/address';

type Body = {
  collectionAddress?: string;
};

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as Body;
    const collectionAddress = canonicalAddress(body.collectionAddress || '');
    if (!collectionAddress.startsWith('0x')) {
      return NextResponse.json({ error: 'collectionAddress is required.' }, { status: 400 });
    }

    const [collection, existing] = await Promise.all([
      fetchCollectionByAddress(collectionAddress),
      getNftCollectionByAddress(collectionAddress),
    ]);

    await upsertNftCollections([
      {
        collection_address: collection.address,
        idx: existing?.idx ?? collection.index ?? 0,
        name: collection.name,
        symbol: collection.symbol,
        creator: existing?.creator ?? collection.creator,
        model: collection.model,
        mint_price_strk: collection.mintPriceStrk,
        minted: collection.minted,
        max_supply: collection.maxSupply,
        progress_pct: collection.progressPct,
        base_uri: collection.baseUri,
        image_url: collection.imageUrl || existing?.image_url || null,
        created_tx_hash: existing?.created_tx_hash ?? null,
      },
    ]);

    return NextResponse.json({ ok: true, minted: collection.minted });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to sync NFT mint state.' },
      { status: 500 },
    );
  }
}
