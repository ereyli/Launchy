'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { TokenLaunchpadView } from '~~/components/figma/token-launchpad-view';
import { TokenGridSkeleton } from '~~/components/page-clients/skeleton';
import type { HomeTokenItem } from '~~/lib/server/ui-data';

export type TokenLaunchpadItem = HomeTokenItem;

export function TokensPageClient({ initialItems }: { initialItems: TokenLaunchpadItem[] }) {
  const [items, setItems] = useState<TokenLaunchpadItem[]>(initialItems);
  const [hasFetched, setHasFetched] = useState(false);

  useEffect(() => {
    let active = true;
    fetch('/api/ui/tokens')
      .then((res) => res.json())
      .then((payload) => {
        if (active && Array.isArray(payload.items)) setItems(payload.items);
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
    <main className="grid">
      <section className="figma-page-hero">
        <h1>Token Launchpad</h1>
        <p>Discover and trade tokens on Starknet.</p>
        <Link href="/create?type=token"><button>Create Token</button></Link>
      </section>
      {showLoading ? <TokenGridSkeleton count={9} /> : <TokenLaunchpadView items={items} />}
    </main>
  );
}
