'use client';

import { CallData, RpcProvider, cairo, hash, shortString, type Call } from 'starknet';
import { env } from '~~/lib/config';
import { canonicalAddress, sameAddress } from '~~/lib/starknet/address';
import { requireWalletSession } from '~~/lib/starknet/wallet-session';
import type { CreateAndLaunchTokenInput, CreateTokenInput, LaunchOnEkuboInput } from '~~/lib/token-launchpad/types';

const DEFAULT_RPC = 'https://starknet-mainnet-rpc.publicnode.com';
const TOKEN_DECIMALS = 18n;
const EKUBO_TICK_BASE = 1.000001;
const DEFAULT_EKUBO_TICK_SPACING = 5982;
const DEFAULT_EKUBO_FEE = '1020847100762815390390123822295304634';
const DEFAULT_EKUBO_BOUND = 88712960;

function getReadProvider() {
  return new RpcProvider({ nodeUrl: env.NEXT_PUBLIC_STARKNET_RPC || DEFAULT_RPC });
}

function feltText(text: string, field: string) {
  if (!text || text.length > 31) {
    throw new Error(`${field} must be 1-31 ASCII characters (felt252).`);
  }
  return shortString.encodeShortString(text);
}

function parseUnits(input: string, decimals: bigint) {
  const value = input.trim();
  if (!/^\d+(\.\d+)?$/.test(value)) {
    throw new Error('Initial supply must be a valid number.');
  }

  const [whole, fraction = ''] = value.split('.');
  const scale = Number(decimals);
  const fractionalPadded = `${fraction}${'0'.repeat(scale)}`.slice(0, scale);
  return BigInt(whole) * 10n ** decimals + BigInt(fractionalPadded);
}

function parseStrkToWei(input: string) {
  return parseUnits(input, 18n);
}

function deriveStartPriceParams(input: { startingMarketCapStrk: string; initialSupplyHuman: string }) {
  const mcapStrk = Number.parseFloat(input.startingMarketCapStrk);
  const supplyHuman = Number.parseFloat(input.initialSupplyHuman);
  if (!Number.isFinite(mcapStrk) || mcapStrk <= 0) {
    throw new Error('Starting market cap must be greater than zero.');
  }
  if (!Number.isFinite(supplyHuman) || supplyHuman <= 0) {
    throw new Error('Initial supply must be greater than zero.');
  }

  // Target spot price in quote/token (STRK per token).
  const price = mcapStrk / supplyHuman;
  if (!Number.isFinite(price) || price <= 0) {
    throw new Error('Computed launch price is invalid.');
  }

  const tickFloat = Math.log(price) / Math.log(EKUBO_TICK_BASE);
  const isNegative = tickFloat < 0;
  const mag = Math.max(1, Math.round(Math.abs(tickFloat)));
  const bound = Math.max(DEFAULT_EKUBO_BOUND, mag + DEFAULT_EKUBO_TICK_SPACING);

  return {
    startPriceMag: mag.toString(),
    startPriceIsNegative: isNegative ? 1 : 0,
    bound: bound.toString(),
    priceStrkPerToken: price,
  };
}

function formatUnits(value: bigint, decimals: bigint) {
  const base = 10n ** decimals;
  const whole = value / base;
  const frac = value % base;
  if (frac === 0n) return whole.toString();
  const fracText = frac.toString().padStart(Number(decimals), '0').replace(/0+$/, '').slice(0, 6);
  return `${whole}.${fracText}`;
}

function u256FromCallResult(result: string[]) {
  return (BigInt(result[1]) << 128n) + BigInt(result[0]);
}

function findCreatedTokenInReceiptEvents(
  txHash: string,
  factoryAddress: string,
  events: Array<{
    from_address?: string;
    fromAddress?: string;
    keys?: string[];
    data?: string[];
  }>,
) {
  const factory = canonicalAddress(factoryAddress).toLowerCase();
  const createdSelector = hash.getSelectorFromName('MemecoinCreated').toLowerCase();
  const factoryEvent = events.find((event) => {
    const from = canonicalAddress(event.from_address ?? event.fromAddress ?? '0x0').toLowerCase();
    const selector = event.keys?.[0]?.toLowerCase();
    return from === factory && selector === createdSelector && Array.isArray(event.data) && event.data.length > 0;
  });
  if (!factoryEvent?.data?.length) return '';
  try {
    return canonicalAddress(factoryEvent.data[factoryEvent.data.length - 1] ?? '');
  } catch {
    throw new Error(`Failed to parse token address from MemecoinCreated event for tx ${txHash}.`);
  }
}

