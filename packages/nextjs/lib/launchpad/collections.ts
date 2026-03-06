import { RpcProvider, byteArray, shortString } from 'starknet';
import { proxiedImageUrl } from '~~/lib/assets/image-url';
import { env } from '~~/lib/config';
import { getPinataAlias } from '~~/lib/pinata/alias-store';
import { ipfsGatewayUrl } from '~~/lib/pinata/server';
import { getNftCollectionByAddress, getNftLaunchpadMeta, listNftCollections, upsertNftCollections, upsertNftLaunchpadMeta } from '~~/lib/storage/market-store';
import { canonicalAddress } from '~~/lib/starknet/address';
import { getServerRpcUrl } from '~~/lib/starknet/rpc';

export type LaunchCollection = {
  index: number;
  address: string;
  name: string;
  symbol: string;
  creator: string;
  model: 'free' | 'paid';
  mintPriceStrk: string;
  minted: number;
  maxSupply: number;
  progressPct: number;
  baseUri: string;
  imageUrl?: string;
};

export type LaunchpadData = {
  collections: LaunchCollection[];
  deployFeeStrk: string;
  mintFeeStrk: string;
  factoryAddress: string;
};

function toBigInt(value: string) {
  return BigInt(value);
}

function parseU256(low: string, high: string) {
  return (toBigInt(high) << 128n) + toBigInt(low);
}

function formatStrk(wei: bigint) {
  const whole = wei / 10n ** 18n;
  const fraction = wei % 10n ** 18n;
  if (fraction === 0n) return whole.toString();

  const padded = fraction.toString().padStart(18, '0').replace(/0+$/, '');
  return `${whole.toString()}.${padded}`;
}

function tryDecodeShortString(value: string) {
  try {
    return shortString.decodeShortString(value);
  } catch {
    return value;
  }
}

function tryDecodeByteArray(raw: string[]) {
  try {
    const dataLen = Number(BigInt(raw[0] ?? '0'));
    if (!Number.isFinite(dataLen) || dataLen < 0) return '';
    const dataStart = 1;
    const dataEnd = dataStart + dataLen;
    const data = raw.slice(dataStart, dataEnd);
    const pendingWord = raw[dataEnd] ?? '0x0';
    const pendingWordLen = raw[dataEnd + 1] ?? '0x0';
    return byteArray.stringFromByteArray({
      data,
      pending_word: pendingWord,
      pending_word_len: pendingWordLen,
    });
  } catch {
    return '';
  }
}

function decodeContractString(raw: string[]) {
  if (raw.length > 1) {
    const decoded = tryDecodeByteArray(raw);
    if (decoded) return decoded;
  }
  return tryDecodeShortString(raw[0] ?? '');
}

function ipfsUriToGateway(uri: string) {
  const trimmed = uri.trim();
  if (!trimmed) return '';
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) return trimmed;
  if (trimmed.startsWith('ipfs://ipfs/')) return `https://gateway.pinata.cloud/ipfs/${trimmed.slice('ipfs://ipfs/'.length)}`;
  if (trimmed.startsWith('ipfs://')) return `https://gateway.pinata.cloud/ipfs/${trimmed.slice('ipfs://'.length)}`;
  return '';
}

async function resolveCollectionImage(metadataUri: string, contractUri: string, baseUri: string) {
  const metadataTarget = ipfsUriToGateway(contractUri) || ipfsUriToGateway(metadataUri);
  if (metadataTarget) {
    try {
      const response = await fetch(metadataTarget, { next: { revalidate: 3600 } });
      if (response.ok) {
        const payload = (await response.json()) as {
          image?: string;
          image_url?: string;
          imageUrl?: string;
          banner_image?: string;
          featured_image?: string;
        };
        const candidate =
          payload.image ||
          payload.image_url ||
          payload.imageUrl ||
          payload.banner_image ||
          payload.featured_image ||
          '';
        const resolved = ipfsUriToGateway(candidate) || candidate;
        if (resolved) return resolved;
      }
    } catch {
      // fallback to alias-store resolution below
    }
  }

  const pinata = await getPinataAlias(baseUri);
  return pinata ? ipfsGatewayUrl(pinata.imageCid) : undefined;
}

