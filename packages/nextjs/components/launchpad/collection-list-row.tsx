import Link from 'next/link';
import type { LaunchCollection } from '~~/lib/launchpad/collections';
import { formatDecimalDots, formatIntegerDots } from '~~/lib/format';
import { shortAddress } from '~~/lib/starknet/address';

export function CollectionListRow({ collection }: { collection: LaunchCollection }) {
  const progress = collection.progressPct;
  const creatorShort = shortAddress(collection.creator);

  return (
    <article className="collection-row">
      <div className="collection-row-cover">
        {collection.imageUrl ? (
          <img src={collection.imageUrl} alt={`${collection.name} cover`} />
        ) : (
          <span>{collection.symbol || 'NFT'}</span>
        )}
      </div>
      <div className="collection-row-main">
        <div className="collection-row-title">
          <h4>{collection.name}</h4>
          <span>{collection.symbol}</span>
          <span className={`row-model ${collection.model}`}>{collection.model.toUpperCase()}</span>
        </div>
        <p className="muted">{collection.address}</p>
        <div className="launch-progress">
          <div className="launch-progress-bar" style={{ width: `${progress}%` }} />
        </div>
      </div>

      <div className="collection-row-metrics">
        <span>Minted <b>{formatIntegerDots(collection.minted)}/{formatIntegerDots(collection.maxSupply)}</b></span>
        <span>Mint price <b>{formatDecimalDots(collection.mintPriceStrk)} STRK</b></span>
        <span>Creator <b>{creatorShort}</b></span>
      </div>

      <div className="collection-row-action">
        <Link href={`/collection/${collection.address}`}>
          <button className="ghost-button">Open</button>
        </Link>
      </div>
    </article>
  );
}
