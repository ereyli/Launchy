'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import { WalletConnect } from '~~/components/wallet-connect';

const NAV_ITEMS = [
  { href: '/', label: 'Home' },
  { href: '/nft-launchpad', label: 'NFT Launchpad' },
  { href: '/token-launchpad', label: 'Token Launchpad' },
  { href: '/profile', label: 'Profile' },
];

export function SiteHeader({ networkLabel: _networkLabel }: { networkLabel: string }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  return (
    <header className="site-header">
      <div className="site-header-row">
        <Link href="/" className="site-brand" onClick={() => setOpen(false)}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/launchy-logo.png"
            alt="Launchy"
            className="site-brand-logo"
          />
          <span>Launchy</span>
        </Link>

        <nav className="site-nav" aria-label="Primary navigation">
          {NAV_ITEMS.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={pathname === item.href ? 'site-nav-active' : ''}
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="site-header-right">
          <div className="site-header-wallet-inline">
            <WalletConnect compact />
          </div>
          <button
            type="button"
            className="site-mobile-menu-btn"
            aria-label={open ? 'Close menu' : 'Open menu'}
            onClick={() => setOpen((prev) => !prev)}
          >
            {open ? '×' : '☰'}
          </button>
        </div>
      </div>

      {open ? (
        <nav className="site-mobile-nav" aria-label="Mobile navigation">
          {NAV_ITEMS.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={pathname === item.href ? 'site-nav-active' : ''}
              onClick={() => setOpen(false)}
            >
              {item.label}
            </Link>
          ))}
          <div className="site-mobile-wallet">
            <WalletConnect compact />
          </div>
        </nav>
      ) : null}
    </header>
  );
}
