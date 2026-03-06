import { NextRequest, NextResponse } from 'next/server';
import { RpcProvider } from 'starknet';
import { env } from '~~/lib/config';
import { getServerRpcUrl } from '~~/lib/starknet/rpc';
import { canonicalAddress } from '~~/lib/starknet/address';
import { pairKey } from '~~/lib/storage/market-store';
const senderCache = new Map<string, string>();

function getProvider() {
  return new RpcProvider({
    nodeUrl: getServerRpcUrl(),
  });
}

async function fetchRecentFromSupabase(pair: string, limit: number) {
  if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) return [];
  const { createClient } = await import('@supabase/supabase-js');
  const client = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });
  const { data, error } = await client
    .from('swaps')
    .select('id,event_index,tx_hash,ts,token_in,token_out,amount_in,amount_out,quote_per_token,volume_quote')
    .eq('pair', pair)
    .order('ts', { ascending: false })
    .limit(limit);
  if (error) return [];
  return data ?? [];
}

async function resolveSender(provider: RpcProvider, txHash: string) {
  if (senderCache.has(txHash)) return senderCache.get(txHash)!;
  try {
    const tx = await provider.getTransactionByHash(txHash);
    const sender =
      canonicalAddress(
        ((tx as any)?.sender_address as string) ||
          ((tx as any)?.transaction?.sender_address as string) ||
          '0x0',
      ) || '0x0';
    senderCache.set(txHash, sender);
    return sender;
  } catch {
    return '0x0';
  }
}

function toAmount(value: string, decimals = 18) {
  const big = BigInt(value || '0');
  const d = 10n ** BigInt(decimals);
  const whole = big / d;
  const frac = (big % d).toString().padStart(decimals, '0').slice(0, 6);
  return Number(`${whole}.${frac}`);
}

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const base = url.searchParams.get('base') || '';
    const quote = url.searchParams.get('quote') || '';
    const limit = Math.max(1, Math.min(30, Number(url.searchParams.get('limit') || '12')));
    if (!base || !quote) {
      return NextResponse.json({ error: 'base and quote are required' }, { status: 400 });
    }
    const pair = pairKey(base, quote);
    const rows = await fetchRecentFromSupabase(pair, limit);
    const provider = getProvider();
    const payload = await Promise.all(
      rows.map(async (row: any) => {
        const tokenIn = canonicalAddress(row.token_in).toLowerCase();
        const isBuy = tokenIn === canonicalAddress(quote).toLowerCase();
        const sender = await resolveSender(provider, row.tx_hash);
        return {
          id: row.id || `${row.tx_hash}-${row.event_index ?? 0}-${row.ts}`,
          eventIndex: Number(row.event_index ?? 0),
          account: sender,
          side: isBuy ? 'buy' : 'sell',
          quoteAmount: isBuy ? toAmount(row.amount_in) : toAmount(row.amount_out),
          tokenAmount: isBuy ? toAmount(row.amount_out) : toAmount(row.amount_in),
          quotePerToken: Number(row.quote_per_token || 0),
          ts: Number(row.ts),
          txHash: row.tx_hash,
        };
      }),
    );
    return NextResponse.json({ trades: payload });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unexpected trades error' },
      { status: 500 },
    );
  }
}
