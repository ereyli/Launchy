'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { formatDecimalDots } from '~~/lib/format';

type TokenItem = {
  address: string;
  name: string;
  symbol: string;
  logoImageUrl?: string;
  totalSupplyFormatted: string;
  isLaunched: boolean;
  marketCapUsd: number;
  change24hPct: number;
};

type StatusFilter = 'all' | 'listed' | 'deployed';
type SortMode = 'trending' | 'newest' | 'marketcap';

function hueFromAddress(address: string) {
  let hash = 0;
  for (let i = 2; i < address.length; i += 1) hash = (hash * 31 + address.charCodeAt(i)) % 360;
  return hash;
}

export function TokenLaunchpadView({ items }: { items: TokenItem[] }) {
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [sortBy, setSortBy] = useState<SortMode>('trending');

  const filtered = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    let data = items.filter((token) => {
      const matchQuery =
        !q ||
        token.name.toLowerCase().includes(q) ||
        token.symbol.toLowerCase().includes(q) ||
        token.address.toLowerCase().includes(q);
      const matchStatus =
        statusFilter === 'all' ||
        (statusFilter === 'listed' && token.isLaunched) ||
        (statusFilter === 'deployed' && !token.isLaunched);
      return matchQuery && matchStatus;
    });

    data = [...data].sort((a, b) => {
      if (sortBy === 'marketcap') return b.marketCapUsd - a.marketCapUsd;
      if (sortBy === 'newest') return b.address.localeCompare(a.address);
      return b.marketCapUsd - a.marketCapUsd;
    });
    return data;
  }, [items, searchQuery, statusFilter, sortBy]);

  return (
    <section className="figma-panel">
      <div className="figma-filters">
        <input
          placeholder="Search tokens..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}>
          <option value="all">All Status</option>
          <option value="listed">Listed</option>
          <option value="deployed">Deployed</option>
        </select>
        <select value={sortBy} onChange={(e) => setSortBy(e.target.value as SortMode)}>
          <option value="trending">Trending</option>
          <option value="newest">Newest</option>
          <option value="marketcap">Market Cap</option>
        </select>
      </div>

      {filtered.length === 0 ? (
        <div className="figma-empty">
          <h3>No tokens found</h3>
          <p>Try adjusting your search or filter criteria.</p>
        </div>
      ) : (
        <div className="figma-grid-3">
          {filtered.map((token) => {
            const hue = hueFromAddress(token.address);
            return (
              <Link key={token.address} href={`/token/${token.address}?side=buy`} className="figma-token-card">
                {/* Card Header: Logo + Name + Badge */}
                <div className="figma-token-card-header">
                  <div className="figma-token-card-identity">
                    <div
                      className="figma-token-card-avatar"
                      style={{
                        background: token.logoImageUrl
                          ? 'var(--bg-surface)'
                          : `linear-gradient(135deg, hsl(${hue} 40% 22%) 0%, hsl(${(hue + 60) % 360} 35% 18%) 100%)`,
                      }}
                    >
                      {token.logoImageUrl ? (
                        <img src={token.logoImageUrl} alt={token.name} />
                      ) : (
                        <span>{token.symbol.slice(0, 2).toUpperCase()}</span>
                      )}
                    </div>
                    <div>
                      <h3>{token.name}</h3>
                      <p>{token.symbol}</p>
                    </div>
                  </div>
                  <span className={`figma-token-card-badge ${token.isLaunched ? 'figma-token-card-badge--live' : ''}`}>
                    {token.isLaunched ? 'Listed' : 'Deployed'}
                  </span>
                </div>

                {/* Card Stats */}
                <div className="figma-token-card-stats">
                  <div className="figma-token-card-row">
                    <span>Supply</span>
                    <b>{formatDecimalDots(token.totalSupplyFormatted, 0)}</b>
                  </div>
                  <div className="figma-token-card-row">
                    <span>Market Cap</span>
                    <b>{token.marketCapUsd > 0 ? `$${formatDecimalDots(String(token.marketCapUsd), 0)}` : '-'}</b>
                  </div>
                </div>

                {/* 24h Change */}
                <div className="figma-token-card-change">
                  <span>24h Change</span>
                  <span className={`figma-token-card-change-value ${token.change24hPct < 0 ? 'figma-token-card-change-value--negative' : ''}`}>
                    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                      <path d="M2 10L7 5L9.5 7.5L12 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                    {token.change24hPct >= 0 ? '+' : ''}
                    {formatDecimalDots(String(token.change24hPct || 0), 1)}%
                  </span>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </section>
  );
}
