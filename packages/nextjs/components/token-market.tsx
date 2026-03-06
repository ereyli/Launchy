'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { formatDecimalDots, formatIntegerDots } from '~~/lib/format';

type TokenMarketItem = {
  address: string;
  owner: string;
  name: string;
  symbol: string;
  logoImageUrl?: string;
  initialMarketCapUsd?: number;
  totalSupplyFormatted: string;
  isLaunched: boolean;
  createdAtBlock?: number;
  quoteTokenAddress: string;
};

type StatusFilter = 'all' | 'live' | 'deployed';
type SortMode = 'newest' | 'oldest' | 'name' | 'supply' | 'market_cap';

function extractNumber(input?: string) {
  if (!input) return 0;
  const normalized = (input.includes(',') ? input.replace(/\./g, '').replace(',', '.') : input)
    .replace(/[^\d.-]/g, '');
  const value = Number.parseFloat(normalized);
  return Number.isFinite(value) ? value : 0;
}

function localPairKey(base: string, quote: string) {
  return `${base.toLowerCase()}_${quote.toLowerCase()}`;
}

export function TokenMarket({ items }: { items: TokenMarketItem[] }) {
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState<StatusFilter>('all');
  const [sort, setSort] = useState<SortMode>('newest');
  const [strkUsd, setStrkUsd] = useState<number>(0);
  const [mcByAddress, setMcByAddress] = useState<Record<string, number>>({});

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setInterval> | undefined;

    async function syncMarketCaps() {
      try {
        const priceRes = await fetch('/api/market/strk-usd', { cache: 'no-store' });
        const pricePayload = await priceRes.json().catch(() => ({}));
        const currentStrkUsd =
          priceRes.ok && Number.isFinite(Number(pricePayload?.priceUsd))
            ? Number(pricePayload.priceUsd)
            : 0;
        if (!cancelled && currentStrkUsd > 0) {
          setStrkUsd(currentStrkUsd);
        }

        const launched = items.filter((item) => item.isLaunched);
        if (!launched.length || currentStrkUsd <= 0) {
          if (!cancelled) setMcByAddress({});
          return;
        }

        const quoteRes = await fetch('/api/market/latest-quotes', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          cache: 'no-store',
          body: JSON.stringify({
            items: launched.map((item) => ({
              base: item.address,
              quote: item.quoteTokenAddress,
            })),
          }),
        });
        const quotePayload = await quoteRes.json().catch(() => ({}));
        const quoteMap = (quotePayload?.quotes || {}) as Record<string, number>;

        const prices = launched.map((item) => {
          const key = localPairKey(item.address, item.quoteTokenAddress);
          const priceStrk = Number(quoteMap[key] || 0);
          const supply = extractNumber(item.totalSupplyFormatted);
          if (!Number.isFinite(priceStrk) || priceStrk <= 0 || supply <= 0) {
            const initial = Number(item.initialMarketCapUsd || 0);
            return [item.address, Number.isFinite(initial) && initial > 0 ? initial : 0] as const;
          }
          return [item.address, priceStrk * supply * currentStrkUsd] as const;
        });

        if (!cancelled) {
          const next: Record<string, number> = {};
          for (const [address, mcUsd] of prices) {
            next[address.toLowerCase()] = mcUsd;
          }
          setMcByAddress(next);
        }
      } catch {
        if (!cancelled) setMcByAddress({});
      }
    }

    void syncMarketCaps();
    timer = setInterval(() => void syncMarketCaps(), 30000);

    return () => {
      cancelled = true;
      if (timer) clearInterval(timer);
    };
  }, [items]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();

    let data = items.filter((item) => {
      const queryOk =
        !q ||
        item.name.toLowerCase().includes(q) ||
        item.symbol.toLowerCase().includes(q) ||
        item.address.toLowerCase().includes(q) ||
        item.owner.toLowerCase().includes(q);
      const statusOk =
        status === 'all' ||
        (status === 'live' && item.isLaunched) ||
        (status === 'deployed' && !item.isLaunched);
      return queryOk && statusOk;
    });

    data = data.sort((a, b) => {
      if (sort === 'oldest') return (a.createdAtBlock ?? 0) - (b.createdAtBlock ?? 0);
      if (sort === 'name') return a.name.localeCompare(b.name);
      if (sort === 'supply') return extractNumber(b.totalSupplyFormatted) - extractNumber(a.totalSupplyFormatted);
      if (sort === 'market_cap') {
        const aMc = mcByAddress[a.address.toLowerCase()] ?? 0;
        const bMc = mcByAddress[b.address.toLowerCase()] ?? 0;
        return bMc - aMc;
      }
      return (b.createdAtBlock ?? 0) - (a.createdAtBlock ?? 0);
    });

    return data;
  }, [items, query, status, sort, mcByAddress]);

  const liveCount = useMemo(() => items.filter((item) => item.isLaunched).length, [items]);
  return (
    <section className="panel browser-panel">
      <div className="token-market-chips">
        <button type="button" className={`market-chip ${status === 'all' ? 'market-chip-active' : ''}`} onClick={() => setStatus('all')}>All</button>
        <button type="button" className={`market-chip ${status === 'live' ? 'market-chip-active' : ''}`} onClick={() => setStatus('live')}>Listed</button>
        <button type="button" className={`market-chip ${status === 'deployed' ? 'market-chip-active' : ''}`} onClick={() => setStatus('deployed')}>Deployed</button>
      </div>

      <div className="token-market-controls">
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search by token name, symbol, address or owner"
        />
        <select value={status} onChange={(event) => setStatus(event.target.value as StatusFilter)}>
          <option value="all">All models</option>
          <option value="live">Listed only</option>
          <option value="deployed">Deploy only</option>
        </select>
        <select value={sort} onChange={(event) => setSort(event.target.value as SortMode)}>
          <option value="newest">Newest</option>
          <option value="oldest">Oldest</option>
          <option value="market_cap">Market cap</option>
          <option value="supply">Supply</option>
          <option value="name">Name (A-Z)</option>
        </select>
      </div>

      <div className="token-market-stats">
        <span className="badge">Total: {formatIntegerDots(items.length)}</span>
        <span className="badge">Listed: {formatIntegerDots(liveCount)}</span>
        <span className="badge">Results: {formatIntegerDots(filtered.length)}</span>
      </div>

      {filtered.length ? (
        <div className="tk-grid">
          {filtered.map((token) => {
            const mcUsd = mcByAddress[token.address.toLowerCase()] ?? 0;
            const initialMcUsd = Number(token.initialMarketCapUsd || 0);
            const mcDisplay = mcUsd > 0
              ? `$${formatDecimalDots(String(mcUsd), 2)}`
              : initialMcUsd > 0
                ? `$${formatDecimalDots(String(initialMcUsd), 2)}`
                : '—';
            const tokenHref = `/token/${token.address}?side=buy`;
            const hue = (() => {
              let h = 0;
              for (let i = 2; i < token.address.length; i += 1)
                h = (h * 31 + token.address.charCodeAt(i)) % 360;
              return h;
            })();
            return (
              <Link key={token.address} href={tokenHref} className="tk-card">
                <div
                  className="tk-card-header"
                  style={{
                    background: token.logoImageUrl
                      ? 'var(--bg-surface)'
                      : `linear-gradient(135deg, hsl(${hue} 40% 18%) 0%, hsl(${(hue + 60) % 360} 35% 14%) 100%)`,
                  }}
                >
                  <div className="tk-logo">
                    {token.logoImageUrl ? (
                      <img src={token.logoImageUrl} alt={token.name} />
                    ) : (
                      <span>{token.symbol.slice(0, 2).toUpperCase()}</span>
                    )}
                  </div>
                  <span className={`tk-status ${token.isLaunched ? 'tk-status--live' : ''}`}>
                    {token.isLaunched ? '● Listed' : 'Deployed'}
                  </span>
                </div>

                <div className="tk-card-body">
                  <div className="tk-name-row">
                    <h3 className="tk-name">{token.name}</h3>
                    <span className="tk-symbol">{token.symbol}</span>
                  </div>
                  <div className="tk-stats-row">
                    <div className="tk-stat">
                      <span className="tk-stat-label">Supply</span>
                      <span className="tk-stat-value">{formatDecimalDots(token.totalSupplyFormatted, 0)}</span>
                    </div>
                    <div className="tk-stat">
                      <span className="tk-stat-label">Market Cap</span>
                      <span className="tk-stat-value">{mcDisplay}</span>
                    </div>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      ) : (
        <p className="muted">No token matched this filter.</p>
      )}

    </section>
  );
}
