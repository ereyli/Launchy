'use client';

import { useEffect, useState } from 'react';
import { NftLaunchpadView } from '~~/components/figma/nft-launchpad-view';
import { LoadingState } from '~~/components/page-clients/loading-state';
import type { LaunchCollection } from '~~/lib/launchpad/collections';

export function CollectionsPageClient() {
  const [items, setItems] = useState<LaunchCollection[] | null>(null);

  useEffect(() => {
    let active = true;
    fetch('/api/ui/collections')
      .then((res) => res.json())
      .then((payload) => {
        if (active) setItems(payload.collections ?? []);
      })
      .catch(() => {
        if (active) setItems([]);
      });
    return () => {
      active = false;
    };
  }, []);

  return (
    <main className="figma-nft-page">
      <section className="figma-nft-page-header">
        <h1>NFT Launchpad</h1>
        <p>Discover and mint NFT collections on Starknet</p>
      </section>
      {items ? <NftLaunchpadView items={items} /> : <section className="figma-panel"><LoadingState title="Loading collections" description="Preparing launchpad data." /></section>}
    </main>
  );
}
