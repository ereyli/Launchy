'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { formatDecimalDots, formatIntegerDots } from '~~/lib/format';
import { LoadingState } from '~~/components/page-clients/loading-state';
import type { HomePayload } from '~~/lib/server/ui-data';

function hueFromAddress(address: string) {
  let hash = 0;
  for (let i = 2; i < address.length; i += 1) hash = (hash * 31 + address.charCodeAt(i)) % 360;
  return hash;
}

export function HomePageClient({ initialData }: { initialData: HomePayload }) {
  const [data, setData] = useState<HomePayload>(initialData);
  const [hasFetched, setHasFetched] = useState(false);

  useEffect(() => {
    let active = true;
    fetch('/api/ui/home')
      .then((res) => res.json())
      .then((payload: HomePayload) => {
        if (active) setData(payload);
      })
      .catch(() => {
        // keep last known data on error
      })
      .finally(() => {
        if (active) setHasFetched(true);
      });
    return () => {
      active = false;
    };
  }, []);

  const tokens = data.tokens;
  const collections = data.collections;
  const topTokens = tokens.slice(0, 3);
  const topNfts = collections.slice(0, 3);
  const totalMinted = useMemo(() => collections.reduce((acc, c) => acc + c.minted, 0), [collections]);
  const listed = useMemo(() => tokens.filter((t) => t.isLaunched).length, [tokens]);
  const isLoading = !hasFetched && tokens.length === 0 && collections.length === 0;

  return (
    <main className="figma-home">
      <section className="figma-home-hero">
        <span className="badge">Powered by Starknet</span>
        <h1>Launch your NFT or token on Starknet</h1>
        <p>
          Deploy memecoins and NFT collections from one place. Trade and mint with a
          mobile-ready creator experience.
        </p>
        <div className="figma-home-hero-actions">
          <Link href="/create?type=token"><button>Launch Token</button></Link>
          <Link href="/create?type=nft"><button className="ghost-button">Create NFT Collection</button></Link>
        </div>
      </section>

      <section className="figma-home-stats">
        <article><strong>{formatIntegerDots(tokens.length)}</strong><span>Deployed Tokens</span></article>
        <article><strong>{formatIntegerDots(listed)}</strong><span>Listed Tokens</span></article>
        <article><strong>{formatIntegerDots(collections.length)}</strong><span>Collections</span></article>
        <article><strong>{formatIntegerDots(totalMinted)}</strong><span>Minted NFTs</span></article>
      </section>

      <section className="figma-home-block">
        <div className="figma-home-head">
          <div><h2>Featured Tokens</h2><p className="muted">Trending on Launchy</p></div>
          <Link href="/token-launchpad" className="home-section-more">View All →</Link>
        </div>
        <div className="figma-home-cards">
          {isLoading ? <LoadingState title="Loading tokens" description="Fetching latest market data." /> : topTokens.length === 0 ? <div className="figma-empty"><h3>No tokens yet</h3><p>Token cards will appear here after they are indexed into storage.</p></div> : topTokens.map((token) => {
            const hue = hueFromAddress(token.address);
            const mcDisplay = token.marketCapUsd > 0 ? `$${formatDecimalDots(String(token.marketCapUsd), 0)}` : '-';
            const changeValue = Number(token.change24hPct || 0);
            const isPositive = changeValue >= 0;
            return (
              <Link key={token.address} href={`/token/${token.address}?side=buy`} className="figma-token-card">
                <div className="figma-token-card-header">
                  <div className="figma-token-card-identity">
                    <div className="figma-token-card-avatar" style={{ background: token.logoImageUrl ? 'var(--bg-surface)' : `linear-gradient(135deg, hsl(${hue} 40% 22%) 0%, hsl(${(hue + 60) % 360} 35% 18%) 100%)` }}>
                      {token.logoImageUrl ? <img src={token.logoImageUrl} alt={token.name} /> : <span>{token.symbol.slice(0, 2).toUpperCase()}</span>}
                    </div>
                    <div><h3>{token.name}</h3><p>{token.symbol}</p></div>
                  </div>
                  <span className={`figma-token-card-badge ${token.isLaunched ? 'figma-token-card-badge--live' : ''}`}>{token.isLaunched ? 'Listed' : 'Deployed'}</span>
                </div>
                <div className="figma-token-card-stats">
                  <div className="figma-token-card-row"><span>Supply</span><b>{formatDecimalDots(token.totalSupplyFormatted, 0)}</b></div>
                  <div className="figma-token-card-row"><span>Market Cap</span><b>{mcDisplay}</b></div>
                </div>
                <div className="figma-token-card-change">
                  <span>24h Change</span>
                  <span className={`figma-token-card-change-value ${isPositive ? '' : 'figma-token-card-change-value--negative'}`}>
                    {isPositive ? '+' : ''}{formatDecimalDots(String(changeValue), 1)}%
                  </span>
                </div>
              </Link>
            );
          })}
        </div>
      </section>

      <section className="figma-home-block">
        <div className="figma-home-head">
          <div><h2>Featured NFT Collections</h2><p className="muted">Popular collections on Launchy</p></div>
          <Link href="/nft-launchpad" className="home-section-more">View All →</Link>
        </div>
        <div className="figma-home-cards">
          {isLoading ? <LoadingState title="Loading collections" description="Fetching latest mint data." /> : topNfts.length === 0 ? <div className="figma-empty"><h3>No collections yet</h3><p>NFT cards will appear here after they are indexed into storage.</p></div> : topNfts.map((collection) => {
            const hue = hueFromAddress(collection.address);
            return (
              <Link key={collection.address} href={`/collection/${collection.address}`} className="figma-nft-card-v2">
                <div className="figma-nft-card-v2-media">
                  {collection.imageUrl ? <img src={collection.imageUrl} alt={collection.name} /> : <div className="figma-nft-card-v2-placeholder" style={{ background: `linear-gradient(135deg, hsl(${hue} 40% 18%) 0%, hsl(${(hue + 50) % 360} 35% 14%) 100%)` }}><span>{collection.symbol?.slice(0, 2).toUpperCase() || collection.name.slice(0, 2).toUpperCase()}</span></div>}
                </div>
                <div className="figma-nft-card-v2-body">
                  <h3>{collection.name}</h3>
                  <div className="figma-nft-card-v2-progress-section">
                    <div className="figma-nft-card-v2-progress-head"><span>Minted</span><span>{formatIntegerDots(collection.minted)} / {formatIntegerDots(collection.maxSupply)}</span></div>
                    <div className="figma-nft-card-v2-progress-bar"><div className="figma-nft-card-v2-progress-fill" style={{ width: `${collection.maxSupply > 0 ? ((collection.minted / collection.maxSupply) * 100).toFixed(0) : 0}%` }} /></div>
                  </div>
                  <div className="figma-nft-card-v2-price"><span>Mint Price</span><b>{Number(collection.mintPriceStrk) > 0 ? `${formatDecimalDots(collection.mintPriceStrk)} STRK` : 'Free'}</b></div>
                </div>
              </Link>
            );
          })}
        </div>
      </section>

      <section className="figma-home-steps">
        <h2>How It Works</h2>
        <div className="figma-home-steps-grid">
          <article><strong>1</strong><h3>Create</h3><p>Fill launch form and upload metadata.</p></article>
          <article><strong>2</strong><h3>Deploy</h3><p>Deploy directly to Starknet contracts.</p></article>
          <article><strong>3</strong><h3>Grow</h3><p>Mint, trade and claim creator fees.</p></article>
        </div>
      </section>

      <section className="figma-home-trust">
        <h2>Built on Starknet</h2>
        <p>Gas-optimized deploy flow, wallet-native UX, and integrated market modules for creators.</p>
        <div className="figma-home-trust-badges"><span className="badge">Secure Contracts</span><span className="badge">Gasless Minting</span><span className="badge">Ekubo Integration</span></div>
      </section>
    </main>
  );
}
