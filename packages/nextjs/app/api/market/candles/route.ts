import { NextRequest, NextResponse } from 'next/server';
import { getPairCandles } from '~~/lib/market/event-candles';

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const base = url.searchParams.get('base') || '';
    const quote = url.searchParams.get('quote') || '';
    const timeframe = Number(url.searchParams.get('timeframe') || '3600');
    const supported = new Set([60, 300, 900, 3600]);

    if (!base || !quote) {
      return NextResponse.json({ error: 'base and quote are required' }, { status: 400 });
    }
    if (!supported.has(timeframe)) {
      return NextResponse.json({ error: 'timeframe must be one of 60/300/900/3600' }, { status: 400 });
    }

    const payload = await getPairCandles({
      baseToken: base,
      quoteToken: quote,
      intervals: [60, 300, 900, 3600],
    });

    return NextResponse.json({
      ...payload,
      timeframe,
      series: payload.candles[String(timeframe)] ?? [],
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unexpected candles error' },
      { status: 500 },
    );
  }
}
