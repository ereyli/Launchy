'use client';

import { CallData, RpcProvider, byteArray, cairo, type Call } from 'starknet';
import { env } from '~~/lib/config';
import { canonicalAddress } from '~~/lib/starknet/address';
import { requireWalletSession } from '~~/lib/starknet/wallet-session';

export type CreateCollectionInput = {
  name: string;
  symbol: string;
  maxSupply: number;
  maxPerWallet: number;
  mintPrice: string;
  isFreeMintModel: boolean;
  baseUri: string;
  metadataUri: string;
  contractMetadataUri: string;
};

function parseStrkToWei(input: string) {
  const value = input.trim();
  if (!/^\d+(\.\d+)?$/.test(value)) {
    throw new Error('Amount must be a valid STRK number.');
  }

  const [whole, fraction = ''] = value.split('.');
  const fractionalPadded = `${fraction}000000000000000000`.slice(0, 18);
  return BigInt(whole) * 10n ** 18n + BigInt(fractionalPadded);
}

function u256ToBigInt(lowHex: string, highHex: string) {
  const low = BigInt(lowHex);
  const high = BigInt(highHex);
  return (high << 128n) + low;
}

function encodeU256(value: bigint) {
  return cairo.uint256(value);
}

function formatUnits(value: bigint, decimals: bigint) {
  if (decimals === 0n) return value.toString();
  const base = 10n ** decimals;
  const whole = value / base;
  const fraction = value % base;
  if (fraction === 0n) return whole.toString();
  return `${whole}.${fraction.toString().padStart(Number(decimals), '0').replace(/0+$/, '')}`;
}

const DEFAULT_RPC = 'https://starknet-mainnet-rpc.publicnode.com';

function getReadProvider() {
  return new RpcProvider({ nodeUrl: env.NEXT_PUBLIC_STARKNET_RPC || DEFAULT_RPC });
}