async function call(provider: RpcProvider, contractAddress: string, entrypoint: string, calldata: string[] = []) {
  return provider.callContract(
    {
      contractAddress,
      entrypoint,
      calldata,
    },
    'latest',
  );
}

async function fetchCollectionByAddressWithProvider(
  provider: RpcProvider,
  address: string,
): Promise<LaunchCollection> {

  const [nameRaw, symbolRaw, creatorRaw, freeRaw, mintPriceRaw, mintedRaw, maxSupplyRaw, baseUriRaw, metadataUriRaw, contractUriRaw] = await Promise.all([
    call(provider, address, 'name'),
    call(provider, address, 'symbol'),
    call(provider, address, 'owner'),
    call(provider, address, 'is_free_mint_model'),
    call(provider, address, 'mint_price'),
    call(provider, address, 'total_supply'),
    call(provider, address, 'max_supply'),
    call(provider, address, 'base_uri'),
    call(provider, address, 'metadata_uri'),
    call(provider, address, 'contract_uri'),
  ]);

  const minted = Number(toBigInt(mintedRaw[0]));
  const maxSupply = Number(toBigInt(maxSupplyRaw[0]));
  const progressPct = maxSupply > 0 ? Math.min(100, Math.round((minted / maxSupply) * 100)) : 0;
  const model = toBigInt(freeRaw[0]) === 1n ? 'free' : 'paid';
  const mintPriceStrk = formatStrk(parseU256(mintPriceRaw[0], mintPriceRaw[1]));
  const baseUri = decodeContractString(baseUriRaw);
  const metadataUri = decodeContractString(metadataUriRaw);
  const contractUri = decodeContractString(contractUriRaw);
  const imageUrl = await resolveCollectionImage(metadataUri, contractUri, baseUri);

  return {
    index: 0,
    address: canonicalAddress(address),
    name: decodeContractString(nameRaw),
    symbol: decodeContractString(symbolRaw),
    creator: canonicalAddress(creatorRaw[0]),
    model,
    mintPriceStrk,
    minted,
    maxSupply,
    progressPct,
    baseUri,
    imageUrl: proxiedImageUrl(imageUrl),
  };
}

export async function fetchCollectionByAddress(address: string): Promise<LaunchCollection> {
  const cached = await getNftCollectionByAddress(address);
  if (cached) {
    return {
      index: cached.idx,
      address: canonicalAddress(cached.collection_address),
      name: cached.name,
      symbol: cached.symbol,
      creator: canonicalAddress(cached.creator),
      model: cached.model,
      mintPriceStrk: cached.mint_price_strk,
      minted: cached.minted,
      maxSupply: cached.max_supply,
      progressPct: cached.progress_pct,
      baseUri: cached.base_uri,
      imageUrl: proxiedImageUrl(cached.image_url),
    };
  }
  const rpc = getServerRpcUrl();
  const provider = new RpcProvider({ nodeUrl: rpc });
  return fetchCollectionByAddressWithProvider(provider, address);
}

export async function fetchLaunchpadData(): Promise<LaunchpadData> {
  const factoryAddress = env.NEXT_PUBLIC_FACTORY_ADDRESS;
  if (!factoryAddress) {
    return {
      collections: [],
      deployFeeStrk: '0',
      mintFeeStrk: '0',
      factoryAddress: '',
    };
  }

  const cachedCollections = await listNftCollections(1000);
  const cachedMeta = await getNftLaunchpadMeta(factoryAddress);
  return {
    collections: cachedCollections.map((row) => ({
      index: row.idx,
      address: canonicalAddress(row.collection_address),
      name: row.name,
      symbol: row.symbol,
      creator: canonicalAddress(row.creator),
      model: row.model,
      mintPriceStrk: row.mint_price_strk,
      minted: row.minted,
      maxSupply: row.max_supply,
      progressPct: row.progress_pct,
      baseUri: row.base_uri,
      imageUrl: proxiedImageUrl(row.image_url),
    })),
    deployFeeStrk: cachedMeta?.deploy_fee_strk || '0',
    mintFeeStrk: cachedMeta?.mint_fee_strk || '0',
    factoryAddress: canonicalAddress(factoryAddress),
  };
}

