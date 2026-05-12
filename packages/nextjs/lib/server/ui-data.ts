import 'server-only';

import { fetchLaunchpadData } from '~~/lib/launchpad/collections';
import { attachLiveTokenMarket } from '~~/lib/token-launchpad/live-market';
import { fetchLatestTokenLaunches } from '~~/lib/token-launchpad/tokens';
import type { LaunchCollection } from '~~/lib/launchpad/collections';

export type HomeTokenItem = {
  address: string;
  name: string;
  symbol: string;
  logoImageUrl?: string;
  totalSupplyFormatted: string;
  isLaunched: boolean;
  marketCapUsd: number;
  change24hPct: number;
};

export type HomePayload = {
  tokens: HomeTokenItem[];
  collections: LaunchCollection[];
  deployFeeStrk: string;
  mintFeeStrk: string;
  factoryAddress: string;
};

export type TokensListPayload = {
  items: HomeTokenItem[];
};

export type CollectionsPayload = {
  collections: LaunchCollection[];
  deployFeeStrk: string;
  mintFeeStrk: string;
  factoryAddress: string;
};

export type ProfileTokenItem = {
  address: string;
  owner: string;
  name: string;
  symbol: string;
  logoImageUrl?: string;
  isLaunched: boolean;
  quoteAmountFormatted?: string;
};

export type ProfilePayload = {
  tokens: ProfileTokenItem[];
  collections: LaunchCollection[];
};

function mapHomeToken(token: Awaited<ReturnType<typeof attachLiveTokenMarket>>[number]): HomeTokenItem {
  return {
    address: token.address,
    name: token.name,
    symbol: token.symbol,
    logoImageUrl: token.logoImageUrl,
    totalSupplyFormatted: token.totalSupplyFormatted,
    isLaunched: token.isLaunched,
    marketCapUsd: token.marketCapUsd ?? token.initialMarketCapUsd ?? 0,
    change24hPct: token.change24hPct ?? 0,
  };
}

export async function loadHomePayload(tokenLimit = 24): Promise<HomePayload> {
  const [nftData, tokens] = await Promise.all([fetchLaunchpadData(), fetchLatestTokenLaunches(tokenLimit)]);
  const liveTokens = await attachLiveTokenMarket(tokens);
  return {
    collections: nftData.collections,
    deployFeeStrk: nftData.deployFeeStrk,
    mintFeeStrk: nftData.mintFeeStrk,
    factoryAddress: nftData.factoryAddress,
    tokens: liveTokens.map(mapHomeToken),
  };
}

export async function loadTokensListPayload(limit = 100): Promise<TokensListPayload> {
  const tokens = await fetchLatestTokenLaunches(limit);
  const liveTokens = await attachLiveTokenMarket(tokens);
  return { items: liveTokens.map(mapHomeToken) };
}

export async function loadCollectionsPayload(): Promise<CollectionsPayload> {
  const data = await fetchLaunchpadData();
  return {
    collections: data.collections,
    deployFeeStrk: data.deployFeeStrk,
    mintFeeStrk: data.mintFeeStrk,
    factoryAddress: data.factoryAddress,
  };
}

export async function loadProfilePayload(tokenLimit = 120): Promise<ProfilePayload> {
  const [tokens, nftData] = await Promise.all([
    fetchLatestTokenLaunches(tokenLimit),
    fetchLaunchpadData(),
  ]);
  return {
    tokens: tokens.map((token) => ({
      address: token.address,
      owner: token.owner,
      name: token.name,
      symbol: token.symbol,
      logoImageUrl: token.logoImageUrl,
      isLaunched: token.isLaunched,
      quoteAmountFormatted: token.launchData?.quoteAmountFormatted,
    })),
    collections: nftData.collections,
  };
}

export const EMPTY_HOME_PAYLOAD: HomePayload = {
  tokens: [],
  collections: [],
  deployFeeStrk: '0',
  mintFeeStrk: '0',
  factoryAddress: '',
};

export const EMPTY_TOKENS_PAYLOAD: TokensListPayload = { items: [] };

export const EMPTY_COLLECTIONS_PAYLOAD: CollectionsPayload = {
  collections: [],
  deployFeeStrk: '0',
  mintFeeStrk: '0',
  factoryAddress: '',
};

export const EMPTY_PROFILE_PAYLOAD: ProfilePayload = { tokens: [], collections: [] };
