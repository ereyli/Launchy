import Constants from 'expo-constants';

const extra = (Constants.expoConfig?.extra ?? {}) as Record<string, string | undefined>;

export const mobileEnv = {
  apiBaseUrl: process.env.EXPO_PUBLIC_API_BASE_URL || extra.EXPO_PUBLIC_API_BASE_URL || 'http://localhost:3001',
  ekuboFeeRouter:
    process.env.EXPO_PUBLIC_EKUBO_SWAP_FEE_ROUTER_ADDRESS ||
    extra.EXPO_PUBLIC_EKUBO_SWAP_FEE_ROUTER_ADDRESS ||
    '',
  paymasterUrl:
    process.env.EXPO_PUBLIC_PAYMASTER_URL ||
    extra.EXPO_PUBLIC_PAYMASTER_URL ||
    'https://starknet-sepolia.api.avnu.fi/paymaster/v1/5e4c237c-8018-49ad-be9b-d4086d5b9acc',
  privyResolveUrl: process.env.EXPO_PUBLIC_PRIVY_RESOLVE_URL || extra.EXPO_PUBLIC_PRIVY_RESOLVE_URL || '',
};
