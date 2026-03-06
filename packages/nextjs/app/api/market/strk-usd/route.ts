import { NextResponse } from 'next/server';

const COINGECKO_URL = 'https://api.coingecko.com/api/v3/simple/price?ids=starknet&vs_currencies=usd';

export async function GET() {
  try {
    const response = await fetch(COINGECKO_URL, {
      headers: { accept: 'application/json' },
      next: { revalidate: 60 },
    });
    if (!response.ok) {
      throw new Error(`Price provider failed with ${response.status}`);
    }
    const data = (await response.json()) as { starknet?: { usd?: number } };
    const priceUsd = data.starknet?.usd;
    if (typeof priceUsd !== 'number' || !Number.isFinite(priceUsd) || priceUsd <= 0) {
      throw new Error('Invalid price payload from provider');
    }
    return NextResponse.json({ priceUsd });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Unexpected error',
      },
      { status: 502 },
    );
  }
}
