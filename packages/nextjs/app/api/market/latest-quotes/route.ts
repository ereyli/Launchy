import { NextResponse } from 'next/server';
import { getCandles, pairKey } from '~~/lib/storage/market-store';

type ReqItem = {
  base: string;
  quote: string;
};

export async function POST(req: Request) {
  try {
    const body = (await req.json().catch(() => ({}))) as { items?: ReqItem[] };
    const items = Array.isArray(body.items) ? body.items : [];
    if (!items.length) {
      return NextResponse.json({ quotes: {} });
    }

    const quotes: Record<string, number> = {};
    await Promise.all(
      items.map(async (item) => {
        if (!item?.base || !item?.quote) return;
        const pair = pairKey(item.base, item.quote);
        const candles = await getCandles(pair, 60, 1);
        const latest = candles[candles.length - 1];
        if (latest && Number.isFinite(latest.close) && latest.close > 0) {
          quotes[pair] = latest.close;
        }
      }),
    );

    return NextResponse.json({ quotes });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unexpected latest-quotes error' },
      { status: 500 },
    );
  }
}

