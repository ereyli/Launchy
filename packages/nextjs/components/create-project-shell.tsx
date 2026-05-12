'use client';

import { useState, useSyncExternalStore } from 'react';
import { CreateForm } from '~~/components/create-form';
import { TokenCreateForm } from '~~/components/token-create-form';
import { getWalletSessionSnapshot, subscribeWalletSession } from '~~/lib/starknet/wallet-session';

type Props = {
  deployFeeStrk: string;
  mintFeeStrk: string;
  nftFactoryConfigured: boolean;
  tokenFactoryConfigured: boolean;
  initialType: 'token' | 'nft';
};

export function CreateProjectShell(props: Props) {
  const [mode, setMode] = useState<'token' | 'nft'>(props.initialType);
  const session = useSyncExternalStore(subscribeWalletSession, getWalletSessionSnapshot, getWalletSessionSnapshot);
  const title = mode === 'token' ? 'Create Token Project' : 'Create NFT Collection';
  const description = mode === 'token'
    ? 'Enter token metadata, launch economics, and deploy to Starknet.'
    : 'Configure collection supply, mint model, media, and deploy to Starknet.';

  return (
    <section className="figma-panel create-project-shell">
      <div className="create-mode-switch" role="tablist" aria-label="Create mode">
        <button
          type="button"
          className={mode === 'token' ? 'create-mode-switch-active' : ''}
          onClick={() => setMode('token')}
          role="tab"
          aria-selected={mode === 'token'}
        >
          Token
        </button>
        <button
          type="button"
          className={mode === 'nft' ? 'create-mode-switch-active' : ''}
          onClick={() => setMode('nft')}
          role="tab"
          aria-selected={mode === 'nft'}
        >
          NFT Collection
        </button>
      </div>

      <div className="figma-create-head">
        <h2>{title}</h2>
        <p>{description}</p>
      </div>

      {!session.connected && (
        <div className="wallet-required-banner" role="alert">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M20 7H4a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2z"/>
            <circle cx="17" cy="13" r="1" fill="currentColor"/>
          </svg>
          <div className="wallet-required-text">
            <strong>Wallet not connected</strong>
            <span>Connect your wallet before filling the form — deployment requires a signer.</span>
          </div>
        </div>
      )}

      {mode === 'token' ? (
        props.tokenFactoryConfigured ? (
          <div className="figma-create-form-shell">
            <TokenCreateForm />
          </div>
        ) : (
          <section className="figma-empty">
            <h3 className="card-title">Token factory address missing</h3>
            <p className="muted">
              Set <code>NEXT_PUBLIC_TOKEN_FACTORY_ADDRESS</code> in <code>.env.local</code> to enable token deployment.
            </p>
          </section>
        )
      ) : props.nftFactoryConfigured ? (
        <div className="figma-create-form-shell">
          <CreateForm deployFeeStrk={props.deployFeeStrk} mintFeeStrk={props.mintFeeStrk} />
        </div>
      ) : (
        <section className="figma-empty">
          <h3 className="card-title">NFT factory address missing</h3>
          <p className="muted">
            Set <code>NEXT_PUBLIC_FACTORY_ADDRESS</code> in <code>.env.local</code> to enable NFT collection deployment.
          </p>
        </section>
      )}
    </section>
  );
}
