import { NextRequest, NextResponse } from 'next/server';
import { canonicalAddress } from '~~/lib/starknet/address';

function toDecimalAddress(address: string) {
  if (!address) return '';
  return BigInt(canonicalAddress(address)).toString(10);
}

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const base = url.searchParams.get('base') || '';
    const quote = url.searchParams.get('quote') || '';
    const interval = url.searchParams.get('interval') || '3600';
    const chainId = url.searchParams.get('chainId') || '23448594291968334'; // SN_MAIN

    if (!base || !quote) {
      return NextResponse.json({ error: 'base and quote are required' }, { status: 400 });
    }

    const baseDec = toDecimalAddress(base);
    const quoteDec = toDecimalAddress(quote);
    const query = `history?interval=${encodeURIComponent(interval)}`;
    const forwardTarget = `https://prod-api.ekubo.org/price/${chainId}/${baseDec}/${quoteDec}/${query}`;
    const response = await fetch(forwardTarget, {
      headers: { accept: 'application/json' },
      next: { revalidate: 30 },
    });

    if (response.ok) {
      const payload = await response.json();
      return NextResponse.json({
        reversed: false,
        ...payload,
      });
    }

    const errorText = await response.text();
    if (response.status === 400) {
      const reverseTarget = `https://prod-api.ekubo.org/price/${chainId}/${quoteDec}/${baseDec}/${query}`;
      const reverseResponse = await fetch(reverseTarget, {
        headers: { accept: 'application/json' },
        next: { revalidate: 30 },
      });
      if (reverseResponse.ok) {
        const reversePayload = await reverseResponse.json();
        return NextResponse.json({
          reversed: true,
          ...reversePayload,
        });
      }
    }
    return NextResponse.json({
      reversed: false,
      data: [],
      unavailable: true,
      reason: `Ekubo API error: ${errorText}`,
    });
  } catch (error) {
    return NextResponse.json({
      reversed: false,
      data: [],
      unavailable: true,
      reason: error instanceof Error ? error.message : 'Unexpected error',
    });
  }
}