async function readContract(
  provider: RpcProvider,
  contractAddress: string,
  entrypoint: string,
  calldata: string[] = [],
) {
  return provider.callContract({
    contractAddress,
    entrypoint,
    calldata,
  });
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function resolveCollectionFromFactoryFallback(
  provider: RpcProvider,
  factoryAddress: string,
  creatorAddress: string,
) {
  const countRaw = await readContract(provider, factoryAddress, 'collection_count');
  const count = Number(BigInt(countRaw[0]));
  if (!Number.isFinite(count) || count <= 0) return '';

  const maxScan = Math.min(5, count);
  for (let offset = 0; offset < maxScan; offset += 1) {
    const idx = count - 1 - offset;
    const atRaw = await readContract(provider, factoryAddress, 'collection_at', CallData.compile([idx]));
    const candidate = canonicalAddress(atRaw[0]);
    if (!candidate) continue;
    try {
      const ownerRaw = await readContract(provider, factoryAddress, 'collection_owner', CallData.compile([candidate]));
      const owner = canonicalAddress(ownerRaw[0]);
      if (owner.toLowerCase() === creatorAddress.toLowerCase()) {
        return candidate;
      }
    } catch {
      // Continue scanning candidates.
    }
  }

  return '';
}

export async function createCollection(input: CreateCollectionInput) {
  if (!env.NEXT_PUBLIC_FACTORY_ADDRESS) {
    throw new Error('NEXT_PUBLIC_FACTORY_ADDRESS is missing.');
  }

  const session = requireWalletSession();
  const provider = getReadProvider();

  const name = byteArray.byteArrayFromString(input.name.trim());
  const symbol = byteArray.byteArrayFromString(input.symbol.trim());
  const baseUri = byteArray.byteArrayFromString(input.baseUri.trim());
  const metadataUri = input.metadataUri.trim();
  if (!metadataUri) {
    throw new Error('Metadata URI is required.');
  }
  const metadataByteArray = byteArray.byteArrayFromString(metadataUri);
  const contractMetadataUri = input.contractMetadataUri.trim();
  if (!contractMetadataUri) {
    throw new Error('Contract metadata URI is required.');
  }
  const contractMetadataByteArray = byteArray.byteArrayFromString(contractMetadataUri);

  const mintPriceWei = input.isFreeMintModel ? 0n : parseStrkToWei(input.mintPrice || '0');
  if (!input.isFreeMintModel && mintPriceWei === 0n) {
    throw new Error('Paid collections must use mint price greater than zero.');
  }
  if (!Number.isFinite(input.maxPerWallet) || input.maxPerWallet < 0) {
    throw new Error('Max per wallet must be 0 (unlimited) or a positive number.');
  }
  const mintPrice = encodeU256(mintPriceWei);

  const salt = `0x${(BigInt(Date.now()) + BigInt(Math.floor(Math.random() * 1_000_000))).toString(16)}`;

  const [deployFeeRaw, strkTokenRaw] = await Promise.all([
    readContract(provider, env.NEXT_PUBLIC_FACTORY_ADDRESS, 'deploy_fee'),
    readContract(provider, env.NEXT_PUBLIC_FACTORY_ADDRESS, 'strk_token'),
  ]);

  const deployFee = u256ToBigInt(deployFeeRaw[0], deployFeeRaw[1]);
  const strkTokenAddress = canonicalAddress(strkTokenRaw[0]);

  const balanceRaw = await readContract(
    provider,
    strkTokenAddress,
    'balance_of',
    CallData.compile([session.address]),
  );
  const balance = u256ToBigInt(balanceRaw[0], balanceRaw[1]);
  if (balance < deployFee) {
    throw new Error(`Insufficient STRK balance. Need at least ${deployFee / 10n ** 18n} STRK for deploy fee.`);
  }

  const approveAmount = encodeU256(deployFee);
  const approveCall: Call = {
    contractAddress: strkTokenAddress,
    entrypoint: 'approve',
    calldata: CallData.compile([env.NEXT_PUBLIC_FACTORY_ADDRESS, approveAmount.low, approveAmount.high]),
  };

  const createCall: Call = {
    contractAddress: env.NEXT_PUBLIC_FACTORY_ADDRESS,
    entrypoint: 'create_collection',
    calldata: CallData.compile([
      name,
      symbol,
      baseUri,
      metadataByteArray,
      contractMetadataByteArray,
      input.maxSupply,
      input.maxPerWallet,
      mintPrice.low,
      mintPrice.high,
      input.isFreeMintModel ? 1 : 0,
      salt,
    ]),
  };

  const tx = await session.execute([approveCall, createCall], { sponsored: true });
  await tx.wait();

  let collectionAddress = '';
  try {
    const receipt = await provider.getTransactionReceipt(tx.hash);
    const events = ((receipt as any)?.events ?? []) as Array<{
      from_address?: string;
      fromAddress?: string;
      keys?: string[];
      data?: string[];
    }>;
    const factory = canonicalAddress(env.NEXT_PUBLIC_FACTORY_ADDRESS).toLowerCase();
    const factoryEvent = events.find((event) => {
      const from = canonicalAddress(event.from_address ?? event.fromAddress ?? '').toLowerCase();
      const firstData = event.data?.[0] ?? '';
      return from === factory && firstData.startsWith('0x');
    });
    collectionAddress = canonicalAddress(factoryEvent?.data?.[0] ?? '');
  } catch {
    // Receipt parsing can fail on some wallet/provider combinations.
  }

  if (!collectionAddress) {
    for (let i = 0; i < 8; i += 1) {
      collectionAddress = await resolveCollectionFromFactoryFallback(
        provider,
        env.NEXT_PUBLIC_FACTORY_ADDRESS,
        session.address,
      );
      if (collectionAddress) break;
      await sleep(1500);
    }
  }

  return {
    txHash: tx.hash,
    collectionAddress,
    input,
  };
}

export async function mintCollection(collectionAddress: string, quantity: number) {
  if (!env.NEXT_PUBLIC_STRK_ADDRESS) {
    throw new Error('NEXT_PUBLIC_STRK_ADDRESS is missing.');
  }
  if (!collectionAddress) throw new Error('Collection address is required.');
  if (quantity <= 0) throw new Error('Quantity must be greater than zero.');
  const normalizedCollectionAddress = canonicalAddress(collectionAddress);

  const session = requireWalletSession();
  const provider = getReadProvider();

  const [isFreeRaw] = await readContract(provider, normalizedCollectionAddress, 'is_free_mint_model');

  const mintPriceRaw = await readContract(provider, normalizedCollectionAddress, 'mint_price');

  const platformFeeRaw = await readContract(provider, normalizedCollectionAddress, 'platform_fee_per_mint');

  const isFree = BigInt(isFreeRaw) === 1n;
  const mintPrice = u256ToBigInt(mintPriceRaw[0], mintPriceRaw[1]);
  const platformFee = u256ToBigInt(platformFeeRaw[0], platformFeeRaw[1]);
  const strkTokenAddress = canonicalAddress(env.NEXT_PUBLIC_STRK_ADDRESS);

  const quantityBigInt = BigInt(quantity);
  const totalFee = platformFee * quantityBigInt;
  const totalMint = isFree ? 0n : mintPrice * quantityBigInt;
  const totalApproval = totalFee + totalMint;
  const accountAddress = canonicalAddress(session.address);

  const balanceRaw = await readContract(
    provider,
    strkTokenAddress,
    'balanceOf',
    CallData.compile([accountAddress]),
  );
  const balance = u256ToBigInt(balanceRaw[0], balanceRaw[1]);
  if (balance < totalApproval) {
    throw new Error(
      `Insufficient STRK balance. Need ${formatUnits(totalApproval, 18n)} STRK, wallet has ${formatUnits(balance, 18n)} STRK.`,
    );
  }

  const approveAmount = encodeU256(totalApproval);

  const approveCall: Call = {
    contractAddress: strkTokenAddress,
    entrypoint: 'approve',
    calldata: CallData.compile([normalizedCollectionAddress, approveAmount.low, approveAmount.high]),
  };

  const mintCall: Call = {
    contractAddress: normalizedCollectionAddress,
    entrypoint: 'mint',
    calldata: CallData.compile([quantity]),
  };

  const tx = await session.execute([approveCall, mintCall], { sponsored: true });
  await tx.wait();

  return {
    txHash: tx.hash,
    collectionAddress: normalizedCollectionAddress,
    quantity,
  };
}
