import Link from 'next/link';
import { fetchLaunchpadData, fetchLaunchpadMeta } from '~~/lib/launchpad/collections';
import { formatDecimalDots, formatIntegerDots } from '~~/lib/format';
import { fetchLatestTokenLaunches } from '~~/lib/token-launchpad/tokens';

export const dynamic = 'force-dynamic';

export default async function DashboardPage() {
  const [nftData, launchpadMeta, tokens] = await Promise.all([fetchLaunchpadData(), fetchLaunchpadMeta(), fetchLatestTokenLaunches(120)]);
  const totalCollections = nftData.collections.length;
  const totalMints = nftData.collections.reduce((acc, item) => acc + item.minted, 0);
  const listedTokens = tokens.filter((item) => item.isLaunched).length;

  return (
    <main className="grid">
      <section className="hero hero-ultra profile-hero profile-hero-v2">
        <span className="hero-kicker">Analytics</span>
        <h1>Creator analytics</h1>
        <p className="lead">Contract-backed metrics for your launch ecosystem.</p>
        <div className="hero-actions">
          <Link href="/profile">
            <button>Open Portfolio</button>
          </Link>
        </div>
      </section>

      <section className="figma-home-stats">
        <article><strong>{formatIntegerDots(tokens.length)}</strong><span>Tracked tokens</span></article>
        <article><strong>{formatIntegerDots(listedTokens)}</strong><span>Listed tokens</span></article>
        <article><strong>{formatIntegerDots(totalCollections)}</strong><span>NFT collections</span></article>
        <article><strong>{formatIntegerDots(totalMints)}</strong><span>Total mints</span></article>
      </section>

      <section className="panel card-soft">
        <h3 className="card-title">Factory configuration</h3>
        <ul className="list">
          <li>Factory address: {launchpadMeta.factoryAddress || 'Not configured'}</li>
          <li>Deploy fee: {formatDecimalDots(launchpadMeta.deployFeeStrk)} STRK</li>
          <li>Mint fee: {formatDecimalDots(launchpadMeta.mintFeeStrk)} STRK</li>
        </ul>
      </section>
    </main>
  );
}
