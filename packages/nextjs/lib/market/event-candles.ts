import { RpcProvider, hash } from 'starknet';
import { env } from '~~/lib/config';
import { getCandles, getCursor, pairKey, saveCandles, saveSwaps, setCursor } from '~~/lib/storage/market-store';
import { canonicalAddress } from '~~/lib/starknet/address';

type SwapPoint = {
  timestamp: number;
  quotePerToken: number;
  volumeQuote: number;
};

type Candle = {
  start: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
};

type CacheItem = {
  updatedAt: number;
  points: SwapPoint[];
  cursorBlock: number;
};

const cache = new Map<string, CacheItem>();
const SWAP_EXECUTED_SELECTOR = hash.getSelectorFromName('SwapExecuted');
const DEFAULT_LOOKBACK_BLOCKS = 20000;
const MAX_BLOCKS_PER_QUERY = 1024;

function getProvider() {
  return new RpcProvider({
    nodeUrl: env.NEXT_PUBLIC_STARKNET_RPC || 'https://starknet-mainnet-rpc.publicnode.com',
  });
}

function toDecimalU128(value: string, decimals = 18) {
  const big = BigInt(value || '0');
  const whole = Number(big / 10n ** BigInt(decimals));
  const fracRaw = (big % 10n ** BigInt(decimals)).toString().padStart(decimals, '0').slice(0, 8);
  const frac = Number.parseFloat(`0.${fracRaw}`);
  return whole + (Number.isFinite(frac) ? frac : 0);
}

function safePrice(quoteAmount: string, tokenAmount: string) {
  const quote = toDecimalU128(quoteAmount);
  const token = toDecimalU128(tokenAmount);
  if (!Number.isFinite(quote) || !Number.isFinite(token) || token <= 0) return 0;
  return quote / token;
}

function aggregateCandles(points: SwapPoint[], intervalSec: number): Candle[] {
  if (!points.length) return [];
  const sorted = [...points].sort((a, b) => a.timestamp - b.timestamp);
  const buckets = new Map<number, Candle>();

  for (const p of sorted) {
    const bucket = Math.floor(p.timestamp / intervalSec) * intervalSec;
    const existing = buckets.get(bucket);
    if (!existing) {
      buckets.set(bucket, {
        start: bucket,
        open: p.quotePerToken,
        high: p.quotePerToken,
        low: p.quotePerToken,
        close: p.quotePerToken,
        volume: p.volumeQuote,
      });
      continue;
    }
    existing.high = Math.max(existing.high, p.quotePerToken);
    existing.low = Math.min(existing.low, p.quotePerToken);
    existing.close = p.quotePerToken;
    existing.volume += p.volumeQuote;
  }

  return [...buckets.values()].sort((a, b) => a.start - b.start);
}

