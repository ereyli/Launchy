'use client';

import { RpcProvider } from 'starknet';
import { env } from '~~/lib/config';
import { CLIENT_RPC_PROXY_PATH } from '~~/lib/starknet/rpc';
import { requireWalletSession } from '~~/lib/starknet/wallet-session';

type TradeSide = 'buy' | 'sell';

export type PoolKeyInput = {
  token0: string;
  token1: string;
  fee: string;
  tickSpacing: string;
  extension?: string;
};

export type EkuboQuoteInput = {
  side: TradeSide;
  tokenAddress: string;
  quoteTokenAddress: string;
  amount: string;
  slippage: number;
  poolKey?: PoolKeyInput;
};

export type EkuboQuoteResult = {
  inputTokenAddress: string;
  outputTokenAddress: string;
  inputAmount: string;
  outputAmount: string;
  minReceived: string;
  platformFee: string;
  netInput: string;
};

export type SubmittedTrade = {
  txHash: string;
  outputAmountFormatted: string;
  inputAmountFormatted: string;
  mode: 'ekubo_fee_router';
  confirmed: Promise<void>;
};

let rpcProvider: RpcProvider | null = null;

function getRpcProvider() {
  if (!rpcProvider) {
    rpcProvider = new RpcProvider({
      nodeUrl: CLIENT_RPC_PROXY_PATH,
    });
  }
  return rpcProvider;
}

function normalizeTradeError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  const lower = message.toLowerCase();
  if (lower.includes('user abort') || lower.includes('rejected')) {
    return 'Transaction rejected in wallet.';
  }
  return message;
}

function decimalAmountToWei(input: string) {
  const value = input.trim();
  if (!/^\d+(\.\d+)?$/.test(value)) {
    throw new Error('Amount must be a valid number.');
  }
  const [whole, fraction = ''] = value.split('.');
  const fractionalPadded = `${fraction}000000000000000000`.slice(0, 18);
  return (BigInt(whole) * 10n ** 18n + BigInt(fractionalPadded)).toString();
}

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

function weiToDecimalString(value: string) {
  const big = BigInt(value);
  const whole = big / 10n ** 18n;
  const frac = (big % 10n ** 18n).toString().padStart(18, '0').replace(/0+$/, '');
  return frac ? `${whole}.${frac}` : whole.toString();
}

function getFeeRouterAddress() {
  return env.NEXT_PUBLIC_EKUBO_SWAP_FEE_ROUTER_ADDRESS || '';
}

function slippageToBps(slippagePct: number) {
  const normalized = Math.max(0.1, Math.min(50, slippagePct || 1));
  return Math.round(normalized * 100);
}

export async function quoteEkuboTrade(input: EkuboQuoteInput): Promise<EkuboQuoteResult | null> {
  const feeRouterAddress = getFeeRouterAddress();
  if (!feeRouterAddress || !input.poolKey) return null;

  const amountWei = BigInt(decimalAmountToWei(input.amount));
  if (amountWei <= 0n) return null;
  const amountParts = splitU256(amountWei);
  const slippageBps = slippageToBps(input.slippage);
  const tokenInAddress = input.side === 'buy' ? input.quoteTokenAddress : input.tokenAddress;
  const tokenOutAddress = input.side === 'buy' ? input.tokenAddress : input.quoteTokenAddress;
  const extension = input.poolKey.extension || '0x0';

  const res = await getRpcProvider().callContract(
    {
      contractAddress: feeRouterAddress,
      entrypoint: 'quote_exact_input',
      calldata: [
        input.poolKey.token0,
        input.poolKey.token1,
        input.poolKey.fee,
        input.poolKey.tickSpacing,
        extension,
        tokenInAddress,
        amountParts.low,
        amountParts.high,
        `0x${slippageBps.toString(16)}`,
      ],
    },
    'latest',
  );

  if (!Array.isArray(res) || res.length < 8) {
    throw new Error('Invalid quote response.');
  }

  const outputAmount = fromU256Words(res, 0).toString();
  const minReceived = fromU256Words(res, 2).toString();
  const platformFee = fromU256Words(res, 4).toString();
  const netInput = fromU256Words(res, 6).toString();

  return {
    inputTokenAddress: tokenInAddress,
    outputTokenAddress: tokenOutAddress,
    inputAmount: amountWei.toString(),
    outputAmount,
    minReceived,
    platformFee,
    netInput,
  };
}

