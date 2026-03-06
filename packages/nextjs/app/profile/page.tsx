import Link from 'next/link';
import { ProfileTokenClaims } from '~~/components/figma/profile-token-claims';
import { formatIntegerDots } from '~~/lib/format';
import { fetchLaunchpadData } from '~~/lib/launchpad/collections';
import { fetchLatestTokenLaunches } from '~~/lib/token-launchpad/tokens';

export const dynamic = 'force-dynamic';

export default async function ProfilePage() {
  const [tokens, nftData] = await Promise.all([fetchLatestTokenLaunches(120), fetchLaunchpadData()]);
  const listedTokens = tokens.filter((token) => token.isLaunched).length;
  const totalMinted = nftData.collections.reduce((acc, c) => acc + c.minted, 0);
  const claimableTokens = tokens.map((token) => ({
    address: token.address,
    owner: token.owner,
    name: token.name,
    symbol: token.symbol,
    isLaunched: token.isLaunched,
    quoteAmountFormatted: token.launchData?.quoteAmountFormatted,
  }));

  return (
    <main className="grid">
      <section className="figma-page-hero">
        <h1>Creator Dashboard</h1>
        <p>Manage your tokens and collections.</p>
        <Link href="/create">
          <button>Create New</button>
        </Link>
      </section>

      <section className="figma-home-stats">
        <article><strong>{formatIntegerDots(tokens.length)}</strong><span>Tokens Deployed</span></article>
        <article><strong>{formatIntegerDots(listedTokens)}</strong><span>Tokens Listed</span></article>
        <article><strong>{formatIntegerDots(nftData.collections.length)}</strong><span>Collections</span></article>
        <article><strong>{formatIntegerDots(totalMinted)}</strong><span>Total Minted NFTs</span></article>
      </section>

      <section className="figma-panel">
        <div className="figma-section-head">
          <h2>Tokens</h2>
        </div>
        <div className="figma-grid-3">
          {tokens.slice(0, 12).map((token) => (
            <Link key={token.address} href={`/token/${token.address}?side=buy`} className="figma-card">
              <div className="figma-token-head">
                <div className="figma-token-logo">
                  {token.logoImageUrl ? <img src={token.logoImageUrl} alt={token.name} /> : <span>{token.symbol.slice(0, 2).toUpperCase()}</span>}
                </div>
                <div>
                  <h3>{token.name}</h3>
                  <p>{token.symbol}</p>
                </div>
                <span className={`figma-status ${token.isLaunched ? 'figma-status-live' : ''}`}>
                  {token.isLaunched ? 'Listed' : 'Deployed'}
                </span>
              </div>
            </Link>
          ))}
        </div>
      </section>

      <ProfileTokenClaims tokens={claimableTokens} />

      <section className="figma-panel">
        <div className="figma-section-head">
          <h2>Collections</h2>
        </div>
        <div className="figma-grid-3">
          {nftData.collections.slice(0, 12).map((collection) => (
            <Link key={collection.address} href={`/collection/${collection.address}`} className="figma-card">
              <div className="figma-nft-cover">
                {collection.imageUrl ? <img src={collection.imageUrl} alt={collection.name} /> : <span>{collection.symbol?.slice(0, 2).toUpperCase() || collection.name.slice(0, 2).toUpperCase()}</span>}
              </div>
              <h3>{collection.name}</h3>
              <div className="figma-token-meta">
                <span>Minted</span>
                <b>{formatIntegerDots(collection.minted)} / {formatIntegerDots(collection.maxSupply)}</b>
              </div>
            </Link>
          ))}
        </div>
      </section>
    </main>
  );
}
