import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';
import type { Call } from 'starknet';
import type { WalletInterface } from 'starkzap';
import { connectCartridgeWallet, connectPrivyWallet, disconnectWallet } from '~/lib/starkzap';

type WalletState = {
  wallet: WalletInterface | null;
  address: string | null;
  label: string;
  loading: boolean;
  error: string | null;
  connectCartridge: () => Promise<void>;
  connectPrivy: () => Promise<void>;
  disconnect: () => Promise<void>;
  execute: (calls: Call[]) => Promise<{ hash: string }>;
};

const WalletContext = createContext<WalletState | null>(null);

function shortAddress(address: string | null) {
  if (!address) return 'Not connected';
  return `${address.slice(0, 8)}...${address.slice(-6)}`;
}

export function WalletProvider({ children }: { children: React.ReactNode }) {
  const [wallet, setWallet] = useState<WalletInterface | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const connectCartridgeHandler = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const nextWallet = await connectCartridgeWallet();
      setWallet(nextWallet);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Cartridge connect failed');
    } finally {
      setLoading(false);
    }
  }, []);

  const connectPrivyHandler = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const nextWallet = await connectPrivyWallet();
      setWallet(nextWallet);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Privy connect failed');
    } finally {
      setLoading(false);
    }
  }, []);

  const disconnectHandler = useCallback(async () => {
    if (!wallet) return;
    setLoading(true);
    setError(null);
    try {
      await disconnectWallet(wallet);
      setWallet(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Disconnect failed');
    } finally {
      setLoading(false);
    }
  }, [wallet]);

  const execute = useCallback(
    async (calls: Call[]) => {
      if (!wallet) {
        throw new Error('Connect wallet first.');
      }
      const tx = await wallet.execute(calls, { feeMode: 'sponsored' });
      return { hash: tx.hash };
    },
    [wallet],
  );

  const value = useMemo<WalletState>(
    () => ({
      wallet,
      address: wallet?.address ?? null,
      label: shortAddress(wallet?.address ?? null),
      loading,
      error,
      connectCartridge: connectCartridgeHandler,
      connectPrivy: connectPrivyHandler,
      disconnect: disconnectHandler,
      execute,
    }),
    [wallet, loading, error, connectCartridgeHandler, connectPrivyHandler, disconnectHandler, execute],
  );

  return <WalletContext.Provider value={value}>{children}</WalletContext.Provider>;
}

export function useWallet() {
  const context = useContext(WalletContext);
  if (!context) {
    throw new Error('useWallet must be used within WalletProvider');
  }
  return context;
}
