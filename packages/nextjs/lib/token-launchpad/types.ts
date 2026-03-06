export type TokenLaunchRecord = {
  address: string;
  owner: string;
  name: string;
  symbol: string;
  logoImageUrl?: string;
  logoImageCid?: string;
  initialMarketCapUsd?: number;
  totalSupply: bigint;
  totalSupplyFormatted: string;
  isLaunched: boolean;
  launchData?: {
    quoteToken: string;
    quoteAmount: bigint;
    quoteAmountFormatted: string;
    antiBotSeconds: number;
    maxBuyBps: number;
    fee: string;
    tickSpacing: string;
    startPriceMag: string;
    startPriceIsNegative: boolean;
    bound: string;
    launcher: string;
    launchedAt: number;
  };
  createdTxHash?: string;
  createdAtBlock?: number;
};

export type CreateTokenInput = {
  name: string;
  symbol: string;
  initialSupply: string;
};

export type CreateAndLaunchTokenInput = {
  name: string;
  symbol: string;
  initialSupply: string;
  deployerAllocationPercent: number;
  startingMarketCapStrk: string;
  quoteToken: string;
};

export type LaunchOnEkuboInput = {
  tokenAddress: string;
  quoteToken: string;
  quoteAmountStrk: string;
  lpPercent: number;
  maxBuyBps: number;
  fee: string;
  tickSpacing: string;
  startPriceMag: string;
  startPriceIsNegative: boolean;
  bound: string;
};
