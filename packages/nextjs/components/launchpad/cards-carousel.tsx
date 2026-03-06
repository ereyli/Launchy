'use client';

import { useRef } from 'react';
import { CollectionCard } from '~~/components/launchpad/collection-card';
import type { LaunchCollection } from '~~/lib/launchpad/collections';

type Props = {
  items: LaunchCollection[];
};

export function CardsCarousel({ items }: Props) {
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
        <button
          type="button"
          className="ghost-button cards-carousel-arrow"
          onClick={() => scrollByDirection('left')}
          aria-label="Scroll left"
        >
          ‹
        </button>
        <button
          type="button"
          className="ghost-button cards-carousel-arrow"
          onClick={() => scrollByDirection('right')}
          aria-label="Scroll right"
        >
          ›
        </button>
      </div>

      <div className="cards-scroller-shell">
        <div className="cards-scroller-track-manual" ref={railRef}>
          {items.map((collection) => (
            <CollectionCard key={collection.address} collection={collection} compact />
          ))}
        </div>
      </div>
    </div>
  );
}
