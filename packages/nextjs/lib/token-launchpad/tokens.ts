import { RpcProvider, hash, shortString } from 'starknet';
import { proxiedImageUrl } from '~~/lib/assets/image-url';
import { env } from '~~/lib/config';
import { getTokenInitialMarketCapUsdMap, listTokenLaunchRows, upsertTokenLaunchRow } from '~~/lib/storage/market-store';
import { canonicalAddress } from '~~/lib/starknet/address';
import { getTokenProfile, getTokenProfilesMap } from '~~/lib/token-launchpad/profile-store';
import type { TokenLaunchRecord } from '~~/lib/token-launchpad/types';

const DEFAULT_RPC = 'https://starknet-mainnet-rpc.publicnode.com';
const TOKEN_DECIMALS = 18n;

function getProvider() {
  return new RpcProvider({ nodeUrl: env.NEXT_PUBLIC_STARKNET_RPC || DEFAULT_RPC });
}

function u256ToBigInt(lowHex: string, highHex: string) {
  const low = BigInt(lowHex);
  const high = BigInt(highHex);
  return (high << 128n) + low;
}

function formatUnits(value: bigint, decimals: bigint) {
  const base = 10n ** decimals;
  const whole = value / base;
  const frac = value % base;
  if (frac === 0n) return whole.toString();
  const fracText = frac.toString().padStart(Number(decimals), '0').replace(/0+$/, '');
  return `${whole}.${fracText}`;
}

function normalizeHexAddress(value: string) {
  if (!value) return value;
  return canonicalAddress(value);
}

