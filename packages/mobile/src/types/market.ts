export type TokenCard = {
  address: string;
  name: string;
  symbol: string;
  owner: string;
  totalSupply: string;
  logoUrl?: string | null;
  marketCapUsd?: number | null;
  isLaunched?: boolean;
  quoteToken?: string;
  poolKey?: {
    fee: string;
    tickSpacing: string;
    extension?: string;
  } | null;
};

export type NftCard = {
  address: string;
  name: string;
  symbol: string;
  minted: number;
  maxSupply: number;
  mintPrice: string;
  imageUrl?: string | null;
};

export type TokenDetail = {
  address: string;
  owner: string;
  name: string;
  symbol: string;
  logoUrl?: string | null;
  totalSupply: string;
  isLaunched: boolean;
  quoteToken: string;
  poolKey: {
    token0: string;
    token1: string;
    fee: string;
    tickSpacing: string;
    extension?: string;
  } | null;
};

export type TradeRow = {
  id: string;
  account: string;
  side: 'buy' | 'sell';
  quoteAmount: number;
  tokenAmount: number;
  ts: number;
  txHash: string;
};

export type CandleRow = {
  start: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
};
