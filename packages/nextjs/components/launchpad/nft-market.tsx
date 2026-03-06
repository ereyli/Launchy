'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { formatDecimalDots, formatIntegerDots } from '~~/lib/format';
import type { LaunchCollection } from '~~/lib/launchpad/collections';

type ModelFilter = 'all' | 'free' | 'paid';
type SortMode = 'trending' | 'newest' | 'popular' | 'mint_price' | 'name';

function hueFromAddress(address: string) {
  let hash = 0;
  for (let i = 2; i < address.length; i += 1) hash = (hash * 31 + address.charCodeAt(i)) % 360;
  return hash;
}

export function NftMarket({ items }: { items: LaunchCollection[] }) {
  const [query, setQuery] = useState('');
  const [model, setModel] = useState<ModelFilter>('all');
  const [sort, setSort] = useState<SortMode>('trending');

  const spotlight = useMemo(() => {
    if (!items.length) return null;
    return [...items].sort((a, b) => {
      if (b.progressPct !== a.progressPct) return b.progressPct - a.progressPct;
      return b.minted - a.minted;
    })[0];
  }, [items]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    let data = items.filter((item) => {
      const queryOk =
        !q ||
        item.name.toLowerCase().includes(q) ||
        item.symbol.toLowerCase().includes(q) ||
        item.address.toLowerCase().includes(q) ||
        item.creator.toLowerCase().includes(q);
      const modelOk = model === 'all' || item.model === model;
      return queryOk && modelOk;
    });

    data = data.sort((a, b) => {
      if (sort === 'newest') return b.index - a.index;
      if (sort === 'popular') return b.minted - a.minted;
      if (sort === 'mint_price') return Number(b.mintPriceStrk) - Number(a.mintPriceStrk);
      if (sort === 'name') return a.name.localeCompare(b.name);
      if (b.progressPct !== a.progressPct) return b.progressPct - a.progressPct;
      return b.index - a.index;
    });
    return data;
  }, [items, model, query, sort]);

  const freeCount = useMemo(() => items.filter((item) => item.model === 'free').length, [items]);
  const paidCount = useMemo(() => items.filter((item) => item.model === 'paid').length, [items]);

  return (
    <section className="panel browser-panel nft-market-v3">
      {spotlight ? (
        <article className="nft-spotlight-v3">
          <div
            className="nft-spotlight-v3-media"
            style={{
              background: spotlight.imageUrl
                ? undefined
                : `linear-gradient(135deg, hsl(${hueFromAddress(spotlight.address)} 40% 18%) 0%, hsl(${(hueFromAddress(spotlight.address) + 50) % 360} 35% 14%) 100%)`,
            }}
          >
            {spotlight.imageUrl ? (
              <img src={spotlight.imageUrl} alt={spotlight.name} />
            ) : (
              <span className="nft-spotlight-v3-placeholder">
                {spotlight.symbol?.slice(0, 3).toUpperCase() || spotlight.name.slice(0, 3).toUpperCase()}
              </span>
            )}
          </div>
          <div className="nft-spotlight-v3-content">
            <span className="badge nft-spotlight-v3-badge">Spotlight Collection</span>
            <h2>{spotlight.name}</h2>
            <p className="muted">
              En yüksek mint ivmesine sahip koleksiyon. Durumu ve fiyatı canlı veriden okunur.
            </p>
            <div className="nft-spotlight-v3-progress-head">
              <span className="muted">Minted</span>
              <span>{formatIntegerDots(spotlight.minted)} / {formatIntegerDots(spotlight.maxSupply)}</span>
            </div>
            <div className="nft-spotlight-v3-progress-bar">
              <div className="nft-spotlight-v3-progress-fill" style={{ width: `${spotlight.progressPct}%` }} />
            </div>
            <div className="nft-spotlight-v3-foot">
              <span className="nft-spotlight-v3-price">
                {Number(spotlight.mintPriceStrk) > 0 ? `${formatDecimalDots(spotlight.mintPriceStrk)} STRK` : 'Free'}
              </span>
              <Link href={`/collection/${spotlight.address}`}>
                <button>Mint Now</button>
              </Link>
            </div>
          </div>
        </article>
      ) : null}

      <div className="nft-market-v3-controls">
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search by collection name, symbol, address or creator"
        />
        <select value={model} onChange={(event) => setModel(event.target.value as ModelFilter)}>
          <option value="all">All prices</option>
          <option value="free">Free</option>
          <option value="paid">Paid</option>
        </select>
        <select value={sort} onChange={(event) => setSort(event.target.value as SortMode)}>
          <option value="trending">Trending</option>
          <option value="newest">Newest</option>
          <option value="popular">Most popular</option>
          <option value="mint_price">Mint price</option>
          <option value="name">Name (A-Z)</option>
        </select>
      </div>

      <div className="token-market-stats">
        <span className="badge">Total: {formatIntegerDots(items.length)}</span>
        <span className="badge">Free: {formatIntegerDots(freeCount)}</span>
        <span className="badge">Paid: {formatIntegerDots(paidCount)}</span>
        <span className="badge">Results: {formatIntegerDots(filtered.length)}</span>
      </div>

      {filtered.length ? (
        <div className="tk-grid">
          {filtered.map((collection) => {
            const pct = collection.maxSupply > 0
              ? ((collection.minted / collection.maxSupply) * 100).toFixed(0)
              : '0';
            const hue = hueFromAddress(collection.address);
            return (
              <Link
                key={collection.address}
                href={`/collection/${collection.address}`}
                className="tk-card"
              >
                <div
                  className="tk-card-header nk-card-header"
                  style={{
                    background: collection.imageUrl
                      ? undefined
                      : `linear-gradient(135deg, hsl(${hue} 40% 18%) 0%, hsl(${(hue + 50) % 360} 35% 14%) 100%)`,
                  }}
                >
                  {collection.imageUrl ? (
                    <img className="nk-cover-img" src={collection.imageUrl} alt={collection.name} />
                  ) : (
                    <div className="tk-logo">
                      <span>{collection.symbol?.slice(0, 2).toUpperCase() || collection.name.slice(0, 2).toUpperCase()}</span>
                    </div>
                  )}
                  <span className={`tk-status ${collection.model === 'free' ? 'tk-status--free' : 'tk-status--paid'}`}>
                    {collection.model.toUpperCase()}
                  </span>
                </div>

                <div className="tk-card-body">
                  <div className="tk-name-row">
                    <h3 className="tk-name">{collection.name}</h3>
                    <span className="tk-symbol">{collection.symbol}</span>
                  </div>

                  <div className="nk-progress">
                    <div className="nk-progress-bar">
                      <div className="nk-progress-fill" style={{ width: `${pct}%` }} />
                    </div>
                    <span className="nk-progress-pct">{pct}%</span>
                  </div>

                  <div className="tk-stats-row">
                    <div className="tk-stat">
                      <span className="tk-stat-label">Minted</span>
                      <span className="tk-stat-value">{formatIntegerDots(collection.minted)} / {formatIntegerDots(collection.maxSupply)}</span>
                    </div>
                    <div className="tk-stat">
                      <span className="tk-stat-label">Mint price</span>
                      <span className="tk-stat-value">{Number(collection.mintPriceStrk) > 0 ? `${formatDecimalDots(collection.mintPriceStrk)} STRK` : 'Free'}</span>
                    </div>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      ) : (
        <div className="nft-market-v3-empty">
          <p>No collections found for this filter.</p>
          <button
            type="button"
            className="ghost-button"
            onClick={() => {
              setModel('all');
              setSort('trending');
              setQuery('');
            }}
          >
            Clear Filters
          </button>
        </div>
      )}
    </section>
  );
}
