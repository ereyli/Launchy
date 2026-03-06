'use client';

import { RpcProvider, type Call } from 'starknet';
import { getStarknet } from '@starknet-io/get-starknet-core';
import { StarkSDK, OnboardStrategy, type WalletInterface } from 'starkzap';
import { env } from '~~/lib/config';
import { CLIENT_RPC_PROXY_PATH } from '~~/lib/starknet/rpc';
import { canonicalAddress, sameAddress } from '~~/lib/starknet/address';

export type WalletKind = 'injected' | 'cartridge';

export type WalletTx = {
  hash: string;
  wait: () => Promise<void>;
};

export type WalletSessionSnapshot = {
  connected: boolean;
  kind: WalletKind | null;
  address: string | null;
  label: string | null;
};

type InternalSession = {
  kind: WalletKind;
  address: string;
  label: string;
  execute: (calls: Call[], options?: { sponsored?: boolean }) => Promise<WalletTx>;
  callContract: (call: Call) => Promise<string[]>;
  disconnect: () => Promise<void>;
};

type PersistedWalletSession = {
  kind: WalletKind;
  walletId?: string | null;
};

let currentSession: InternalSession | null = null;
const listeners = new Set<() => void>();
let sdkInstance: StarkSDK | null = null;
let injectedManager: ReturnType<typeof getStarknet> | null = null;
let fallbackRpcProvider: RpcProvider | null = null;
const WALLET_STORAGE_KEY = 'starknet_launchpad_wallet_session';
const DEFAULT_SAFE_STRK_APPROVE_MAX = '1000000';
const DISCONNECTED_SNAPSHOT: WalletSessionSnapshot = {
  connected: false,
  kind: null,
  address: null,
  label: null,
};
let currentSnapshot: WalletSessionSnapshot = DISCONNECTED_SNAPSHOT;

function emitChange() {
  for (const listener of listeners) listener();
}

function syncSnapshot() {
  if (!currentSession) {
    currentSnapshot = DISCONNECTED_SNAPSHOT;
    return;
  }

  currentSnapshot = {
    connected: true,
    kind: currentSession.kind,
    address: currentSession.address,
    label: currentSession.label,
  };
}

function getSdk() {
  if (!sdkInstance) {
    sdkInstance = new StarkSDK({
      network: env.NEXT_PUBLIC_STARKNET_NETWORK === 'mainnet' ? 'mainnet' : 'sepolia',
    });
  }
  return sdkInstance;
}

function resetSdk() {
  sdkInstance = null;
}

function buildCartridgePolicies() {
  const policies: Array<{ target: string; method: string }> = [];
  const add = (target: string | undefined, methods: string[]) => {
    if (!target) return;
    for (const method of methods) {
      policies.push({ target: canonicalAddress(target), method });
    }
  };

  add(env.NEXT_PUBLIC_FACTORY_ADDRESS, ['create_collection']);
  add(env.NEXT_PUBLIC_TOKEN_FACTORY_ADDRESS, ['create_memecoin', 'create_and_launch_memecoin', 'launch_on_ekubo']);
  add(env.NEXT_PUBLIC_EKUBO_SWAP_FEE_ROUTER_ADDRESS, ['swap_exact_input']);
  add(env.NEXT_PUBLIC_STRK_ADDRESS, ['approve']);

  return policies;
}

function toBigIntSafe(value: unknown) {
  try {
    return BigInt(String(value ?? '0'));
  } catch {
    return 0n;
  }
}

function fromU256Words(lowLike: unknown, highLike: unknown) {
  const low = toBigIntSafe(lowLike);
  const high = toBigIntSafe(highLike);
  return (high << 128n) + low;
}

function getSafeStrkApproveMaxWei() {
  const configured = (env.NEXT_PUBLIC_SAFE_APPROVE_MAX_STRK || DEFAULT_SAFE_STRK_APPROVE_MAX).trim();
  if (!/^\d+(\.\d+)?$/.test(configured)) {
    return 1_000_000n * 10n ** 18n;
  }
  const [whole, fraction = ''] = configured.split('.');
  const frac = `${fraction}000000000000000000`.slice(0, 18);
  return BigInt(whole) * 10n ** 18n + BigInt(frac);
}

