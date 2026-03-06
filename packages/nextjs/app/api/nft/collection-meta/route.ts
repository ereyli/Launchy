import { NextResponse } from 'next/server';
import { RpcProvider, hash } from 'starknet';
import { canonicalAddress } from '~~/lib/starknet/address';
import { upsertNftCollections } from '~~/lib/storage/market-store';

type Body = {
  collectionAddress?: string;
  txHash?: string;
  name?: string;
  symbol?: string;
  creator?: string;
  model?: 'free' | 'paid';
  mintPriceStrk?: string;
  maxSupply?: number;
  baseUri?: string;
  imageUrl?: string;
};

const DEFAULT_RPC = 'https://starknet-mainnet-rpc.publicnode.com';

async function resolveCollectionAddressFromTx(txHash: string) {
  const factoryAddress = process.env.NEXT_PUBLIC_FACTORY_ADDRESS || '';
  if (!factoryAddress) return '';
  const provider = new RpcProvider({
    nodeUrl: process.env.NEXT_PUBLIC_STARKNET_RPC || DEFAULT_RPC,
  });
  const selector = hash.getSelectorFromName('CollectionCreated').toLowerCase();
  const factory = canonicalAddress(factoryAddress).toLowerCase();
  const maxAttempts = 12;
  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    try {
      const receipt = await provider.getTransactionReceipt(txHash);
      const events = ((receipt as any)?.events ?? []) as Array<{
        from_address?: string;
        fromAddress?: string;
        keys?: string[];
        data?: string[];
      }>;
      const event = events.find((item) => {
        const from = canonicalAddress(item.from_address ?? item.fromAddress ?? '0x0').toLowerCase();
        const key = item.keys?.[0]?.toLowerCase();
        return from === factory && key === selector && Array.isArray(item.data) && item.data.length > 0;
      });
      if (event?.data?.length) return canonicalAddress(event.data[0]);
    } catch {
      // retry until indexed
    }
    await new Promise((resolve) => setTimeout(resolve, 1500));
  }
  return '';
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as Body;
    const txHash = body.txHash?.trim() || '';
    const collectionAddressRaw = body.collectionAddress?.trim() || '';
    const collectionAddress = collectionAddressRaw || (txHash ? await resolveCollectionAddressFromTx(txHash) : '');
    if (!collectionAddress.startsWith('0x')) {
      return NextResponse.json({ error: 'collectionAddress is required.' }, { status: 400 });
    }
    const maxSupply = Number(body.maxSupply || 0);
    await upsertNftCollections([
      {
        collection_address: collectionAddress,
        idx: 0,
        name: (body.name || '').trim(),
        symbol: (body.symbol || '').trim(),
        creator: body.creator?.trim() || '0x0',
        model: body.model === 'paid' ? 'paid' : 'free',
        mint_price_strk: (body.mintPriceStrk || '0').trim(),
        minted: 0,
        max_supply: Number.isFinite(maxSupply) ? maxSupply : 0,
        progress_pct: 0,
        base_uri: (body.baseUri || '').trim(),
        image_url: body.imageUrl?.trim() || null,
        created_tx_hash: txHash || null,
      },
    ]);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to save NFT collection metadata.' },
      { status: 500 },
    );
  }
}

