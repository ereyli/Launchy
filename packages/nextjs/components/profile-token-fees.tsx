'use client';

import { useMemo, useState, useSyncExternalStore } from 'react';
import { CopyButton } from '~~/components/copy-button';
import { formatDecimalDots, formatIntegerDots } from '~~/lib/format';
import { checksumAddress, sameAddress, shortAddress } from '~~/lib/starknet/address';
import { withdrawCreatorFees } from '~~/lib/token-launchpad/client';
import { getWalletSessionSnapshot, subscribeWalletSession } from '~~/lib/starknet/wallet-session';

type ProfileToken = {
  address: string;
  owner: string;
  name: string;
  symbol: string;
  isLaunched: boolean;
  logoImageUrl?: string;
  quoteAmountFormatted?: string;
};

export function ProfileTokenFees({ tokens }: { tokens: ProfileToken[] }) {
  const session = useSyncExternalStore(
    subscribeWalletSession,
    getWalletSessionSnapshot,
    getWalletSessionSnapshot,
  );
  const [statusByToken, setStatusByToken] = useState<Record<string, string>>({});

  const ownedTokens = useMemo(() => {
    if (!session.address) return [];
    return tokens.filter((item) => sameAddress(item.owner, session.address!));
  }, [tokens, session.address]);

  async function onClaim(tokenAddress: string) {
    if (!session.address) return;
    setStatusByToken((prev) => ({ ...prev, [tokenAddress]: 'Submitting claim transaction...' }));
    try {
      const result = await withdrawCreatorFees(tokenAddress, session.address);
      setStatusByToken((prev) => ({ ...prev, [tokenAddress]: `Claim sent: ${result.txHash}` }));
    } catch (error) {
      setStatusByToken((prev) => ({
        ...prev,
        [tokenAddress]: error instanceof Error ? error.message : 'Claim failed',
      }));
    }
  }

  return (
    <section className="panel browser-panel profile-dashboard">
      <div className="section-head">
        <h2>Portfolio dashboard</h2>
        <span className="muted">{session.connected ? 'Wallet connected' : 'Connect wallet to view your portfolio'}</span>
      </div>

      {session.connected ? (
        <div className="profile-stats-grid">
          <article className="stat">
            <span className="muted">Wallet</span>
            <strong>{shortAddress(session.address || '')}</strong>
            <CopyButton value={checksumAddress(session.address || '')} />
          </article>
          <article className="stat">
            <span className="muted">My tokens</span>
            <strong>{formatIntegerDots(ownedTokens.length)}</strong>
          </article>
          <article className="stat">
            <span className="muted">Listed tokens</span>
            <strong>{formatIntegerDots(ownedTokens.filter((item) => item.isLaunched).length)}</strong>
          </article>
        </div>
      ) : null}

      {!session.connected ? (
        <p className="muted">Connect your wallet from the header, then open Profile to claim creator rewards.</p>
      ) : ownedTokens.length === 0 ? (
        <p className="muted">No deployed token found for this wallet.</p>
      ) : (
        <div className="token-market-grid">
          {ownedTokens.map((token) => (
            <article key={token.address} className="token-market-card profile-token-card">
              <div className="token-market-cover">
                {token.logoImageUrl ? (
                  <img src={token.logoImageUrl} alt={`${token.name} logo`} />
                ) : (
                  <span>{token.symbol.slice(0, 3).toUpperCase()}</span>
                )}
              </div>
              <div className="token-market-main">
                <div className="token-market-head">
                  <h3>{token.name}</h3>
                  <span>{token.symbol}</span>
                </div>
                <div className="token-market-sub">
                  <span>{token.isLaunched ? 'Listed' : 'Deployed'}</span>
                </div>
                <div className="token-market-sub token-market-copy-row">
                  <span className="mono">{shortAddress(token.address)}</span>
                  <CopyButton value={checksumAddress(token.address)} />
                </div>
                <div className="token-market-metrics">
                  <span>Initial buy <b>{token.quoteAmountFormatted ? `${formatDecimalDots(token.quoteAmountFormatted)} STRK` : '-'}</b></span>
                </div>
                {statusByToken[token.address] ? <small className="muted">{statusByToken[token.address]}</small> : null}
              </div>
              <div className="token-market-actions">
                <button
                  type="button"
                  onClick={() => onClaim(token.address)}
                  disabled={!token.isLaunched}
                >
                  {token.isLaunched ? 'Claim Creator Fees' : 'Not launched'}
                </button>
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
