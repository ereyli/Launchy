'use client';

import Image from 'next/image';
import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import {
  connectCartridgeWallet,
  connectInjectedWallet,
  disconnectCurrentWallet,
  getWalletSessionSnapshot,
  subscribeWalletSession,
  tryRestoreWalletSession,
} from '~~/lib/starknet/wallet-session';
import { shortAddress } from '~~/lib/starknet/address';

export function WalletConnect({ compact = false }: { compact?: boolean }) {
  const session = useSyncExternalStore(
    subscribeWalletSession,
    getWalletSessionSnapshot,
    getWalletSessionSnapshot,
  );
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const [restoring, setRestoring] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const didTryRestore = useRef(false);

  useEffect(() => {
    if (didTryRestore.current) return;
    didTryRestore.current = true;

    let cancelled = false;
    (async () => {
      try {
        await tryRestoreWalletSession();
      } finally {
        if (!cancelled) {
          setRestoring(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const addressLabel = useMemo(() => {
    if (!session.address) return 'Not connected';
    return `${session.label} • ${shortAddress(session.address)}`;
  }, [session.address, session.label]);
  const isBusy = busy || restoring;

  async function connectInjected() {
    setBusy(true);
    setError(null);
    try {
      await connectInjectedWallet();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to connect browser wallet.');
    } finally {
      setBusy(false);
    }
  }

  async function connectCartridge() {
    setBusy(true);
    setError(null);
    try {
      await connectCartridgeWallet();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to connect wallet.');
    } finally {
      setBusy(false);
    }
  }

  async function disconnect() {
    setBusy(true);
    setError(null);
    try {
      await disconnectCurrentWallet();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to disconnect wallet.');
    } finally {
      setBusy(false);
    }
  }

  async function copyWalletAddress() {
    if (!session.address || typeof navigator === 'undefined' || !navigator.clipboard) return;
    await navigator.clipboard.writeText(session.address);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1200);
  }

  return (
    <div className="wallet-box">
      {compact ? (
        <>
          {!session.connected ? (
            <div className="wallet-actions">
              <button type="button" className="wallet-provider wallet-provider-injected wallet-connect-cta" onClick={connectInjected} disabled={isBusy}>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 7H4a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2z"/><circle cx="17" cy="13" r="1" fill="currentColor"/></svg>
                {isBusy ? 'Connecting...' : 'Connect Wallet'}
              </button>
              <button type="button" className="wallet-provider wallet-provider-cartridge" onClick={connectCartridge} disabled={isBusy}>
                <Image src="/cartridge-logo.svg" alt="" width={16} height={16} className="wallet-provider-logo" />
                {isBusy ? 'Connecting...' : 'Cartridge'}
              </button>
            </div>
          ) : (
            <div className="wallet-actions">
              <span className={`wallet-state wallet-state-inline ${session.kind === 'cartridge' ? 'wallet-state-cartridge' : ''}`}>
                {session.kind === 'cartridge' ? (
                  <Image src="/cartridge-logo.svg" alt="" width={16} height={16} className="wallet-provider-logo" />
                ) : (
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{opacity:0.7}}><path d="M20 7H4a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2z"/><circle cx="17" cy="13" r="1" fill="currentColor"/></svg>
                )}
                {addressLabel}
              </span>
              {session.kind === 'cartridge' ? (
                <button type="button" className="copy-icon-btn" onClick={copyWalletAddress} disabled={isBusy} aria-label={copied ? 'Copied' : 'Copy address'} title={copied ? 'Copied!' : 'Copy address'}>
                  {copied ? (
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
                  ) : (
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2" /><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" /></svg>
                  )}
                </button>
              ) : null}
              <button type="button" className="ghost-button wallet-provider" onClick={disconnect} disabled={isBusy}>
                {isBusy ? 'Disconnecting...' : 'Disconnect'}
              </button>
            </div>
          )}
        </>
      ) : (
        <>
          <span className="wallet-state">{addressLabel}</span>
          {!session.connected ? (
            <div className="wallet-actions">
              <button type="button" className="wallet-provider wallet-provider-injected wallet-connect-cta" onClick={connectInjected} disabled={isBusy}>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 7H4a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2z"/><circle cx="17" cy="13" r="1" fill="currentColor"/></svg>
                {isBusy ? 'Connecting...' : 'Connect Wallet'}
              </button>
              <button type="button" className="wallet-provider wallet-provider-cartridge" onClick={connectCartridge} disabled={isBusy}>
                <Image src="/cartridge-logo.svg" alt="" width={16} height={16} className="wallet-provider-logo" />
                {isBusy ? 'Connecting...' : 'Cartridge'}
              </button>
            </div>
          ) : (
            <div className="wallet-actions">
              <span className={`wallet-state wallet-state-inline ${session.kind === 'cartridge' ? 'wallet-state-cartridge' : ''}`}>
                {session.kind === 'cartridge' ? (
                  <Image src="/cartridge-logo.svg" alt="" width={16} height={16} className="wallet-provider-logo" />
                ) : null}
                {addressLabel}
              </span>
              {session.kind === 'cartridge' ? (
                <button type="button" className="copy-icon-btn" onClick={copyWalletAddress} disabled={isBusy} aria-label={copied ? 'Copied' : 'Copy address'} title={copied ? 'Copied!' : 'Copy address'}>
                  {copied ? (
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
                  ) : (
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2" /><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" /></svg>
                  )}
                </button>
              ) : null}
              <button type="button" className="ghost-button wallet-provider" onClick={disconnect} disabled={isBusy}>
                {isBusy ? 'Disconnecting...' : 'Disconnect'}
              </button>
            </div>
          )}
          <small className="muted wallet-hint">Standard wallet flow active.</small>
        </>
      )}
      {error ? <small className="wallet-error">{error}</small> : null}
    </div>
  );
}
