'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { TokenLaunchpadView } from '~~/components/figma/token-launchpad-view';
import { LoadingState } from '~~/components/page-clients/loading-state';

export type TokenLaunchpadItem = {
  address: string;
  name: string;
  symbol: string;
  logoImageUrl?: string;
  totalSupplyFormatted: string;
  isLaunched: boolean;
  marketCapUsd: number;
  change24hPct: number;
};

export function TokensPageClient() {
  const [items, setItems] = useState<TokenLaunchpadItem[] | null>(null);

  useEffect(() => {
    let active = true;
    fetch('/api/ui/tokens')
      .then((res) => res.json())
      .then((payload) => {
        if (active) setItems(payload.items ?? []);
      })
      .catch(() => {
        if (active) setItems([]);
      });
    return () => {
      active = false;
    };
  }, []);

  return (
    <main className="grid">
      <section className="figma-page-hero">
        <h1>Token Launchpad</h1>
        <p>Discover and trade tokens on Starknet.</p>
        <Link href="/create?type=token"><button>Create Token</button></Link>
      </section>
      {items ? <TokenLaunchpadView items={items} /> : <section className="figma-panel"><LoadingState title="Loading tokens" description="Preparing market data." /></section>}
    </main>
  );
}
