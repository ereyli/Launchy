'use client';

export function TokenCardSkeleton() {
  return (
    <div className="skeleton-token-card" aria-hidden="true">
      <div className="skeleton-token-header">
        <div className="skeleton-avatar" />
        <div className="skeleton-identity">
          <div className="skeleton-line skeleton-line-md" />
          <div className="skeleton-line skeleton-line-sm" />
        </div>
        <div className="skeleton-badge" />
      </div>
      <div className="skeleton-stats">
        <div className="skeleton-stat-row">
          <div className="skeleton-line skeleton-line-sm" />
          <div className="skeleton-line skeleton-line-sm" />
        </div>
        <div className="skeleton-stat-row">
          <div className="skeleton-line skeleton-line-sm" />
          <div className="skeleton-line skeleton-line-sm" />
        </div>
      </div>
      <div className="skeleton-footer">
        <div className="skeleton-line skeleton-line-sm" />
        <div className="skeleton-line skeleton-line-xs" />
      </div>
    </div>
  );
}

export function NftCardSkeleton() {
  return (
    <div className="skeleton-nft-card" aria-hidden="true">
      <div className="skeleton-nft-media" />
      <div className="skeleton-nft-body">
        <div className="skeleton-line skeleton-line-lg" />
        <div className="skeleton-line skeleton-line-md" />
        <div className="skeleton-progress-bar" />
        <div className="skeleton-stat-row">
          <div className="skeleton-line skeleton-line-sm" />
          <div className="skeleton-line skeleton-line-sm" />
        </div>
      </div>
    </div>
  );
}

export function TokenGridSkeleton({ count = 6 }: { count?: number }) {
  return (
    <section className="figma-panel" aria-busy="true" aria-label="Loading tokens…">
      <div className="figma-grid-3">
        {Array.from({ length: count }).map((_, i) => (
          <TokenCardSkeleton key={i} />
        ))}
      </div>
    </section>
  );
}

export function NftGridSkeleton({ count = 6 }: { count?: number }) {
  return (
    <section className="figma-nft-grid-section" aria-busy="true" aria-label="Loading collections…">
      <div className="figma-grid-3">
        {Array.from({ length: count }).map((_, i) => (
          <NftCardSkeleton key={i} />
        ))}
      </div>
    </section>
  );
}

export function HomeTokensSkeleton() {
  return (
    <div className="figma-home-cards">
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className="skeleton-home-card" aria-hidden="true">
          <div className="skeleton-token-header">
            <div className="skeleton-avatar" />
            <div className="skeleton-identity">
              <div className="skeleton-line skeleton-line-md" />
              <div className="skeleton-line skeleton-line-sm" />
            </div>
          </div>
          <div className="skeleton-stats">
            <div className="skeleton-stat-row">
              <div className="skeleton-line skeleton-line-sm" />
              <div className="skeleton-line skeleton-line-sm" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

export function HomeNftsSkeleton() {
  return (
    <div className="figma-home-cards">
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className="skeleton-home-nft-card" aria-hidden="true">
          <div className="skeleton-nft-media skeleton-nft-media-sm" />
          <div className="skeleton-nft-body">
            <div className="skeleton-line skeleton-line-lg" />
            <div className="skeleton-progress-bar" />
          </div>
        </div>
      ))}
    </div>
  );
}
