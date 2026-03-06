import { NextResponse } from 'next/server';
import { RpcProvider, hash } from 'starknet';
import { assertRateLimit, assertSameOrigin, RouteGuardError } from '~~/lib/server/mutation-guard';
import { canonicalAddress } from '~~/lib/starknet/address';
import { getTokenInitialMarketCapUsd, upsertTokenInitialMarketCapUsd } from '~~/lib/storage/market-store';

type Body = {
  tokenAddress?: string;
  txHash?: string;
  startingMarketCapUsd?: string | number;
};

const DEFAULT_RPC = 'https://starknet-mainnet-rpc.publicnode.com';

async function resolveTokenAddressFromTx(txHash: string) {
  const factoryAddress = process.env.NEXT_PUBLIC_TOKEN_FACTORY_ADDRESS || '';
  if (!factoryAddress) return '';
  const provider = new RpcProvider({
    nodeUrl: process.env.NEXT_PUBLIC_STARKNET_RPC || DEFAULT_RPC,
  });
  const createdSelector = hash.getSelectorFromName('MemecoinCreated').toLowerCase();
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
        const selector = item.keys?.[0]?.toLowerCase();
        return from === factory && selector === createdSelector && Array.isArray(item.data) && item.data.length > 0;
      });
      if (event?.data?.length) return canonicalAddress(event.data[event.data.length - 1] ?? '');
    } catch {
      // retry until indexed
    }
    await new Promise((resolve) => setTimeout(resolve, 1500));
  }
  return '';
}

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    assertRateLimit(request, { key: 'token-launch-meta-write', limit: 20, windowMs: 10 * 60 * 1000 });

    const body = (await request.json()) as Body;
    const txHash = body.txHash?.trim() || '';
    const tokenAddressRaw = body.tokenAddress?.trim() || '';
    if (!txHash) {
      return NextResponse.json({ error: 'txHash is required.' }, { status: 400 });
    }
    const resolvedTokenAddress = await resolveTokenAddressFromTx(txHash);
    const tokenAddress = tokenAddressRaw || resolvedTokenAddress;
    const initial = Number(body.startingMarketCapUsd ?? 0);
    if (!tokenAddress.startsWith('0x')) {
      return NextResponse.json({ error: 'tokenAddress is required.' }, { status: 400 });
    }
    if (!Number.isFinite(initial) || initial <= 0) {
      return NextResponse.json({ error: 'startingMarketCapUsd must be > 0.' }, { status: 400 });
    }
    if (resolvedTokenAddress && canonicalAddress(tokenAddress) !== canonicalAddress(resolvedTokenAddress)) {
      return NextResponse.json({ error: 'tokenAddress does not match txHash.' }, { status: 400 });
    }

    const existing = await getTokenInitialMarketCapUsd(tokenAddress);
    if (existing) {
      if (Math.abs(existing - initial) > 0.000001) {
        return NextResponse.json({ error: 'Launch metadata is already locked.' }, { status: 409 });
      }
      return NextResponse.json({ ok: true });
    }

    await upsertTokenInitialMarketCapUsd(tokenAddress, initial);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to save launch meta.' },
      { status: error instanceof RouteGuardError ? error.status : 500 },
    );
  }
}