async function resolveCreatedTokenAddress(provider: RpcProvider, txHash: string, factoryAddress: string) {
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
      const address = findCreatedTokenInReceiptEvents(txHash, factoryAddress, events);
      if (address) return address;
    } catch {
      // continue retry
    }
    await new Promise((resolve) => setTimeout(resolve, 1500));
  }
  return '';
}

function splitU256(value: bigint) {
  const mask = (1n << 128n) - 1n;
  return {
    low: (value & mask).toString(),
    high: (value >> 128n).toString(),
  };
}

function buildDefaultPoolKey(tokenAddress: string, quoteTokenAddress: string) {
  const token = canonicalAddress(tokenAddress);
  const quote = canonicalAddress(quoteTokenAddress);
  const tokenBig = BigInt(token);
  const quoteBig = BigInt(quote);
  return {
    token0: tokenBig < quoteBig ? token : quote,
    token1: tokenBig < quoteBig ? quote : token,
    fee: DEFAULT_EKUBO_FEE,
    tickSpacing: DEFAULT_EKUBO_TICK_SPACING.toString(),
    extension: '0x0',
  };
}

async function runBootstrapBuy(params: {
  session: ReturnType<typeof requireWalletSession>;
  provider: RpcProvider;
  tokenAddress: string;
  quoteTokenAddress: string;
  amountInWei: bigint;
}) {
  if (params.amountInWei <= 0n) {
    return '';
  }
  const feeRouter = env.NEXT_PUBLIC_EKUBO_SWAP_FEE_ROUTER_ADDRESS || '';
  if (!feeRouter) {
    throw new Error('NEXT_PUBLIC_EKUBO_SWAP_FEE_ROUTER_ADDRESS is missing.');
  }

  const amount = splitU256(params.amountInWei);
  const poolKey = buildDefaultPoolKey(params.tokenAddress, params.quoteTokenAddress);
  let minOut = { low: '0', high: '0' };

  try {
    const quoteRes = await params.provider.callContract({
      contractAddress: feeRouter,
      entrypoint: 'quote_exact_input',
      calldata: [
        poolKey.token0,
        poolKey.token1,
        poolKey.fee,
        poolKey.tickSpacing,
        poolKey.extension,
        canonicalAddress(params.quoteTokenAddress),
        amount.low,
        amount.high,
        '0x64', // 1.00% slippage
      ],
    });
    if (Array.isArray(quoteRes) && quoteRes.length >= 4) {
      const quotedOut = u256FromCallResult(quoteRes);
      if (quotedOut <= 0n) {
        throw new Error('No executable liquidity for initial owner buy.');
      }
      minOut = {
        low: quoteRes[2] ?? '0x0',
        high: quoteRes[3] ?? '0x0',
      };
    }
  } catch {
    // Fallback to on-chain execution without quote guard if node quote fails transiently.
    minOut = { low: '0', high: '0' };
  }

  const tx = await params.session.execute(
    [
      {
        contractAddress: canonicalAddress(params.quoteTokenAddress),
        entrypoint: 'approve',
        calldata: CallData.compile([feeRouter, amount.low, amount.high]),
      },
      {
        contractAddress: feeRouter,
        entrypoint: 'swap_exact_input',
        calldata: CallData.compile([
          poolKey.token0,
          poolKey.token1,
          poolKey.fee,
          poolKey.tickSpacing,
          poolKey.extension,
          canonicalAddress(params.quoteTokenAddress),
          amount.low,
          amount.high,
          minOut.low,
          minOut.high,
          params.session.address,
        ]),
      },
    ],
    { sponsored: true },
  );
  await tx.wait();
  return tx.hash;
}

async function getFactoryFeeConfig(provider: RpcProvider) {
  if (!env.NEXT_PUBLIC_TOKEN_FACTORY_ADDRESS) {
    throw new Error('NEXT_PUBLIC_TOKEN_FACTORY_ADDRESS is missing.');
  }
  const [feeTokenRaw, deployFeeRaw, memecoinClassHashRaw] = await Promise.all([
    provider.callContract({
      contractAddress: env.NEXT_PUBLIC_TOKEN_FACTORY_ADDRESS,
      entrypoint: 'platform_fee_token',
      calldata: [],
    }),
    provider.callContract({
      contractAddress: env.NEXT_PUBLIC_TOKEN_FACTORY_ADDRESS,
      entrypoint: 'platform_deploy_fee',
      calldata: [],
    }),
    provider.callContract({
      contractAddress: env.NEXT_PUBLIC_TOKEN_FACTORY_ADDRESS,
      entrypoint: 'memecoin_class_hash',
      calldata: [],
    }),
  ]);
  return {
    feeToken: canonicalAddress(feeTokenRaw[0]),
    deployFeeWei: u256FromCallResult(deployFeeRaw),
    memecoinClassHash: memecoinClassHashRaw[0],
  };
}

