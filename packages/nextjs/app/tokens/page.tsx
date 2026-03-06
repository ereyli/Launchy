import Link from 'next/link';
import { TokenLaunchpadView } from '~~/components/figma/token-launchpad-view';
import { fetchLatestTokenLaunches } from '~~/lib/token-launchpad/tokens';

export const dynamic = 'force-dynamic';

export default async function TokensPage() {
  const tokens = await fetchLatestTokenLaunches(100);
  const tokenItems = tokens.map((item) => ({
    address: item.address,
    name: item.name,
    symbol: item.symbol,
    logoImageUrl: item.logoImageUrl,
    totalSupplyFormatted: item.totalSupplyFormatted,
    isLaunched: item.isLaunched,
    marketCapUsd: item.initialMarketCapUsd ?? 0,
  }));

  return (
    <main className="grid">
      <section className="figma-page-hero">
        <h1>Token Launchpad</h1>
        <p>Discover and trade tokens on Starknet.</p>
        <Link href="/create?type=token">
          <button>Create Token</button>
        </Link>
      </section>
      <TokenLaunchpadView items={tokenItems} />
    </main>
  );
}
