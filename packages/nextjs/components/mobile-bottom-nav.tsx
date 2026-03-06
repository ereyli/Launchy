'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

type NavItem = {
  label: string;
  href: string;
  icon: React.ReactNode;
  highlight?: boolean;
};

function HomeIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M3 11.5L12 4l9 7.5" />
      <path d="M5.5 10.5V20h13V10.5" />
    </svg>
  );
}

function TokenIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="12" cy="12" r="8" />
      <path d="M12 7v10" />
      <path d="M9 10h6" />
      <path d="M9 14h6" />
    </svg>
  );
}

function NftIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <rect x="4" y="5" width="16" height="14" rx="2" />
      <circle cx="9" cy="10" r="1.3" />
      <path d="M20 16l-5.5-5.5L8 17" />
    </svg>
  );
}

function ProfileIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="12" cy="8" r="3.2" />
      <path d="M5.5 19c1.6-3 4-4.5 6.5-4.5S17 16 18.5 19" />
    </svg>
  );
}

function PlusIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 5v14" />
      <path d="M5 12h14" />
    </svg>
  );
}

export function MobileBottomNav() {
  const pathname = usePathname();
  const items: NavItem[] = [
    { label: 'Home', href: '/', icon: <HomeIcon /> },
    { label: 'Tokens', href: '/token-launchpad', icon: <TokenIcon /> },
    { label: 'Create', href: '/create', icon: <PlusIcon />, highlight: true },
    { label: 'NFTs', href: '/nft-launchpad', icon: <NftIcon /> },
    { label: 'Profile', href: '/profile', icon: <ProfileIcon /> },
  ];

  return (
    <nav className="mobile-bottom-nav" aria-label="Mobile navigation">
      <div className="mobile-bottom-nav-shell">
        {items.map((item) => {
          const active = pathname === item.href;
          const cls = [
            'mobile-bottom-nav-item',
            active ? 'mobile-bottom-nav-item-active' : '',
            item.highlight ? 'mobile-bottom-nav-item-create' : '',
          ].filter(Boolean).join(' ');
          const iconCls = [
            'mobile-bottom-nav-icon',
            item.highlight ? 'mobile-bottom-nav-icon-create' : '',
          ].filter(Boolean).join(' ');
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cls}
              suppressHydrationWarning
            >
              <span className={iconCls}>
                {item.icon}
              </span>
              <span className="mobile-bottom-nav-label">{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