export async function createMemecoin(input: CreateTokenInput) {
  if (!env.NEXT_PUBLIC_TOKEN_FACTORY_ADDRESS) {
    throw new Error('NEXT_PUBLIC_TOKEN_FACTORY_ADDRESS is missing.');
  }

  const session = requireWalletSession();
  const provider = getReadProvider();
  const { feeToken, deployFeeWei } = await getFactoryFeeConfig(provider);

  const name = feltText(input.name, 'Name');
  const symbol = feltText(input.symbol, 'Symbol');
  const initialSupply = parseUnits(input.initialSupply, TOKEN_DECIMALS);
  if (initialSupply <= 0n) {
    throw new Error('Initial supply must be greater than zero.');
  }

  const salt = `0x${(BigInt(Date.now()) + BigInt(Math.floor(Math.random() * 1_000_000))).toString(16)}`;
  const supplyU256 = cairo.uint256(initialSupply);

  const createCall: Call = {
    contractAddress: env.NEXT_PUBLIC_TOKEN_FACTORY_ADDRESS,
    entrypoint: 'create_memecoin',
    calldata: CallData.compile([
      session.address,
      name,
      symbol,
      supplyU256.low,
      supplyU256.high,
      salt,
    ]),
  };
  const calls: Call[] = [];
  if (deployFeeWei > 0n) {
    const feeU256 = cairo.uint256(deployFeeWei);
    calls.push({
      contractAddress: feeToken,
      entrypoint: 'approve',
      calldata: CallData.compile([
        env.NEXT_PUBLIC_TOKEN_FACTORY_ADDRESS,
        feeU256.low,
        feeU256.high,
      ]),
    });
  }
  calls.push(createCall);
  const tx = await session.execute(calls, { sponsored: true });
  await tx.wait();

  const tokenAddress = await resolveCreatedTokenAddress(provider, tx.hash, env.NEXT_PUBLIC_TOKEN_FACTORY_ADDRESS);

  return {
    txHash: tx.hash,
    tokenAddress,
    input,
  };
}

