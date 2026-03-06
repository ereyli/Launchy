'use client';

import { useMemo, useState, useSyncExternalStore } from 'react';
import { formatDecimalDots } from '~~/lib/format';
import { sameAddress } from '~~/lib/starknet/address';
import { getWalletSessionSnapshot, subscribeWalletSession } from '~~/lib/starknet/wallet-session';
import { withdrawCreatorFees } from '~~/lib/token-launchpad/client';

type ClaimableToken = {
  address: string;
  owner: string;
  name: string;
  symbol: string;
  isLaunched: boolean;
  quoteAmountFormatted?: string;
};

export function ProfileTokenClaims({ tokens }: { tokens: ClaimableToken[] }) {
  const session = useSyncExternalStore(
    subscribeWalletSession,
    getWalletSessionSnapshot,
    getWalletSessionSnapshot,
  );
  const [statusByToken, setStatusByToken] = useState<Record<string, string>>({});

  const ownedTokens = useMemo(() => {
    if (!session.address) return [];
    return tokens.filter((token) => sameAddress(token.owner, session.address!));
  }, [tokens, session.address]);

  async function onClaim(tokenAddress: string) {
    setStatusByToken((prev) => ({ ...prev, [tokenAddress]: 'Submitting claim transaction...' }));
    try {
      const result = await withdrawCreatorFees(tokenAddress, session.address || '');
      setStatusByToken((prev) => ({ ...prev, [tokenAddress]: `Claim sent: ${result.txHash}` }));
    } catch (error) {
      setStatusByToken((prev) => ({
        ...prev,
        [tokenAddress]: error instanceof Error ? error.message : 'Claim failed',
      }));
    }
  }

  if (!session.connected) {
    return (
      <section className="figma-panel">
        <h2>LP Fee Claims</h2>
        <p className="muted">Connect your wallet to view owner tokens and claim LP fees.</p>
      </section>
    );
  }

  if (ownedTokens.length === 0) {
    return (
      <section className="figma-panel">
        <h2>LP Fee Claims</h2>
        <p className="muted">No owner token found for connected wallet.</p>
      </section>
    );
  }

  return (
    <section className="figma-panel">
      <h2>LP Fee Claims</h2>
      <div className="figma-grid-3">
        {ownedTokens.map((token) => (
          <article key={token.address} className="figma-card">
            <div className="figma-token-head">
              <div>
                <h3>{token.name}</h3>
                <p>{token.symbol}</p>
              </div>
              <span className={`figma-status ${token.isLaunched ? 'figma-status-live' : ''}`}>
                {token.isLaunched ? 'Listed' : 'Deployed'}
              </span>
            </div>
            <div className="figma-token-meta">
              <span>LP Revenue (est.)</span>
              <b>{token.quoteAmountFormatted ? `${formatDecimalDots(token.quoteAmountFormatted)} STRK` : '-'}</b>
            </div>
            <button
              type="button"
              className="figma-claim-btn"
              disabled={!token.isLaunched}
              onClick={() => onClaim(token.address)}
            >
              {token.isLaunched ? 'Claim LP Fees' : 'Not launched'}
            </button>
            {statusByToken[token.address] ? <small className="muted">{statusByToken[token.address]}</small> : null}
          </article>
        ))}
      </div>
    </section>
  );
}
