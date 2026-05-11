import { RpcProvider, hash, shortString } from 'starknet';
import { proxiedImageUrl } from '~~/lib/assets/image-url';
import { env } from '~~/lib/config';
import {
  getCursor,
  getTokenInitialMarketCapUsdMap,
  getTokenLaunchRow,
  listTokenLaunchRows,
  setCursor,
  upsertTokenLaunchRow,
} from '~~/lib/storage/market-store';
import { canonicalAddress } from '~~/lib/starknet/address';
import { getServerRpcUrl } from '~~/lib/starknet/rpc';
import { getTokenProfile, getTokenProfilesMap } from '~~/lib/token-launchpad/profile-store';
import type { TokenLaunchRecord } from '~~/lib/token-launchpad/types';
const TOKEN_DECIMALS = 18n;

function getProvider() {
  return new RpcProvider({ nodeUrl: getServerRpcUrl() });
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
  return provider.callContract(
    {
      contractAddress,
      entrypoint,
      calldata,
    },
    'latest',
  );
}

const SYNC_THROTTLE_MS = 30_000;
const SYNC_DEFAULT_LOOKBACK_BLOCKS = 250_000;
const SYNC_MAX_BLOCKS_PER_QUERY = 1024;
const SYNC_MAX_PER_RUN = 200;

const lastSyncAt = new Map<string, number>();
const inFlightSync = new Map<string, Promise<void>>();

function tokenLaunchCursorId() {
  const factory = (env.NEXT_PUBLIC_TOKEN_FACTORY_ADDRESS || '').toLowerCase();
  return `token_launches:${factory}`;
}

function buildLaunchRowFromRecord(record: TokenLaunchRecord, options: { txHash?: string; blockNumber?: number }) {
  return {
    token_address: record.address,
    owner: record.owner,
    name: record.name,
    symbol: record.symbol,
    total_supply: record.totalSupply.toString(),
    total_supply_formatted: record.totalSupplyFormatted,
    is_launched: record.isLaunched,
    quote_token: record.launchData?.quoteToken ?? null,
    created_tx_hash: options.txHash ?? record.createdTxHash ?? null,
    created_at_block: typeof options.blockNumber === 'number' ? options.blockNumber : record.createdAtBlock ?? null,
  };
}

export async function persistTokenLaunchFromChain(args: {
  tokenAddress: string;
  txHash?: string;
  blockNumber?: number;
}): Promise<TokenLaunchRecord | null> {
  const address = canonicalAddress(args.tokenAddress);
  if (!address.startsWith('0x')) return null;

  let blockNumber = args.blockNumber;
  if (typeof blockNumber !== 'number' && args.txHash) {
    try {
      const provider = getProvider();
      const receipt = (await provider.getTransactionReceipt(args.txHash)) as {
        block_number?: number;
        blockNumber?: number;
      };
      const candidate = receipt?.block_number ?? receipt?.blockNumber;
      if (typeof candidate === 'number' && Number.isFinite(candidate)) {
        blockNumber = candidate;
      }
    } catch {
      // best-effort
    }
  }

  try {
    const record = await fetchTokenByAddress(address);
    await upsertTokenLaunchRow(buildLaunchRowFromRecord(record, { txHash: args.txHash, blockNumber }));
    return record;
  } catch {
    return null;
  }
}

export async function syncTokenLaunchesFromChain(options: { force?: boolean } = {}): Promise<void> {
  if (!env.NEXT_PUBLIC_TOKEN_FACTORY_ADDRESS) return;
  const cursorId = tokenLaunchCursorId();

  if (!options.force) {
    const last = lastSyncAt.get(cursorId) ?? 0;
    if (Date.now() - last < SYNC_THROTTLE_MS) return;
  }

  const inFlight = inFlightSync.get(cursorId);
  if (inFlight) return inFlight;

  const task = (async () => {
    try {
      const provider = getProvider();
      const factory = canonicalAddress(env.NEXT_PUBLIC_TOKEN_FACTORY_ADDRESS);
      const createdSelector = hash.getSelectorFromName('MemecoinCreated');
      const latestBlock = await provider.getBlockNumber();
      const storedCursor = await getCursor(cursorId);
      const startBlock =
        typeof storedCursor === 'number'
          ? Math.max(0, storedCursor)
          : Math.max(0, latestBlock - SYNC_DEFAULT_LOOKBACK_BLOCKS);

      let highestSeen = storedCursor ?? startBlock;
      let processed = 0;
      let from = startBlock;

      const seenAddresses = new Set<string>();

      outer: while (from <= latestBlock) {
        const to = Math.min(latestBlock, from + SYNC_MAX_BLOCKS_PER_QUERY - 1);
        let continuationToken: string | undefined;

        do {
          const response = await provider.getEvents({
            address: factory,
            from_block: { block_number: from },
            to_block: { block_number: to },
            keys: [[createdSelector]],
            chunk_size: 50,
            continuation_token: continuationToken,
          });

          for (const event of response.events) {
            const data = event.data ?? [];
            if (!data.length) continue;
            const tokenAddress = normalizeHexAddress(data[data.length - 1]);
            if (!tokenAddress || !tokenAddress.startsWith('0x')) continue;
            if (seenAddresses.has(tokenAddress)) continue;
            seenAddresses.add(tokenAddress);

            const blockNumber = typeof event.block_number === 'number' ? event.block_number : undefined;
            if (typeof blockNumber === 'number') {
              highestSeen = Math.max(highestSeen, blockNumber);
            }

            const existing = await getTokenLaunchRow(tokenAddress);
            if (existing && existing.created_tx_hash && existing.created_at_block != null) {
              continue;
            }

            try {
              const record = await fetchTokenByAddress(tokenAddress);
              await upsertTokenLaunchRow(
                buildLaunchRowFromRecord(record, {
                  txHash: event.transaction_hash,
                  blockNumber,
                }),
              );
              processed += 1;
              if (processed >= SYNC_MAX_PER_RUN) break outer;
            } catch {
              // skip this token; keep cursor unchanged so we retry later
            }
          }

          continuationToken = response.continuation_token;
        } while (continuationToken);

        from = to + 1;
      }

      const newCursor = Math.min(latestBlock, Math.max(highestSeen, startBlock));
      await setCursor(cursorId, newCursor);
    } catch {
      // swallow — sync is best-effort
    } finally {
      lastSyncAt.set(cursorId, Date.now());
      inFlightSync.delete(cursorId);
    }
  })();

  inFlightSync.set(cursorId, task);
  return task;
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
  await syncTokenLaunchesFromChain().catch(() => undefined);
  const cached = await listTokenLaunchRows(limit);
  const initialMcs = await getTokenInitialMarketCapUsdMap();
  const profiles = await getTokenProfilesMap();
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