export async function createAndLaunchMemecoin(input: CreateAndLaunchTokenInput) {
  if (!env.NEXT_PUBLIC_TOKEN_FACTORY_ADDRESS) {
    throw new Error('NEXT_PUBLIC_TOKEN_FACTORY_ADDRESS is missing.');
  }
  const session = requireWalletSession();
  const provider = getReadProvider();
  const { feeToken, deployFeeWei, memecoinClassHash } = await getFactoryFeeConfig(provider);

  const name = feltText(input.name, 'Name');
  const symbol = feltText(input.symbol, 'Symbol');
  const initialSupply = parseUnits(input.initialSupply, TOKEN_DECIMALS);
  if (initialSupply <= 0n) {
    throw new Error('Initial supply must be greater than zero.');
  }
  if (!Number.isFinite(input.deployerAllocationPercent) || input.deployerAllocationPercent < 0 || input.deployerAllocationPercent > 10) {
    throw new Error('Deployer allocation must be between 0% and 10%.');
  }

  const startingMcapWei = parseStrkToWei(input.startingMarketCapStrk);
  if (startingMcapWei <= 0n) {
    throw new Error('Starting market cap must be greater than zero.');
  }

  const deployerBpsInt = Math.round(input.deployerAllocationPercent * 100);
  if (deployerBpsInt < 0 || deployerBpsInt > 1000) {
    throw new Error('Deployer allocation must be between 0% and 10%.');
  }
  const deployerBps = BigInt(deployerBpsInt);
  const lpAmountWei = initialSupply;
  if (lpAmountWei <= 0n) {
    throw new Error('LP amount is zero. Increase supply.');
  }
  const ownerBuyQuoteWei = (startingMcapWei * deployerBps) / 10000n;
  const priceParams = deriveStartPriceParams({
    startingMarketCapStrk: input.startingMarketCapStrk,
    initialSupplyHuman: input.initialSupply,
  });

  const salt = `0x${(BigInt(Date.now()) + BigInt(Math.floor(Math.random() * 1_000_000))).toString(16)}`;
  const initialSupplyU256 = cairo.uint256(initialSupply);
  const lpAmountU256 = cairo.uint256(lpAmountWei);
  const quoteAmountU256 = cairo.uint256(0);
  const antiBotSeconds = 0;

  const quoteTokenAddress = canonicalAddress(input.quoteToken);
  const feeRouterAddress = env.NEXT_PUBLIC_EKUBO_SWAP_FEE_ROUTER_ADDRESS || '';
  if (!feeRouterAddress) {
    throw new Error('NEXT_PUBLIC_EKUBO_SWAP_FEE_ROUTER_ADDRESS is missing.');
  }

  const predictedConstructorCalldata = [
    session.address,
    env.NEXT_PUBLIC_TOKEN_FACTORY_ADDRESS,
    name,
    symbol,
    initialSupplyU256.low,
    initialSupplyU256.high,
  ];
  const predictedTokenAddress = canonicalAddress(
    hash.calculateContractAddressFromHash(
      salt,
      memecoinClassHash,
      predictedConstructorCalldata,
      env.NEXT_PUBLIC_TOKEN_FACTORY_ADDRESS,
    ),
  );
  const poolKey = buildDefaultPoolKey(predictedTokenAddress, quoteTokenAddress);
  const ownerBuyAmountU256 = cairo.uint256(ownerBuyQuoteWei);

  const createAndLaunchCall: Call = {
    contractAddress: env.NEXT_PUBLIC_TOKEN_FACTORY_ADDRESS,
    entrypoint: 'create_and_launch_on_ekubo',
    calldata: CallData.compile([
      name,
      symbol,
      initialSupplyU256.low,
      initialSupplyU256.high,
      lpAmountU256.low,
      lpAmountU256.high,
      quoteAmountU256.low,
      quoteAmountU256.high,
      antiBotSeconds,
      quoteTokenAddress,
      priceParams.startPriceMag,
      priceParams.startPriceIsNegative,
      priceParams.bound,
      salt,
    ]),
  };
  const approvals: Call[] = [];
  const sameFeeAndQuoteToken = sameAddress(quoteTokenAddress, feeToken);
  const totalFeeTokenNeed = sameFeeAndQuoteToken
    ? deployFeeWei + ownerBuyQuoteWei
    : deployFeeWei;
  if (totalFeeTokenNeed > 0n) {
    const balanceRaw = await provider.callContract({
      contractAddress: feeToken,
      entrypoint: 'balance_of',
      calldata: [session.address],
    });
    const balance = u256FromCallResult(balanceRaw);
    if (balance < totalFeeTokenNeed) {
      throw new Error(
        `Insufficient STRK. Required ${formatUnits(totalFeeTokenNeed, 18n)} STRK, wallet has ${formatUnits(balance, 18n)} STRK.`,
      );
    }
  }
  if (totalFeeTokenNeed > 0n) {
    approvals.push({
      contractAddress: feeToken,
      entrypoint: 'approve',
      calldata: CallData.compile([
        env.NEXT_PUBLIC_TOKEN_FACTORY_ADDRESS,
        cairo.uint256(deployFeeWei).low,
        cairo.uint256(deployFeeWei).high,
      ]),
    });
  }
  if (ownerBuyQuoteWei > 0n) {
    approvals.push({
      contractAddress: quoteTokenAddress,
      entrypoint: 'approve',
      calldata: CallData.compile([
        feeRouterAddress,
        ownerBuyAmountU256.low,
        ownerBuyAmountU256.high,
      ]),
    });
  }

  const firstBuyCall: Call | null = ownerBuyQuoteWei > 0n
    ? {
        contractAddress: feeRouterAddress,
        entrypoint: 'swap_exact_input',
        calldata: CallData.compile([
          poolKey.token0,
          poolKey.token1,
          poolKey.fee,
          poolKey.tickSpacing,
          poolKey.extension,
          quoteTokenAddress,
          ownerBuyAmountU256.low,
          ownerBuyAmountU256.high,
          0,
          0,
          session.address,
        ]),
      }
    : null;

  const tx = await session.execute(
    [...approvals, createAndLaunchCall, ...(firstBuyCall ? [firstBuyCall] : [])],
    { sponsored: true },
  );
  await tx.wait();

  const tokenAddress = await resolveCreatedTokenAddress(provider, tx.hash, env.NEXT_PUBLIC_TOKEN_FACTORY_ADDRESS);

  return {
    txHash: tx.hash,
    bootstrapSwapTxHash: '',
    tokenAddress,
    estimatedStrkNeeded: (ownerBuyQuoteWei / 10n ** 18n).toString(),
    platformFeeStrk: (deployFeeWei / 10n ** 18n).toString(),
    launchPriceStrkPerToken: priceParams.priceStrkPerToken.toString(),
    input,
  };
}

