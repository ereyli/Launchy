'use client';

import { useEffect, useState } from 'react';
import { NftLaunchpadView } from '~~/components/figma/nft-launchpad-view';
import { LoadingState } from '~~/components/page-clients/loading-state';
import type { LaunchCollection } from '~~/lib/launchpad/collections';

export function CollectionsPageClient({ initialItems }: { initialItems: LaunchCollection[] }) {
  const [items, setItems] = useState<LaunchCollection[]>(initialItems);
  const [hasFetched, setHasFetched] = useState(false);

  useEffect(() => {
    let active = true;
    fetch('/api/ui/collections')
      .then((res) => res.json())
      .then((payload) => {
        if (active && Array.isArray(payload.collections)) setItems(payload.collections);
      })
      .catch(() => {
        // keep initial items
      })
      .finally(() => {
        if (active) setHasFetched(true);
      });
    return () => {
      active = false;
    };
  }, []);

  const showLoading = !hasFetched && items.length === 0;

  return (
    <main className="figma-nft-page">
      <section className="figma-nft-page-header">
        <h1>NFT Launchpad</h1>
        <p>Discover and mint NFT collections on Starknet</p>
      </section>
      {showLoading ? (
        <section className="figma-panel"><LoadingState title="Loading collections" description="Preparing launchpad data." /></section>
      ) : (
        <NftLaunchpadView items={items} />
      )}
    </main>
  );
}
