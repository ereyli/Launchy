'use client';

import { useRef } from 'react';
import { TokenCard } from '~~/components/token-card';
import type { TokenLaunchRecord } from '~~/lib/token-launchpad/types';

export function TokenCardsCarousel({ items }: { items: TokenLaunchRecord[] }) {
  const railRef = useRef<HTMLDivElement | null>(null);

  function scrollByDirection(direction: 'left' | 'right') {
    const rail = railRef.current;
    if (!rail) return;
    const amount = Math.max(220, Math.floor(rail.clientWidth * 0.8));
    rail.scrollBy({
      left: direction === 'left' ? -amount : amount,
      behavior: 'smooth',
    });
  }

  return (
    <div className="cards-carousel">
      <div className="cards-carousel-head">
        <button type="button" className="ghost-button cards-carousel-arrow" onClick={() => scrollByDirection('left')}>
          ‹
        </button>
        <button type="button" className="ghost-button cards-carousel-arrow" onClick={() => scrollByDirection('right')}>
          ›
        </button>
      </div>
      <div className="cards-scroller-shell">
        <div className="cards-scroller-track-manual" ref={railRef}>
          {items.map((token) => (
            <TokenCard key={token.address} token={token} compact />
          ))}
        </div>
      </div>
    </div>
  );
}