export async function fetchLaunchpadMeta() {
  const factoryAddress = env.NEXT_PUBLIC_FACTORY_ADDRESS;
  if (!factoryAddress) {
    return { deployFeeStrk: '0', mintFeeStrk: '0', factoryAddress: '' };
  }

  const cachedMeta = await getNftLaunchpadMeta(factoryAddress);
  if (cachedMeta) {
    return {
      deployFeeStrk: cachedMeta.deploy_fee_strk,
      mintFeeStrk: cachedMeta.mint_fee_strk,
      factoryAddress: canonicalAddress(factoryAddress),
    };
  }

  const provider = new RpcProvider({ nodeUrl: getServerRpcUrl() });
  const [deployFeeRaw, mintFeeRaw] = await Promise.all([
    call(provider, factoryAddress, 'deploy_fee'),
    call(provider, factoryAddress, 'mint_fee_per_mint'),
  ]);
  const payload = {
    deployFeeStrk: formatStrk(parseU256(deployFeeRaw[0], deployFeeRaw[1])),
    mintFeeStrk: formatStrk(parseU256(mintFeeRaw[0], mintFeeRaw[1])),
    factoryAddress: canonicalAddress(factoryAddress),
  };
  await upsertNftLaunchpadMeta({
    factory_address: factoryAddress,
    deploy_fee_strk: payload.deployFeeStrk,
    mint_fee_strk: payload.mintFeeStrk,
    collection_count: 0,
  });
  return payload;
}

async function syncLaunchpadFromChain(provider: RpcProvider, factoryAddress: string): Promise<LaunchpadData> {
  const existingCollections = await listNftCollections(2000);
  const existingByAddress = new Map(
    existingCollections.map((row) => [canonicalAddress(row.collection_address).toLowerCase(), row]),
  );

  const [countRaw, deployFeeRaw, mintFeeRaw] = await Promise.all([
    call(provider, factoryAddress, 'collection_count'),
    call(provider, factoryAddress, 'deploy_fee'),
    call(provider, factoryAddress, 'mint_fee_per_mint'),
  ]);

  const collectionCount = Number(toBigInt(countRaw[0]));
  const indexes = [...Array(collectionCount).keys()];

  const addressCalls = await Promise.all(
    indexes.map((index) => call(provider, factoryAddress, 'collection_at', [index.toString()])),
  );
  const addresses = addressCalls.map((result) => canonicalAddress(result[0]));

  const collectionPromises = addresses.map(async (address, idx) => {
    const collection = await fetchCollectionByAddressWithProvider(provider, address);
    const existing = existingByAddress.get(collection.address.toLowerCase());
    return {
      ...collection,
      index: idx,
      imageUrl: proxiedImageUrl(collection.imageUrl || existing?.image_url),
    };
  });

  const collections = (await Promise.all(collectionPromises)).sort((a, b) => b.index - a.index);
  await upsertNftCollections(
    collections.map((item) => ({
      collection_address: item.address,
      idx: item.index,
      name: item.name,
      symbol: item.symbol,
      creator: item.creator,
      model: item.model,
      mint_price_strk: item.mintPriceStrk,
      minted: item.minted,
      max_supply: item.maxSupply,
      progress_pct: item.progressPct,
      base_uri: item.baseUri,
      image_url: item.imageUrl || null,
      created_tx_hash: existingByAddress.get(item.address.toLowerCase())?.created_tx_hash || null,
    })),
  );
  await upsertNftLaunchpadMeta({
    factory_address: factoryAddress,
    deploy_fee_strk: formatStrk(parseU256(deployFeeRaw[0], deployFeeRaw[1])),
    mint_fee_strk: formatStrk(parseU256(mintFeeRaw[0], mintFeeRaw[1])),
    collection_count: collectionCount,
  });

  return {
    collections,
    deployFeeStrk: formatStrk(parseU256(deployFeeRaw[0], deployFeeRaw[1])),
    mintFeeStrk: formatStrk(parseU256(mintFeeRaw[0], mintFeeRaw[1])),
    factoryAddress: canonicalAddress(factoryAddress),
  };
}