function decodeShortStringSafe(value: string) {
  try {
    return shortString.decodeShortString(value);
  } catch {
    return value;
  }
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

type CreatedEventAddress = {
  address: string;
  txHash?: string;
  blockNumber?: number;
};

async function fetchCreatedTokenAddresses(limit: number): Promise<CreatedEventAddress[]> {
  if (!env.NEXT_PUBLIC_TOKEN_FACTORY_ADDRESS) return [];

  const provider = getProvider();
  const createdSelector = hash.getSelectorFromName('MemecoinCreated');
  const toBlock = await provider.getBlockNumber();
  const fromBlock = Math.max(0, toBlock - 250_000);
  const seen = new Set<string>();
  const rows: CreatedEventAddress[] = [];
  let continuationToken: string | undefined;

  while (rows.length < limit) {
    const response = await provider.getEvents({
      address: env.NEXT_PUBLIC_TOKEN_FACTORY_ADDRESS,
      from_block: { block_number: fromBlock },
      to_block: { block_number: toBlock },
      keys: [[createdSelector]],
      chunk_size: 50,
      continuation_token: continuationToken,
    });

    for (const event of response.events) {
      const data = event.data ?? [];
      if (!data.length) continue;
      const address = normalizeHexAddress(data[data.length - 1]);
      if (!address || seen.has(address)) continue;
      seen.add(address);
      rows.push({
        address,
        txHash: event.transaction_hash,
        blockNumber: event.block_number,
      });
      if (rows.length >= limit) break;
    }

    if (!response.continuation_token || rows.length >= limit) break;
    continuationToken = response.continuation_token;
  }

  return rows;
}

export async function fetchTokenByAddress(address: string): Promise<TokenLaunchRecord> {
  const provider = getProvider();
  const [nameRaw, symbolRaw, ownerRaw, supplyRaw, launchedRaw, launchDataRaw] = await Promise.all([
    readContract(provider, address, 'name'),
    readContract(provider, address, 'symbol'),
    readContract(provider, address, 'owner'),
    readContract(provider, address, 'total_supply'),
    readContract(provider, address, 'is_launched'),
    readContract(provider, address, 'launch_data'),
  ]);

  const totalSupply = u256ToBigInt(supplyRaw[0], supplyRaw[1]);
  const isLaunched = BigInt(launchedRaw[0]) === 1n;
  let launchData: TokenLaunchRecord['launchData'];
  if (isLaunched && launchDataRaw.length > 0 && BigInt(launchDataRaw[0]) === 0n) {
    const quoteAmount = u256ToBigInt(launchDataRaw[2], launchDataRaw[3]);
    launchData = {
      quoteToken: normalizeHexAddress(launchDataRaw[1]),
      quoteAmount,
      quoteAmountFormatted: formatUnits(quoteAmount, TOKEN_DECIMALS),
      antiBotSeconds: Number(launchDataRaw[4]),
      maxBuyBps: Number(launchDataRaw[5]),
      fee: launchDataRaw[6],
      tickSpacing: launchDataRaw[7],
      startPriceMag: launchDataRaw[8],
      startPriceIsNegative: BigInt(launchDataRaw[9]) === 1n,
      bound: launchDataRaw[10],
      launcher: normalizeHexAddress(launchDataRaw[11]),
      launchedAt: Number(launchDataRaw[12]),
    };
  }
  const profile = await getTokenProfile(address);
  return {
    address: normalizeHexAddress(address),
    owner: normalizeHexAddress(ownerRaw[0]),
    name: decodeShortStringSafe(nameRaw[0]),
    symbol: decodeShortStringSafe(symbolRaw[0]),
    logoImageUrl: proxiedImageUrl(profile?.imageUrl),
    logoImageCid: profile?.imageCid,
    totalSupply,
    totalSupplyFormatted: formatUnits(totalSupply, TOKEN_DECIMALS),
    isLaunched,
    launchData,
  };
}

export async function fetchLatestTokenLaunches(limit = 24): Promise<TokenLaunchRecord[]> {
  if (!env.NEXT_PUBLIC_TOKEN_FACTORY_ADDRESS) return [];
  const cached = await listTokenLaunchRows(limit);
  const initialMcs = await getTokenInitialMarketCapUsdMap();
  const profiles = await getTokenProfilesMap();
  if (cached.length >= Math.max(4, Math.floor(limit * 0.7))) {
    return cached.map((row) => {
      const profile = profiles[row.token_address.toLowerCase()];
      return {
        address: normalizeHexAddress(row.token_address),
        owner: normalizeHexAddress(row.owner),
        name: row.name,
        symbol: row.symbol,
        logoImageUrl: proxiedImageUrl(profile?.imageUrl),
        logoImageCid: profile?.imageCid,
        initialMarketCapUsd: initialMcs[row.token_address.toLowerCase()],
        totalSupply: BigInt(row.total_supply),
        totalSupplyFormatted: row.total_supply_formatted,
        isLaunched: Boolean(row.is_launched),
        launchData: row.quote_token
          ? {
              quoteToken: normalizeHexAddress(row.quote_token),
              quoteAmount: 0n,
              quoteAmountFormatted: '0',
              antiBotSeconds: 0,
              maxBuyBps: 1000,
              fee: '0x0',
              tickSpacing: '0',
              startPriceMag: '0',
              startPriceIsNegative: false,
              bound: '0',
              launcher: normalizeHexAddress(row.owner),
              launchedAt: 0,
            }
          : undefined,
        createdTxHash: row.created_tx_hash ?? undefined,
        createdAtBlock: row.created_at_block ?? undefined,
      };
    });
  }

  const events = await fetchCreatedTokenAddresses(limit);
  const records = await Promise.all(
    events.map(async (row) => {
      try {
        const token = await fetchTokenByAddress(row.address);
        const profile = profiles[row.address.toLowerCase()];
        return {
          ...token,
          logoImageUrl: proxiedImageUrl(token.logoImageUrl || profile?.imageUrl),
          logoImageCid: token.logoImageCid || profile?.imageCid,
          createdTxHash: row.txHash,
          createdAtBlock: row.blockNumber,
        };
      } catch {
        return null;
      }
    }),
  );

  const validRecords: TokenLaunchRecord[] = [];
  for (const item of records) {
    if (!item) continue;
    await upsertTokenLaunchRow({
      token_address: item.address,
      owner: item.owner,
      name: item.name,
      symbol: item.symbol,
      total_supply: item.totalSupply.toString(),
      total_supply_formatted: item.totalSupplyFormatted,
      is_launched: item.isLaunched,
      quote_token: item.launchData?.quoteToken ?? null,
      created_tx_hash: item.createdTxHash ?? null,
      created_at_block: item.createdAtBlock ?? null,
    });
    item.initialMarketCapUsd = initialMcs[item.address.toLowerCase()];
    validRecords.push(item);
  }
  return validRecords;
}
