import Link from 'next/link';
import type { LaunchCollection } from '~~/lib/launchpad/collections';
import { formatDecimalDots, formatIntegerDots } from '~~/lib/format';
import { shortAddress } from '~~/lib/starknet/address';

function hueFromAddress(address: string) {
  let hash = 0;
  for (let i = 2; i < address.length; i += 1) hash = (hash * 31 + address.charCodeAt(i)) % 360;
  return hash;
}

export function CollectionCard({ collection, compact = false }: { collection: LaunchCollection; compact?: boolean }) {
  const hue = hueFromAddress(collection.address);
  const mintedPct = collection.progressPct;
  const creatorShort = shortAddress(collection.creator);

  return (
    <article className={`launch-card ${compact ? 'launch-card-compact' : ''}`}>
      <div
        className="launch-cover"
        style={{
          background: `linear-gradient(135deg, hsl(${hue} 72% 55%) 0%, hsl(${(hue + 42) % 360} 78% 40%) 100%)`,
        }}
      >
        {collection.imageUrl ? (
          <img className="launch-cover-image" src={collection.imageUrl} alt={`${collection.name} artwork`} />
        ) : null}
        <span className="launch-model">{collection.model === 'free' ? 'FREE' : 'PAID'}</span>
      </div>

      <div className="launch-content">
        <div className="launch-head">
          <h3>{collection.name}</h3>
          <span className="launch-symbol">{collection.symbol}</span>
        </div>

        <p className="launch-meta">{creatorShort}</p>

        <div className="launch-progress">
          <div className="launch-progress-bar" style={{ width: `${mintedPct}%` }} />
        </div>

        <div className="launch-stats">
          <span>Minted <b>{formatIntegerDots(collection.minted)}/{formatIntegerDots(collection.maxSupply)}</b></span>
          <span>Price <b>{formatDecimalDots(collection.mintPriceStrk)} STRK</b></span>
        </div>

        <div className="launch-actions">
          <Link href={`/collection/${collection.address}`}>
            <button>{compact ? 'Mint Page' : 'Open Mint Page'}</button>
          </Link>
        </div>
      </div>
    </article>
  );
}