function validateApproveCalls(calls: Call[]) {
  const feeRouter = env.NEXT_PUBLIC_EKUBO_SWAP_FEE_ROUTER_ADDRESS
    ? canonicalAddress(env.NEXT_PUBLIC_EKUBO_SWAP_FEE_ROUTER_ADDRESS)
    : null;
  const ekuboCore = env.NEXT_PUBLIC_EKUBO_CORE_ADDRESS
    ? canonicalAddress(env.NEXT_PUBLIC_EKUBO_CORE_ADDRESS)
    : null;
  const ekuboPositions = env.NEXT_PUBLIC_EKUBO_POSITIONS_ADDRESS
    ? canonicalAddress(env.NEXT_PUBLIC_EKUBO_POSITIONS_ADDRESS)
    : null;
  const factory = env.NEXT_PUBLIC_FACTORY_ADDRESS ? canonicalAddress(env.NEXT_PUBLIC_FACTORY_ADDRESS) : null;
  const tokenFactory = env.NEXT_PUBLIC_TOKEN_FACTORY_ADDRESS ? canonicalAddress(env.NEXT_PUBLIC_TOKEN_FACTORY_ADDRESS) : null;
  const strk = env.NEXT_PUBLIC_STRK_ADDRESS ? canonicalAddress(env.NEXT_PUBLIC_STRK_ADDRESS) : null;
  const safeStrkMaxWei = getSafeStrkApproveMaxWei();

  const batchTargets = new Set(
    calls
      .map((c) => {
        try {
          return canonicalAddress(c.contractAddress);
        } catch {
          return null;
        }
      })
      .filter((v): v is string => Boolean(v)),
  );

  for (const call of calls) {
    if (call.entrypoint !== 'approve') continue;
    const calldata = Array.isArray(call.calldata) ? call.calldata : [];
    if (calldata.length < 3) {
      throw new Error('Invalid approve calldata.');
    }

    let tokenAddress = '';
    let spender = '';
    try {
      tokenAddress = canonicalAddress(call.contractAddress);
      spender = canonicalAddress(String(calldata[0]));
    } catch {
      throw new Error('Invalid approve target/spender.');
    }

    const amount = fromU256Words(calldata[1], calldata[2]);
    if (amount <= 0n) {
      throw new Error('Approve amount must be greater than zero.');
    }

    const spenderAllowed =
      (feeRouter ? sameAddress(spender, feeRouter) : false) ||
      (ekuboCore ? sameAddress(spender, ekuboCore) : false) ||
      (ekuboPositions ? sameAddress(spender, ekuboPositions) : false) ||
      (factory ? sameAddress(spender, factory) : false) ||
      (tokenFactory ? sameAddress(spender, tokenFactory) : false) ||
      Array.from(batchTargets).some((target) => sameAddress(spender, target));

    if (!spenderAllowed) {
      throw new Error(`Unsafe approve blocked: spender ${spender} is not part of allowlisted launchpad flows.`);
    }

    if (strk && tokenAddress === strk && amount > safeStrkMaxWei) {
      const maxHuman = (safeStrkMaxWei / 10n ** 18n).toString();
      throw new Error(`Unsafe approve blocked: STRK approve exceeds safe max (${maxHuman} STRK).`);
    }
  }
}

function getInjectedManager() {
  if (typeof window === 'undefined') {
    return null;
  }

  if (!injectedManager) {
    injectedManager = getStarknet();
  }

  return injectedManager;
}

function getFallbackRpcProvider() {
  if (!fallbackRpcProvider) {
    fallbackRpcProvider = new RpcProvider({
      nodeUrl: CLIENT_RPC_PROXY_PATH,
    });
  }
  return fallbackRpcProvider;
}

function readPersistedSession(): PersistedWalletSession | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(WALLET_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as PersistedWalletSession;
    if (parsed?.kind !== 'injected' && parsed?.kind !== 'cartridge') return null;
    return parsed;
  } catch {
    return null;
  }
}

function persistSession(data: PersistedWalletSession) {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(WALLET_STORAGE_KEY, JSON.stringify(data));
}

function clearPersistedSession() {
  if (typeof window === 'undefined') return;
  window.localStorage.removeItem(WALLET_STORAGE_KEY);
}

