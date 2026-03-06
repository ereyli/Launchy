'use client';

import Link from 'next/link';
import { useCallback, useMemo, useState } from 'react';
import { formatDecimalDots, formatIntegerDots } from '~~/lib/format';
import type { LaunchCollection } from '~~/lib/launchpad/collections';

type PriceFilter = 'all' | 'free' | 'paid';
type SortMode = 'trending' | 'newest' | 'popular';

function hueFromAddress(address: string) {
  let hash = 0;
  for (let i = 2; i < address.length; i += 1) hash = (hash * 31 + address.charCodeAt(i)) % 360;
  return hash;
}

export function NftLaunchpadView({ items }: { items: LaunchCollection[] }) {
  const [searchQuery, setSearchQuery] = useState('');
  const [priceFilter, setPriceFilter] = useState<PriceFilter>('all');
  const [sortBy, setSortBy] = useState<SortMode>('trending');

  // Carousel state for spotlight
  const [spotlightIdx, setSpotlightIdx] = useState(0);

  const spotlightItems = useMemo(() => {
    if (!items.length) return [];
    return [...items].sort((a, b) => b.progressPct - a.progressPct);
  }, [items]);

  const current = spotlightItems[spotlightIdx] || null;

  const goPrev = useCallback(() => {
    setSpotlightIdx((i) => (i <= 0 ? spotlightItems.length - 1 : i - 1));
  }, [spotlightItems.length]);

  const goNext = useCallback(() => {
    setSpotlightIdx((i) => (i >= spotlightItems.length - 1 ? 0 : i + 1));
  }, [spotlightItems.length]);

  const filtered = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    let data = items.filter((collection) => {
      const matchQuery =
        !q ||
        collection.name.toLowerCase().includes(q) ||
        collection.symbol.toLowerCase().includes(q) ||
        collection.address.toLowerCase().includes(q);
      const matchPrice =
        priceFilter === 'all' ||
        (priceFilter === 'free' && collection.model === 'free') ||
        (priceFilter === 'paid' && collection.model === 'paid');
      return matchQuery && matchPrice;
    });
    data = [...data].sort((a, b) => {
      if (sortBy === 'newest') return b.index - a.index;
      if (sortBy === 'popular') return b.minted - a.minted;
      return b.progressPct - a.progressPct;
    });
    return data;
  }, [items, searchQuery, priceFilter, sortBy]);

  return (
    <>
      {/* ── Spotlight Carousel ── */}
      {current ? (
        <section className="figma-spotlight-v2">
          <div className="figma-spotlight-v2-media">
            {current.imageUrl ? (
              <img src={current.imageUrl} alt={current.name} />
            ) : (
              <div
                className="figma-spotlight-v2-placeholder"
                style={{
                  background: `linear-gradient(135deg, hsl(${hueFromAddress(current.address)} 40% 18%) 0%, hsl(${(hueFromAddress(current.address) + 60) % 360} 35% 14%) 100%)`,
                }}
              >
                <span>{current.symbol?.slice(0, 2).toUpperCase() || current.name.slice(0, 2).toUpperCase()}</span>
              </div>
            )}
          </div>
          <div className="figma-spotlight-v2-content">
            <span className="figma-spotlight-v2-badge">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M12 2L14.09 8.26L20.18 8.63L15.54 12.74L16.82 19.02L12 15.77L7.18 19.02L8.46 12.74L3.82 8.63L9.91 8.26L12 2Z" fill="currentColor" /></svg>
              Spotlight Collection
            </span>
            <h2>{current.name}</h2>
            <p className="figma-spotlight-v2-desc">
              A unique collection of abstract digital art pieces, each one representing a different emotion and story from the creator.
            </p>
            <div className="figma-spotlight-v2-stats">
              <div className="figma-spotlight-v2-mint-row">
                <span>Minted</span>
                <span>{formatIntegerDots(current.minted)} / {formatIntegerDots(current.maxSupply)}</span>
              </div>
              <div className="figma-spotlight-v2-progress-bar">
                <div className="figma-spotlight-v2-progress-fill" style={{ width: `${current.progressPct}%` }} />
              </div>
              <div className="figma-spotlight-v2-price-row">
                <span>Mint Price</span>
                <b>{current.model === 'free' ? 'Free' : `${formatDecimalDots(current.mintPriceStrk)} STRK`}</b>
              </div>
            </div>
            <Link href={`/collection/${current.address}`}>
              <button className="figma-spotlight-v2-cta">Mint Now</button>
            </Link>

            {/* Carousel navigation */}
            {spotlightItems.length > 1 && (
              <div className="figma-spotlight-v2-nav">
                <button type="button" onClick={goPrev} className="figma-spotlight-v2-arrow" aria-label="Previous collection">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6" /></svg>
                </button>
                <span className="figma-spotlight-v2-dots">
                  {spotlightItems.map((_, i) => (
                    <button
                      key={i}
                      type="button"
                      className={`figma-spotlight-v2-dot ${i === spotlightIdx ? 'figma-spotlight-v2-dot--active' : ''}`}
                      onClick={() => setSpotlightIdx(i)}
                      aria-label={`Go to collection ${i + 1}`}
                    />
                  ))}
                </span>
                <button type="button" onClick={goNext} className="figma-spotlight-v2-arrow" aria-label="Next collection">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6" /></svg>
                </button>
              </div>
            )}
          </div>
        </section>
      ) : null}

      {/* ── Filters ── */}
      <section className="figma-nft-filters-bar">
        <div className="figma-nft-search-wrap">
          <svg className="figma-nft-search-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8" /><path d="M21 21l-4.35-4.35" /></svg>
          <input
            placeholder="Search collections..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="figma-nft-search-input"
          />
        </div>
        <div className="figma-nft-filter-selects">
          <div className="figma-nft-select-wrap">
            <svg className="figma-nft-filter-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 3H2l8 9.46V19l4 2v-8.54L22 3z" /></svg>
            <select value={priceFilter} onChange={(e) => setPriceFilter(e.target.value as PriceFilter)}>
              <option value="all">All Prices</option>
              <option value="free">Free</option>
              <option value="paid">Paid</option>
            </select>
          </div>
          <select value={sortBy} onChange={(e) => setSortBy(e.target.value as SortMode)}>
            <option value="trending">Trending</option>
            <option value="newest">Newest</option>
            <option value="popular">Most Popular</option>
          </select>
        </div>
      </section>

      {/* ── Collection Grid ── */}
      {filtered.length === 0 ? (
        <section className="figma-panel">
          <div className="figma-empty">
            <h3>No collections found</h3>
            <p>Try adjusting your search or filter criteria.</p>
          </div>
        </section>
      ) : (
        <section className="figma-nft-grid-section">
          <div className="figma-grid-3">
            {filtered.map((collection) => {
              const hue = hueFromAddress(collection.address);
              const pct = collection.maxSupply > 0 ? ((collection.minted / collection.maxSupply) * 100).toFixed(0) : '0';
              const isTrending = collection.progressPct > 20;
              return (
                <Link key={collection.address} href={`/collection/${collection.address}`} className="figma-nft-card-v2">
                  <div className="figma-nft-card-v2-media">
                    {collection.imageUrl ? (
                      <img src={collection.imageUrl} alt={collection.name} />
                    ) : (
                      <div
                        className="figma-nft-card-v2-placeholder"
                        style={{
                          background: `linear-gradient(135deg, hsl(${hue} 40% 18%) 0%, hsl(${(hue + 60) % 360} 35% 14%) 100%)`,
                        }}
                      >
                        <span>{collection.symbol?.slice(0, 2).toUpperCase() || collection.name.slice(0, 2).toUpperCase()}</span>
                      </div>
                    )}
                    {isTrending && (
                      <span className="figma-nft-card-v2-trending">
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none"><path d="M12 2L14.09 8.26L20.18 8.63L15.54 12.74L16.82 19.02L12 15.77L7.18 19.02L8.46 12.74L3.82 8.63L9.91 8.26L12 2Z" fill="currentColor" /></svg>
                        Trending
                      </span>
                    )}
                  </div>
                  <div className="figma-nft-card-v2-body">
                    <div className="figma-nft-card-v2-head">
                      <h3>{collection.name}</h3>
                      <span className="figma-nft-card-v2-model">{collection.model === 'free' ? 'Free Mint' : 'Paid Mint'}</span>
                    </div>
                    <div className="figma-nft-card-v2-progress-section">
                      <div className="figma-nft-card-v2-progress-head">
                        <span>Minted</span>
                        <span>{formatIntegerDots(collection.minted)} / {formatIntegerDots(collection.maxSupply)}</span>
                      </div>
                      <div className="figma-nft-card-v2-progress-bar">
                        <div className="figma-nft-card-v2-progress-fill" style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                    <div className="figma-nft-card-v2-price">
                      <span>Mint Price</span>
                      <b>{Number(collection.mintPriceStrk) > 0 ? `${formatDecimalDots(collection.mintPriceStrk)} STRK` : 'Free'}</b>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        </section>
      )}
    </>
  );
}
