import { OnboardStrategy, StarkSDK, type WalletInterface } from 'starkzap';
import { mobileEnv } from '~/lib/config';

let sdk: StarkSDK | null = null;

export function getStarkzapSdk() {
  if (!sdk) {
    sdk = new StarkSDK({
      network: 'sepolia',
      paymaster: mobileEnv.paymasterUrl ? { nodeUrl: mobileEnv.paymasterUrl } : undefined,
    });
  }
  return sdk;
}

export async function connectCartridgeWallet() {
  const result = await getStarkzapSdk().onboard({
    strategy: OnboardStrategy.Cartridge,
    feeMode: 'sponsored',
    deploy: 'if_needed',
  });
  return result.wallet;
}

export async function connectPrivyWallet() {
  if (!mobileEnv.privyResolveUrl) {
    throw new Error('EXPO_PUBLIC_PRIVY_RESOLVE_URL missing.');
  }

  const result = await getStarkzapSdk().onboard({
    strategy: OnboardStrategy.Privy,
    feeMode: 'sponsored',
    deploy: 'if_needed',
    privy: {
      resolve: async () => {
        const response = await fetch(mobileEnv.privyResolveUrl, { method: 'POST' });
        if (!response.ok) throw new Error('Privy resolve failed.');
        return response.json();
      },
    },
  });

  return result.wallet;
}

export async function disconnectWallet(wallet: WalletInterface) {
  await wallet.disconnect();
}
