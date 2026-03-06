'use client';

import { useState } from 'react';
import { sameAddress } from '~~/lib/starknet/address';
import { requireWalletSession } from '~~/lib/starknet/wallet-session';
import { withdrawCreatorFees } from '~~/lib/token-launchpad/client';

type Props = {
  tokenAddress: string;
  ownerAddress: string;
};

export function TokenOwnerFees({ tokenAddress, ownerAddress }: Props) {
  const [status, setStatus] = useState('');
  const [txHash, setTxHash] = useState('');

  async function onWithdraw() {
    setStatus('');
    setTxHash('');
    try {
      const session = requireWalletSession();
      if (!sameAddress(session.address, ownerAddress)) {
        throw new Error('Only token owner can withdraw launch fees.');
      }
      setStatus('Submitting fee withdrawal...');
      const res = await withdrawCreatorFees(tokenAddress, session.address);
      setTxHash(res.txHash);
      setStatus('');
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Unknown error');
    }
  }

  return (
    <section className="panel">
      <h3 className="card-title">Creator fees</h3>
      <p className="muted">Withdraw accumulated STRK fees from your Ekubo launch position.</p>
      <div className="hero-actions">
        <button type="button" onClick={onWithdraw}>Withdraw fees</button>
      </div>
      {status ? <small className="muted">{status}</small> : null}
      {txHash ? (
        <a href={`https://voyager.online/tx/${txHash}`} target="_blank" rel="noreferrer">
          <button type="button" className="ghost-button">View withdraw tx</button>
        </a>
      ) : null}
    </section>
  );
}