export async function getPairCandles({
  baseToken,
  quoteToken,
  intervals,
}: {
  baseToken: string;
  quoteToken: string;
  intervals: number[];
}) {
  const router = env.NEXT_PUBLIC_EKUBO_SWAP_FEE_ROUTER_ADDRESS;
  if (!router) {
    return {
      source: 'event_indexer',
      candles: Object.fromEntries(intervals.map((i) => [String(i), []])) as Record<string, Candle[]>,
      latestPrice: 0,
    };
  }

  const provider = getProvider();
  const latestBlock = await provider.getBlockNumber();
  const base = canonicalAddress(baseToken);
  const quote = canonicalAddress(quoteToken);
  const pair = pairKey(base, quote);
  const cacheKey = `${base}_${quote}_${canonicalAddress(router)}`;
  const now = Date.now();
  const cached = cache.get(cacheKey);
  const refreshMs = 12000;

  let points: SwapPoint[] = cached?.points ?? [];
  const cursorId = `swap_router:${canonicalAddress(router).toLowerCase()}:${pair}`;
  const cursorBlock = (await getCursor(cursorId)) ?? 0;
  let fromBlock = Math.max(0, latestBlock - DEFAULT_LOOKBACK_BLOCKS, cursorBlock);
  if (cached) {
    if (now - cached.updatedAt < refreshMs) {
      const candles = Object.fromEntries(
        intervals.map((i) => [String(i), aggregateCandles(points, i)]),
      ) as Record<string, Candle[]>;
      const latestPrice = points.length ? points[points.length - 1].quotePerToken : 0;
      return { source: 'event_indexer', candles, latestPrice };
    }
    fromBlock = Math.max(fromBlock, cached.cursorBlock);
  }

  const blockTimestamps = new Map<number, number>();
  const fetchedPoints: SwapPoint[] = [...points];
  const fetchedSwaps: Array<{
    id: string;
    pair: string;
    block_number: number;
    ts: number;
    token_in: string;
    token_out: string;
    amount_in: string;
    amount_out: string;
    tx_hash: string;
    event_index: number;
    quote_per_token: number;
    volume_quote: number;
  }> = [];
  let cursor = fromBlock;

  while (cursor <= latestBlock) {
    const to = Math.min(latestBlock, cursor + MAX_BLOCKS_PER_QUERY - 1);
    const events = await provider.getEvents({
      address: canonicalAddress(router),
      from_block: { block_number: cursor },
      to_block: { block_number: to },
      keys: [[SWAP_EXECUTED_SELECTOR]],
      chunk_size: 100,
    });

    for (let eventIdx = 0; eventIdx < events.events.length; eventIdx += 1) {
      const event = events.events[eventIdx];
      const data = event.data || [];
      if (data.length < 8) continue;
      const tokenIn = canonicalAddress(data[2]);
      const tokenOut = canonicalAddress(data[3]);
      const consumed = data[6];
      const output = data[7];
      const blockNumber = event.block_number;
      if (typeof blockNumber !== 'number') continue;

      if (!blockTimestamps.has(blockNumber)) {
        try {
          const block = await provider.getBlockWithTxHashes(blockNumber);
          blockTimestamps.set(blockNumber, Number(block.timestamp || 0));
        } catch {
          blockTimestamps.set(blockNumber, 0);
        }
      }
      const timestamp = blockTimestamps.get(blockNumber) || 0;
      if (!timestamp) continue;

      let quotePerToken = 0;
      let volumeQuote = 0;
      if (tokenIn === quote && tokenOut === base) {
        quotePerToken = safePrice(consumed, output);
        volumeQuote = toDecimalU128(consumed);
      } else if (tokenIn === base && tokenOut === quote) {
        quotePerToken = safePrice(output, consumed);
        volumeQuote = toDecimalU128(output);
      } else {
        continue;
      }

      if (!Number.isFinite(quotePerToken) || quotePerToken <= 0) continue;
      fetchedPoints.push({ timestamp, quotePerToken, volumeQuote });
      const txHash = event.transaction_hash || '';
      fetchedSwaps.push({
        id: `${txHash}:${blockNumber}:${eventIdx}`,
        pair,
        block_number: blockNumber,
        ts: timestamp,
        token_in: tokenIn,
        token_out: tokenOut,
        amount_in: consumed,
        amount_out: output,
        tx_hash: txHash,
        event_index: eventIdx,
        quote_per_token: quotePerToken,
        volume_quote: volumeQuote,
      });
    }

    cursor = to + 1;
  }

  fetchedPoints.sort((a, b) => a.timestamp - b.timestamp);
  points = fetchedPoints.slice(-12000);

  const candlesByInterval = Object.fromEntries(
    intervals.map((i) => [String(i), aggregateCandles(points, i)]),
  ) as Record<string, Candle[]>;

  await saveSwaps(fetchedSwaps);
  for (const interval of intervals) {
    await saveCandles(pair, interval, candlesByInterval[String(interval)]);
  }
  await setCursor(cursorId, latestBlock);

  cache.set(cacheKey, {
    updatedAt: now,
    points,
    cursorBlock: Math.max(fromBlock, latestBlock - 16),
  });

  const candles = Object.fromEntries(
    await Promise.all(
      intervals.map(async (i) => {
        const stored = await getCandles(pair, i, 240);
        return [String(i), stored.length ? stored : candlesByInterval[String(i)]];
      }),
    ),
  ) as Record<string, Candle[]>;
  const latestPrice = points.length ? points[points.length - 1].quotePerToken : 0;

  return { source: 'event_indexer', candles, latestPrice };
}
