export function SiteFooter() {
  const year = new Date().getFullYear();
  return (
    <footer className="site-footer">
      <div className="site-footer-inner">
        <div className="site-footer-brand">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/launchy-logo.png" alt="Launchy" width={28} height={28} className="site-footer-logo" />
          <span>Launchy</span>
        </div>

        <nav className="site-footer-links" aria-label="Footer navigation">
          <a href="/">Home</a>
          <a href="/token-launchpad">Token Launchpad</a>
          <a href="/nft-launchpad">NFT Launchpad</a>
          <a href="/create">Create Project</a>
          <a href="/profile">My Profile</a>
        </nav>

        <div className="site-footer-meta">
          <p className="site-footer-built">
            Deploys on{' '}
            <a href="https://www.starknet.io" target="_blank" rel="noopener noreferrer">Starknet</a>
            {' '}·{' '}
            Trades via{' '}
            <a href="https://ekubo.org" target="_blank" rel="noopener noreferrer">Ekubo</a>
          </p>
          <p className="site-footer-copyright">
            &copy; {year} Launchy. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  );
}
