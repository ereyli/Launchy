'use client';

import { useEffect, useState } from 'react';
import { CreateProjectShell } from '~~/components/create-project-shell';
import { LoadingState } from '~~/components/page-clients/loading-state';

type Props = {
  initialType: 'token' | 'nft';
};

type CreatePayload = {
  deployFeeStrk: string;
  mintFeeStrk: string;
  nftFactoryConfigured: boolean;
  tokenFactoryConfigured: boolean;
};

export function CreatePageClient({ initialType }: Props) {
  const [data, setData] = useState<CreatePayload | null>(null);

  useEffect(() => {
    let active = true;
    fetch('/api/ui/create')
      .then((res) => res.json())
      .then((payload: CreatePayload) => {
        if (active) setData(payload);
      })
      .catch(() => {
        if (active) {
          setData({ deployFeeStrk: '0', mintFeeStrk: '0', nftFactoryConfigured: true, tokenFactoryConfigured: true });
        }
      });
    return () => {
      active = false;
    };
  }, []);

  return (
    <main className="grid">
      <section className="figma-page-hero">
        <h1>Create New Project</h1>
        <p>Launch your {initialType === 'token' ? 'token' : 'NFT collection'} on Starknet.</p>
      </section>
      {data ? (
        <CreateProjectShell
          initialType={initialType}
          deployFeeStrk={data.deployFeeStrk}
          mintFeeStrk={data.mintFeeStrk}
          nftFactoryConfigured={data.nftFactoryConfigured}
          tokenFactoryConfigured={data.tokenFactoryConfigured}
        />
      ) : (
        <section className="figma-panel"><LoadingState title="Loading create flow" description="Preparing deployment settings." /></section>
      )}
    </main>
  );
}
