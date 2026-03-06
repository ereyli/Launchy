import { NextResponse } from 'next/server';
import { RpcProvider, hash } from 'starknet';
import { ipfsGatewayUrl } from '~~/lib/pinata/server';
import { assertCidLike, assertRateLimit, assertSameOrigin, RouteGuardError } from '~~/lib/server/mutation-guard';
import { canonicalAddress } from '~~/lib/starknet/address';
import { saveTokenProfile } from '~~/lib/token-launchpad/profile-store';
import { getTokenLaunchRow, getTokenProfileRow } from '~~/lib/storage/market-store';

type Body = {
  tokenAddress?: string;
  txHash?: string;
  imageCid?: string;
  name?: string;
  symbol?: string;
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
      if (event?.data?.length) {
        return canonicalAddress(event.data[event.data.length - 1] ?? '');
      }
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
    assertRateLimit(request, { key: 'token-profile-write', limit: 20, windowMs: 10 * 60 * 1000 });

    const body = (await request.json()) as Body;
    const txHash = body.txHash?.trim() || '';
    const tokenAddressRaw = body.tokenAddress?.trim() || '';
    if (!txHash) {
      return NextResponse.json({ error: 'txHash is required.' }, { status: 400 });
    }

    const resolvedTokenAddress = await resolveTokenAddressFromTx(txHash);
    const tokenAddress = tokenAddressRaw || resolvedTokenAddress;
    const imageCid = body.imageCid?.trim() || '';
    const name = body.name?.trim() || '';
    const symbol = body.symbol?.trim() || '';

    if (!tokenAddress.startsWith('0x')) {
      return NextResponse.json({ error: 'tokenAddress is required.' }, { status: 400 });
    }
    if (!imageCid) {
      return NextResponse.json({ error: 'imageCid is required.' }, { status: 400 });
    }
    assertCidLike(imageCid);
    if (resolvedTokenAddress && canonicalAddress(tokenAddress) !== canonicalAddress(resolvedTokenAddress)) {
      return NextResponse.json({ error: 'tokenAddress does not match txHash.' }, { status: 400 });
    }

    const existing = await getTokenProfileRow(tokenAddress);
    if (existing) {
      const unchanged =
        existing.image_cid === imageCid &&
        existing.name === name &&
        existing.symbol === symbol;
      if (!unchanged) {
        return NextResponse.json({ error: 'Token profile is already locked.' }, { status: 409 });
      }
      return NextResponse.json({
        ok: true,
        profile: {
          tokenAddress: existing.token_address,
          imageCid: existing.image_cid,
          imageUrl: existing.image_url,
          name: existing.name,
          symbol: existing.symbol,
          createdAt: existing.created_at,
        },
      });
    }

    const launchRow = await getTokenLaunchRow(tokenAddress);
    if (launchRow) {
      if (name && launchRow.name && name !== launchRow.name) {
        return NextResponse.json({ error: 'Name does not match launch record.' }, { status: 400 });
      }
      if (symbol && launchRow.symbol && symbol !== launchRow.symbol) {
        return NextResponse.json({ error: 'Symbol does not match launch record.' }, { status: 400 });
      }
    }

    const imageUrl = ipfsGatewayUrl(imageCid);
    const profile = await saveTokenProfile({
      tokenAddress,
      imageCid,
      imageUrl,
      name,
      symbol,
    });

    return NextResponse.json({ ok: true, profile });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to save token profile.' },
      { status: error instanceof RouteGuardError ? error.status : 500 },
    );
  }
}
