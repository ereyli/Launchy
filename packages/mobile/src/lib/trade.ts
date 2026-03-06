import { CallData, type Call } from 'starknet';
import { mobileEnv } from '~/lib/config';
import type { TokenDetail } from '~/types/market';

function parseAmountToWei(input: string) {
  const value = input.trim();
  if (!/^\d+(\.\d+)?$/.test(value)) {
    throw new Error('Amount must be a valid number.');
  }
  const [whole, fraction = ''] = value.split('.');
  const frac = `${fraction}000000000000000000`.slice(0, 18);
  return BigInt(whole) * 10n ** 18n + BigInt(frac);
}

function fromWeiString(wei: string) {
  const n = BigInt(wei || '0');
  const whole = n / 10n ** 18n;
  const frac = (n % 10n ** 18n).toString().padStart(18, '0').replace(/0+$/, '');
  return frac ? `${whole}.${frac}` : whole.toString();
}

export async function fetchSpotQuote(params: {
  token: TokenDetail;
  side: 'buy' | 'sell';
  amount: string;
  slippageBps: number;
}) {
  if (!params.token.poolKey) return null;
  const tokenIn = params.side === 'buy' ? params.token.quoteToken : params.token.address;
  const amountIn = parseAmountToWei(params.amount).toString();
  const url =
    `${mobileEnv.apiBaseUrl}/api/ekubo/spot-quote?token0=${encodeURIComponent(params.token.poolKey.token0)}` +
    `&token1=${encodeURIComponent(params.token.poolKey.token1)}` +
    `&fee=${encodeURIComponent(params.token.poolKey.fee)}` +
    `&tickSpacing=${encodeURIComponent(params.token.poolKey.tickSpacing)}` +
    `&extension=${encodeURIComponent(params.token.poolKey.extension || '0x0')}` +
    `&tokenIn=${encodeURIComponent(tokenIn)}` +
    `&amountIn=${encodeURIComponent(amountIn)}` +
    `&slippageBps=${encodeURIComponent(String(params.slippageBps))}`;

  const response = await fetch(url);
  if (!response.ok) return null;
  const json = (await response.json()) as {
    amountOut?: string;
    minReceived?: string;
    platformFee?: string;
  };
  if (!json.amountOut || !json.minReceived) return null;

  return {
    amountOutWei: json.amountOut,
    minReceivedWei: json.minReceived,
    platformFeeWei: json.platformFee || '0',
    amountOut: fromWeiString(json.amountOut),
    minReceived: fromWeiString(json.minReceived),
    platformFee: fromWeiString(json.platformFee || '0'),
  };
}

export function buildSwapCalls(params: {
  token: TokenDetail;
  side: 'buy' | 'sell';
  amount: string;
  minReceivedWei: string;
  feeRouter: string;
  recipient: string;
}): Call[] {
  if (!params.token.poolKey) {
    throw new Error('Pool data not available.');
  }

  const tokenIn = params.side === 'buy' ? params.token.quoteToken : params.token.address;
  const amount = parseAmountToWei(params.amount);
  const minReceived = BigInt(params.minReceivedWei || '0');
  const mask = (1n << 128n) - 1n;
  const amountLow = (amount & mask).toString();
  const amountHigh = (amount >> 128n).toString();
  const minLow = (minReceived & mask).toString();
  const minHigh = (minReceived >> 128n).toString();

  return [
    {
      contractAddress: tokenIn,
      entrypoint: 'approve',
      calldata: CallData.compile([params.feeRouter, amountLow, amountHigh]),
    },
    {
      contractAddress: params.feeRouter,
      entrypoint: 'swap_exact_input',
      calldata: CallData.compile([
        params.token.poolKey.token0,
        params.token.poolKey.token1,
        params.token.poolKey.fee,
        params.token.poolKey.tickSpacing,
        params.token.poolKey.extension || '0x0',
        tokenIn,
        amountLow,
        amountHigh,
        minLow,
        minHigh,
        params.recipient,
      ]),
    },
  ];
}
