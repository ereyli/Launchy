import Link from 'next/link';
import { fetchLaunchpadData } from '~~/lib/launchpad/collections';
import { formatDecimalDots, formatIntegerDots } from '~~/lib/format';
import { fetchLatestTokenLaunches } from '~~/lib/token-launchpad/tokens';

export const dynamic = 'force-dynamic';

function hueFromAddress(address: string) {
  let hash = 0;
  for (let i = 2; i < address.length; i += 1) hash = (hash * 31 + address.charCodeAt(i)) % 360;
  return hash;
}

export default async function HomePage() {
  const [nftData, tokens] = await Promise.all([
    fetchLaunchpadData(),
    fetchLatestTokenLaunches(24),
  ]);

  const topTokens = tokens.slice(0, 3);
  const topNfts = nftData.collections.slice(0, 3);
  const totalMinted = nftData.collections.reduce((acc, c) => acc + c.minted, 0);
  const listed = tokens.filter((t) => t.isLaunched).length;

  return (
    <main className="figma-home">
      <section className="figma-home-hero">
        <span className="badge">Powered by Starknet</span>
        <h1>Launch your NFT or token on Starknet</h1>
        <p>
          Deploy memecoins and NFT collections from one place. Trade and mint with a
          mobile-ready creator experience.
        </p>
        <div className="figma-home-hero-actions">
          <Link href="/create?type=token">
            <button>Launch Token</button>
          </Link>
          <Link href="/create?type=nft">
            <button className="ghost-button">Create NFT Collection</button>
          </Link>
        </div>
      </section>

      <section className="figma-home-stats">
        <article><strong>{formatIntegerDots(tokens.length)}</strong><span>Deployed Tokens</span></article>
        <article><strong>{formatIntegerDots(listed)}</strong><span>Listed Tokens</span></article>
        <article><strong>{formatIntegerDots(nftData.collections.length)}</strong><span>Collections</span></article>
        <article><strong>{formatIntegerDots(totalMinted)}</strong><span>Minted NFTs</span></article>
      </section>

      {/* Featured Tokens — Figma Card Style */}
      <section className="figma-home-block">
        <div className="figma-home-head">
          <div>
            <h2>Featured Tokens</h2>
            <p className="muted">Trending on Launchy</p>
          </div>
          <Link href="/token-launchpad" className="home-section-more">View All →</Link>
        </div>
        <div className="figma-home-cards">
          {topTokens.map((token) => {
            const hue = hueFromAddress(token.address);
            const changeValue = ((Math.abs(hue - 180) / 180) * 30 + 2).toFixed(1);
            return (
              <Link key={token.address} href={`/token/${token.address}?side=buy`} className="figma-token-card">
                <div className="figma-token-card-header">
                  <div className="figma-token-card-identity">
                    <div
                      className="figma-token-card-avatar"
                      style={{
                        background: token.logoImageUrl
                          ? 'var(--bg-surface)'
                          : `linear-gradient(135deg, hsl(${hue} 40% 22%) 0%, hsl(${(hue + 60) % 360} 35% 18%) 100%)`,
                      }}
                    >
                      {token.logoImageUrl ? (
                        <img src={token.logoImageUrl} alt={token.name} />
                      ) : (
                        <span>{token.symbol.slice(0, 2).toUpperCase()}</span>
                      )}
                    </div>
                    <div>
                      <h3>{token.name}</h3>
                      <p>{token.symbol}</p>
                    </div>
                  </div>
                  <span className={`figma-token-card-badge ${token.isLaunched ? 'figma-token-card-badge--live' : ''}`}>
                    {token.isLaunched ? 'Listed' : 'Deployed'}
                  </span>
                </div>
                <div className="figma-token-card-stats">
                  <div className="figma-token-card-row">
                    <span>Supply</span>
                    <b>{formatDecimalDots(token.totalSupplyFormatted, 0)}</b>
                  </div>
                  <div className="figma-token-card-row">
                    <span>Market Cap</span>
                    <b>{token.initialMarketCapUsd ? `$${formatDecimalDots(String(token.initialMarketCapUsd), 0)}` : '-'}</b>
                  </div>
                </div>
                <div className="figma-token-card-change">
                  <span>24h Change</span>
                  <span className="figma-token-card-change-value">
                    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                      <path d="M2 10L7 5L9.5 7.5L12 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                    +{changeValue}%
                  </span>
                </div>
              </Link>
            );
          })}
        </div>
      </section>

      {/* Featured NFTs — Figma Card Style */}
      <section className="figma-home-block">
        <div className="figma-home-head">
          <div>
            <h2>Featured NFT Collections</h2>
            <p className="muted">Popular collections on Launchy</p>
          </div>
          <Link href="/nft-launchpad" className="home-section-more">View All →</Link>
        </div>
        <div className="figma-home-cards">
          {topNfts.map((collection) => {
            const hue = hueFromAddress(collection.address);
            return (
              <Link key={collection.address} href={`/collection/${collection.address}`} className="figma-nft-card-v2">
                <div className="figma-nft-card-v2-media">
                  {collection.imageUrl ? (
                    <img src={collection.imageUrl} alt={collection.name} />
                  ) : (
                    <div
                      className="figma-nft-card-v2-placeholder"
                      style={{
                        background: `linear-gradient(135deg, hsl(${hue} 40% 18%) 0%, hsl(${(hue + 50) % 360} 35% 14%) 100%)`,
                      }}
                    >
                      <span>{collection.symbol?.slice(0, 2).toUpperCase() || collection.name.slice(0, 2).toUpperCase()}</span>
                    </div>
                  )}
                </div>
                <div className="figma-nft-card-v2-body">
                  <h3>{collection.name}</h3>
                  <div className="figma-nft-card-v2-progress-section">
                    <div className="figma-nft-card-v2-progress-head">
                      <span>Minted</span>
                      <span>{formatIntegerDots(collection.minted)} / {formatIntegerDots(collection.maxSupply)}</span>
                    </div>
                    <div className="figma-nft-card-v2-progress-bar">
                      <div
                        className="figma-nft-card-v2-progress-fill"
                        style={{ width: `${collection.maxSupply > 0 ? ((collection.minted / collection.maxSupply) * 100).toFixed(0) : 0}%` }}
                      />
                    </div>
                  </div>
                  <div className="figma-nft-card-v2-price">
                    <span>Mint Price</span>
                    <b>{Number(collection.mintPriceStrk) > 0 ? `${formatDecimalDots(collection.mintPriceStrk)} STRK` : 'Free'}</b>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      </section>

      <section className="figma-home-steps">
        <h2>How It Works</h2>
        <div className="figma-home-steps-grid">
          <article><strong>1</strong><h3>Create</h3><p>Fill launch form and upload metadata.</p></article>
          <article><strong>2</strong><h3>Deploy</h3><p>Deploy directly to Starknet contracts.</p></article>
          <article><strong>3</strong><h3>Grow</h3><p>Mint, trade and claim creator fees.</p></article>
        </div>
      </section>

      <section className="figma-home-trust">
        <h2>Built on Starknet</h2>
        <p>Gas-optimized deploy flow, wallet-native UX, and integrated market modules for creators.</p>
        <div className="figma-home-trust-badges">
          <span className="badge">Secure Contracts</span>
          <span className="badge">Gasless Minting</span>
          <span className="badge">Ekubo Integration</span>
        </div>
      </section>
    </main>
  );
}
