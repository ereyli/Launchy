'use client';

import { useMemo, useState } from 'react';
import { CollectionListRow } from '~~/components/launchpad/collection-list-row';
import { formatIntegerDots } from '~~/lib/format';
import type { LaunchCollection } from '~~/lib/launchpad/collections';

type SortMode = 'newest' | 'minted' | 'mint_price' | 'name';
type ModelFilter = 'all' | 'free' | 'paid';

export function CollectionsBrowser({ items }: { items: LaunchCollection[] }) {
  const [query, setQuery] = useState('');
  const [model, setModel] = useState<ModelFilter>('all');
  const [sort, setSort] = useState<SortMode>('newest');

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
      if (sort === 'mint_price') return Number(b.mintPriceStrk) - Number(a.mintPriceStrk);
      if (sort === 'minted') return b.minted / b.maxSupply - a.minted / a.maxSupply;
      if (sort === 'name') return a.name.localeCompare(b.name);
      return b.index - a.index;
    });

    return data;
  }, [items, model, query, sort]);

  return (
    <section className="panel browser-panel">
      <div className="browser-controls">
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search by name, symbol, address or creator"
        />

        <select value={model} onChange={(event) => setModel(event.target.value as ModelFilter)}>
          <option value="all">All models</option>
          <option value="free">Free only</option>
          <option value="paid">Paid only</option>
        </select>

        <select value={sort} onChange={(event) => setSort(event.target.value as SortMode)}>
          <option value="newest">Newest</option>
          <option value="minted">Mint progress</option>
          <option value="mint_price">Mint price</option>
          <option value="name">Name (A-Z)</option>
        </select>
      </div>

      <p className="muted">{formatIntegerDots(filtered.length)} collections found</p>

      {filtered.length ? (
        <div className="list-window">
          {filtered.map((collection) => (
            <CollectionListRow key={collection.address} collection={collection} />
          ))}
        </div>
      ) : (
        <p className="muted">No collections found on-chain for this filter.</p>
      )}
    </section>
  );
}