export async function readTokenBalance(tokenAddress: string, owner: string) {
  const provider = getRpcProvider();
  try {
    const words = await provider.callContract(
      {
        contractAddress: tokenAddress,
        entrypoint: 'balance_of',
        calldata: [owner],
      },
      'latest',
    );
    const wei = fromU256Words(words, 0);
    return weiToDecimalString(wei.toString());
  } catch {
    try {
      const words = await provider.callContract(
        {
          contractAddress: tokenAddress,
          entrypoint: 'balanceOf',
          calldata: [owner],
        },
        'latest',
      );
      const wei = fromU256Words(words, 0);
      return weiToDecimalString(wei.toString());
    } catch {
      return '0';
    }
  }
}

export async function readTokenAllowance(tokenAddress: string, owner: string, spender: string) {
  const provider = getRpcProvider();
  try {
    const words = await provider.callContract(
      {
        contractAddress: tokenAddress,
        entrypoint: 'allowance',
        calldata: [owner, spender],
      },
      'latest',
    );
    return fromU256Words(words, 0);
  } catch {
    try {
      const words = await provider.callContract(
        {
          contractAddress: tokenAddress,
          entrypoint: 'allowance_of',
          calldata: [owner, spender],
        },
        'latest',
      );
      return fromU256Words(words, 0);
    } catch {
      return 0n;
    }
  }
}

export async function executeEkuboTrade(input: EkuboQuoteInput): Promise<SubmittedTrade> {
  try {
    const session = requireWalletSession();
    if (!session.address) {
      throw new Error('Please connect wallet.');
    }

    const feeRouterAddress = getFeeRouterAddress();
    if (!feeRouterAddress) {
      throw new Error('NEXT_PUBLIC_EKUBO_SWAP_FEE_ROUTER_ADDRESS is not configured.');
    }
    if (!input.poolKey) {
      throw new Error('Pool key is missing for this token.');
    }

    const tokenInAddress = input.side === 'buy' ? input.quoteTokenAddress : input.tokenAddress;
    const amountWei = BigInt(decimalAmountToWei(input.amount));
    const quoted = await quoteEkuboTrade(input);
    if (quoted && BigInt(quoted.outputAmount) <= 0n) {
      throw new Error('No executable liquidity for this direction/amount yet.');
    }
    const minReceivedWei = quoted ? BigInt(quoted.minReceived) : 0n;
    const amountParts = splitU256(amountWei);
    const minParts = splitU256(minReceivedWei);
    const extension = input.poolKey.extension || '0x0';

    const allowanceWei = await readTokenAllowance(tokenInAddress, session.address, feeRouterAddress);
    const needsApprove = allowanceWei < amountWei;
    // Ready and other injected wallets flag oversized recurring approvals as high-risk.
    // Use exact-amount approvals so the wallet review matches the actual trade amount.
    const approveWei = needsApprove ? amountWei : 0n;
    const approveParts = splitU256(approveWei);
    const calls = [
      ...(needsApprove
        ? [{
            contractAddress: tokenInAddress,
            entrypoint: 'approve',
            calldata: [feeRouterAddress, approveParts.low, approveParts.high],
          }]
        : []),
      {
        contractAddress: feeRouterAddress,
        entrypoint: 'swap_exact_input',
        calldata: [
          input.poolKey.token0,
          input.poolKey.token1,
          input.poolKey.fee,
          input.poolKey.tickSpacing,
          extension,
          tokenInAddress,
          amountParts.low,
          amountParts.high,
          minParts.low,
          minParts.high,
          session.address,
        ],
      },
    ];

    const tx = await session.execute(calls, { sponsored: true });

    return {
      txHash: tx.hash,
      outputAmountFormatted: quoted ? weiToDecimalString(quoted.outputAmount) : 'Submitted',
      inputAmountFormatted: weiToDecimalString(amountWei.toString()),
      mode: 'ekubo_fee_router' as const,
      confirmed: tx.wait(),
    };
  } catch (error) {
    throw new Error(normalizeTradeError(error));
  }
}
