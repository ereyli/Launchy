import Link from 'next/link';
import { formatDecimalDots, formatIntegerDots } from '~~/lib/format';
import type { LaunchCollection } from '~~/lib/launchpad/collections';

export function MarketMarquee({ items }: { items: LaunchCollection[] }) {
  if (!items.length) {
    return <div className="marquee-shell"><div className="marquee-track"><span className="marquee-chip">No on-chain collections yet.</span></div></div>;
  }

  const repeated = [...items, ...items];

  return (
    <div className="marquee-shell">
      <div className="marquee-track">
        {repeated.map((item, idx) => (
          <Link href={`/collection/${item.address}`} key={`${item.address}-${idx}`} className="marquee-chip">
            <strong>{item.name}</strong>
            <span>{formatDecimalDots(item.mintPriceStrk)} STRK mint</span>
            <span>{formatIntegerDots(item.minted)}/{formatIntegerDots(item.maxSupply)} minted</span>
          </Link>
        ))}
      </div>
    </div>
  );
}
