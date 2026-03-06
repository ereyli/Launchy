'use client';

import { useState } from 'react';
import { CreateForm } from '~~/components/create-form';
import { TokenCreateForm } from '~~/components/token-create-form';

type Props = {
  deployFeeStrk: string;
  mintFeeStrk: string;
  nftFactoryConfigured: boolean;
  tokenFactoryConfigured: boolean;
  initialType: 'token' | 'nft';
};

export function CreateProjectShell(props: Props) {
  const [mode, setMode] = useState<'token' | 'nft'>(props.initialType);
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
