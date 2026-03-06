'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { formatDecimalDots, formatIntegerDots } from '~~/lib/format';
import type { LaunchCollection } from '~~/lib/launchpad/collections';

export function NftSpotlight({ items }: { items: LaunchCollection[] }) {
  const entries = useMemo(() => items.slice(0, 12), [items]);
  const [active, setActive] = useState(0);

  useEffect(() => {
    if (entries.length <= 1) return;
    const timer = setInterval(() => {
      setActive((prev) => (prev + 1) % entries.length);
    }, 10000);
    return () => clearInterval(timer);
  }, [entries.length]);

  if (!entries.length) return null;

  const current = entries[active];

  return (
    <section className="panel nft-spotlight">
      <div className="nft-spotlight-copy">
        <span className="hero-kicker">Featured collection</span>
        <h2>{current.name}</h2>
        <p>
          {current.model.toUpperCase()} model · {formatDecimalDots(current.mintPriceStrk)} STRK mint price
        </p>
        <div className="nft-spotlight-stats">
          <article className="stat">
            <span className="muted">Minted</span>
            <strong>{formatIntegerDots(current.minted)}</strong>
          </article>
          <article className="stat">
            <span className="muted">Remaining</span>
            <strong>{formatIntegerDots(Math.max(current.maxSupply - current.minted, 0))}</strong>
          </article>
          <article className="stat">
            <span className="muted">Total supply</span>
            <strong>{formatIntegerDots(current.maxSupply)}</strong>
          </article>
        </div>
        <div className="hero-actions">
          <Link href={`/collection/${current.address}`}>
            <button>Mint now</button>
          </Link>
        </div>
      </div>

      <div className="nft-spotlight-media">
        {current.imageUrl ? (
          <img src={current.imageUrl} alt={`${current.name} artwork`} />
        ) : (
          <div className="nft-spotlight-placeholder">{current.symbol || 'NFT'}</div>
        )}
      </div>

      <div className="nft-spotlight-dots" aria-hidden>
        {entries.map((item, idx) => (
          <button
            key={item.address}
            type="button"
            className={`nft-spotlight-dot ${idx === active ? 'nft-spotlight-dot-active' : ''}`}
            onClick={() => setActive(idx)}
          />
        ))}
      </div>
    </section>
  );
}