export async function launchOnEkubo(input: LaunchOnEkuboInput) {
  if (!env.NEXT_PUBLIC_TOKEN_FACTORY_ADDRESS) {
    throw new Error('NEXT_PUBLIC_TOKEN_FACTORY_ADDRESS is missing.');
  }
  const session = requireWalletSession();
  const provider = getReadProvider();

  const quoteAmountWei = parseStrkToWei(input.quoteAmountStrk);
  if (quoteAmountWei < 0n) {
    throw new Error('Quote amount cannot be negative.');
  }
  if (input.maxBuyBps <= 0 || input.maxBuyBps > 10_000) {
    throw new Error('Max buy bps must be between 1 and 10000.');
  }
  if (input.maxBuyBps > 1000) {
    throw new Error('Max buy at launch cannot exceed 10%.');
  }
  if (input.lpPercent <= 0 || input.lpPercent > 100) {
    throw new Error('LP percent must be between 1 and 100.');
  }

  const balanceRaw = await provider.callContract({
    contractAddress: input.tokenAddress,
    entrypoint: 'balance_of',
    calldata: [session.address],
  });
  const tokenBalance = (BigInt(balanceRaw[1]) << 128n) + BigInt(balanceRaw[0]);
  if (tokenBalance <= 0n) {
    throw new Error('Wallet has zero token balance. Cannot open Ekubo pool.');
  }
  const lpAmountWei = (tokenBalance * BigInt(input.lpPercent)) / 100n;
  if (lpAmountWei <= 0n) {
    throw new Error('LP amount is zero. Increase LP percent or token balance.');
  }

  const quoteAmount = cairo.uint256(quoteAmountWei);
  const tokenSupplyAmount = cairo.uint256(lpAmountWei);
  const approveTokenCall: Call = {
    contractAddress: input.tokenAddress,
    entrypoint: 'approve',
    calldata: CallData.compile([
      env.NEXT_PUBLIC_TOKEN_FACTORY_ADDRESS,
      tokenSupplyAmount.low,
      tokenSupplyAmount.high,
    ]),
  };
  const approveQuoteCall: Call = {
    contractAddress: input.quoteToken,
    entrypoint: 'approve',
    calldata: CallData.compile([
      env.NEXT_PUBLIC_TOKEN_FACTORY_ADDRESS,
      quoteAmount.low,
      quoteAmount.high,
    ]),
  };
  const launchCall: Call = {
    contractAddress: env.NEXT_PUBLIC_TOKEN_FACTORY_ADDRESS,
    entrypoint: 'launch_on_ekubo',
    calldata: CallData.compile([
      input.tokenAddress,
      input.quoteToken,
      quoteAmount.low,
      quoteAmount.high,
      tokenSupplyAmount.low,
      tokenSupplyAmount.high,
      0,
      input.maxBuyBps,
      input.fee,
      input.tickSpacing,
      input.startPriceMag,
      input.startPriceIsNegative ? 1 : 0,
      input.bound,
    ]),
  };

  const calls: Call[] = [approveTokenCall];
  if (quoteAmountWei > 0n) {
    calls.push(approveQuoteCall);
  }
  calls.push(launchCall);

  const tx = await session.execute(calls, { sponsored: true });
  await tx.wait();
  return { txHash: tx.hash, tokenAddress: input.tokenAddress };
}

export async function withdrawCreatorFees(tokenAddress: string, recipient: string) {
  if (!env.NEXT_PUBLIC_TOKEN_FACTORY_ADDRESS) {
    throw new Error('NEXT_PUBLIC_TOKEN_FACTORY_ADDRESS is missing.');
  }
  const session = requireWalletSession();
  const call: Call = {
    contractAddress: env.NEXT_PUBLIC_TOKEN_FACTORY_ADDRESS,
    entrypoint: 'withdraw_creator_fees',
    calldata: CallData.compile([tokenAddress, recipient]),
  };
  const tx = await session.execute([call], { sponsored: true });
  await tx.wait();
  return { txHash: tx.hash };
}
