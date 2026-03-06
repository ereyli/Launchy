import { NextRequest, NextResponse } from 'next/server';
import { RpcProvider } from 'starknet';
import { env } from '~~/lib/config';
import { canonicalAddress } from '~~/lib/starknet/address';

function splitU256(value: bigint) {
  const mask = (1n << 128n) - 1n;
  return {
    low: (value & mask).toString(),
    high: (value >> 128n).toString(),
  };
}

function fromU256Words(words: string[], start = 0) {
  const low = BigInt(words[start] || '0x0');
  const high = BigInt(words[start + 1] || '0x0');
  return (high << 128n) + low;
}

function toDecimal(value: bigint, decimals = 18) {
  const whole = value / 10n ** BigInt(decimals);
  const frac = (value % 10n ** BigInt(decimals)).toString().padStart(decimals, '0').replace(/0+$/, '');
  return frac ? `${whole}.${frac}` : whole.toString();
}

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const token0 = url.searchParams.get('token0') || '';
    const token1 = url.searchParams.get('token1') || '';
    const fee = url.searchParams.get('fee') || '';
    const tickSpacing = url.searchParams.get('tickSpacing') || '';
    const extension = url.searchParams.get('extension') || '0x0';
    const tokenIn = url.searchParams.get('tokenIn') || '';
    const amountInRaw = url.searchParams.get('amountIn') || '1000000000000000000'; // 1 token
    const slippageBps = url.searchParams.get('slippageBps') || '100';

    if (!token0 || !token1 || !fee || !tickSpacing || !tokenIn) {
      return NextResponse.json(
        { error: 'token0, token1, fee, tickSpacing and tokenIn are required' },
        { status: 400 },
      );
    }

    const feeRouter = env.NEXT_PUBLIC_EKUBO_SWAP_FEE_ROUTER_ADDRESS;
    if (!feeRouter) {
      return NextResponse.json({ error: 'Fee router is not configured' }, { status: 500 });
    }

    const provider = new RpcProvider({
      nodeUrl: env.NEXT_PUBLIC_STARKNET_RPC || 'https://starknet-mainnet-rpc.publicnode.com',
    });
    const amountIn = BigInt(amountInRaw);
    const parts = splitU256(amountIn);

    const res = await provider.callContract({
      contractAddress: canonicalAddress(feeRouter),
      entrypoint: 'quote_exact_input',
      calldata: [
        canonicalAddress(token0),
        canonicalAddress(token1),
        fee,
        tickSpacing,
        canonicalAddress(extension),
        canonicalAddress(tokenIn),
        parts.low,
        parts.high,
        `0x${BigInt(slippageBps).toString(16)}`,
      ],
    });

    if (!Array.isArray(res) || res.length < 8) {
      return NextResponse.json({ error: 'Invalid quote response' }, { status: 502 });
    }

    const amountOut = fromU256Words(res, 0);
    const minReceived = fromU256Words(res, 2);
    const platformFee = fromU256Words(res, 4);
    const netInput = fromU256Words(res, 6);
    const tokenPerQuote = amountIn > 0n ? Number(toDecimal((amountOut * 10n ** 18n) / amountIn)) : 0;
    const quotePerToken = tokenPerQuote > 0 ? 1 / tokenPerQuote : 0;

    return NextResponse.json({
      amountIn: amountIn.toString(),
      amountOut: amountOut.toString(),
      minReceived: minReceived.toString(),
      platformFee: platformFee.toString(),
      netInput: netInput.toString(),
      priceOutPerIn: tokenPerQuote,
      tokenPerQuote,
      quotePerToken,
      source: 'ekubo_router_quote',
      timestamp: Date.now(),
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unexpected quote error' },
      { status: 500 },
    );
  }
}