export function subscribeWalletSession(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getWalletSessionSnapshot(): WalletSessionSnapshot {
  return currentSnapshot;
}

export function requireWalletSession() {
  if (!currentSession) {
    throw new Error('Please connect a wallet first.');
  }
  return currentSession;
}

async function resolveInjectedAccount(injected: any) {
  const direct = injected?.account ?? injected?.starknet?.account;
  if (direct && typeof direct.execute === 'function') {
    return direct;
  }

  if (typeof injected?.enable === 'function') {
    await injected.enable();
    const afterEnable = injected?.account ?? injected?.starknet?.account;
    if (afterEnable && typeof afterEnable.execute === 'function') {
      return afterEnable;
    }
  }

  return null;
}

export async function connectInjectedWallet(options?: { walletId?: string; silent?: boolean }) {
  const manager = getInjectedManager();
  if (!manager) {
    throw new Error('Browser wallet connection is only available in web runtime.');
  }

  let selectedWallet: any = null;
  let disconnectModalWallet: (() => Promise<void>) | null = null;

  if (!options?.silent) {
    // Prefer official get-starknet modal for wallet logos and native UX.
    try {
      const getStarknetUi = await import('@starknet-io/get-starknet');
      const modalWallet = await getStarknetUi.connect({
        modalMode: 'alwaysAsk',
        modalTheme: 'dark',
      });
      if (modalWallet) {
        // Ensure account is attached for wallets that return a provider object first.
        selectedWallet = await manager.enable(modalWallet as any);
        disconnectModalWallet = async () => {
          await (modalWallet as any).disconnect?.();
          await getStarknetUi.disconnect();
        };
      }
    } catch {
      // Fallback below uses get-starknet-core only.
    }
  }

  if (!selectedWallet) {
    await manager.discoverVirtualWallets();
    const wallets = await manager.getAvailableWallets();
    if (!wallets.length) {
      throw new Error('No Starknet browser wallet detected. Please install Argent X or Braavos.');
    }

    const fallbackWallet = (await manager.getLastConnectedWallet()) ?? wallets[0];
    const wallet = options?.walletId ? wallets.find((item) => item.id === options.walletId) : fallbackWallet;
    if (!wallet) {
      throw new Error('Selected wallet is not available in this browser.');
    }

    selectedWallet = await manager.enable(wallet);
  }

  const injected = selectedWallet as any;
  const account = await resolveInjectedAccount(injected);
  if (!account) {
    throw new Error('Connected wallet does not expose a Starknet account. Try reconnecting and approving account access.');
  }

  currentSession = {
    kind: 'injected',
    address: canonicalAddress(account.address),
    label: injected.name || 'Browser wallet',
    execute: async (calls) => {
      const result = await account.execute(calls);
      const hash = result.transaction_hash ?? result.transactionHash;
      return {
        hash,
        wait: async () => {
          await getFallbackRpcProvider().waitForTransaction(hash);
        },
      };
    },
    callContract: async (call) => {
      return getFallbackRpcProvider().callContract(call);
    },
    disconnect: async () => {
      if (disconnectModalWallet) {
        await disconnectModalWallet();
      } else {
        await injected.disconnect?.();
        await manager.disconnect();
      }
    },
  };
  persistSession({
    kind: 'injected',
    walletId: injected?.id ?? selectedWallet?.id ?? options?.walletId ?? null,
  });
  syncSnapshot();
  emitChange();
  return getWalletSessionSnapshot();
}

export async function connectBrowserWallet() {
  return connectInjectedWallet();
}

export async function connectCartridgeWallet(_options?: { silent?: boolean }) {
  let result: { wallet: WalletInterface } | null = null;
  let lastError: unknown;

  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const sdk = getSdk();
      result = (await sdk.onboard({
        strategy: OnboardStrategy.Cartridge,
        feeMode: 'sponsored',
        deploy: 'if_needed',
        cartridge: {
          policies: buildCartridgePolicies(),
        },
      })) as { wallet: WalletInterface };
      break;
    } catch (error) {
      lastError = error;
      resetSdk();
      await new Promise((resolve) => setTimeout(resolve, 250));
    }
  }

  if (!result?.wallet) {
    const raw = lastError instanceof Error ? lastError.message : String(lastError ?? 'unknown');
    const message = raw.toLowerCase().includes('controller failed to initialize')
      ? 'Cartridge failed to initialize. Allow popups and third-party cookies for localhost, then try again.'
      : `Cartridge connection failed: ${raw}`;
    throw new Error(message);
  }

  const wallet: WalletInterface = result.wallet;

  currentSession = {
    kind: 'cartridge',
    address: canonicalAddress(wallet.address),
    label: 'Cartridge',
    execute: async (calls) => {
      validateApproveCalls(calls);
      const tx = await wallet.execute(calls, { feeMode: 'user_pays' });
      return {
        hash: tx.hash,
        wait: async () => {
          await tx.wait();
        },
      };
    },
    callContract: async (call) => wallet.callContract(call),
    disconnect: async () => {
      await wallet.disconnect();
    },
  };
  persistSession({ kind: 'cartridge' });
  syncSnapshot();
  emitChange();
  return getWalletSessionSnapshot();
}

export async function disconnectCurrentWallet() {
  if (!currentSession) return;
  try {
    await currentSession.disconnect();
  } catch {
    // Some wallet providers can throw while tearing down session state.
    // We still clear local session to guarantee deterministic logout UX.
  } finally {
    currentSession = null;
    clearPersistedSession();
    syncSnapshot();
    emitChange();
  }
}

export async function tryRestoreWalletSession() {
  if (currentSession) {
    return getWalletSessionSnapshot();
  }

  const persisted = readPersistedSession();
  if (!persisted) {
    return getWalletSessionSnapshot();
  }

  try {
    if (persisted.kind === 'injected') {
      return await connectInjectedWallet({ walletId: persisted.walletId ?? undefined, silent: true });
    }
    // Cartridge session re-onboarding on every refresh reopens authorization UI.
    // Keep restoration manual until we wire a true silent Controller session restore.
    return getWalletSessionSnapshot();
  } catch {
    clearPersistedSession();
    return getWalletSessionSnapshot();
  }
}
