import './globals.css';
import type { Metadata } from 'next';
import Script from 'next/script';
import { MobileBottomNav } from '~~/components/mobile-bottom-nav';
import { SiteHeader } from '~~/components/site-header';
import { getSiteUrl } from '~~/lib/site-url';

export const metadata: Metadata = {
  metadataBase: new URL(getSiteUrl()),
  title: 'Launchy | Deploy & Trade Tokens and NFTs on Starknet',
  description: 'All-in-one Starknet launchpad for deploying NFT collections and tokens with built-in on-chain trading via Ekubo DEX.',
  openGraph: {
    title: 'Launchy | Deploy & Trade on Starknet',
    description: 'All-in-one Starknet launchpad for deploying NFT collections and tokens with built-in on-chain trading.',
    images: [{ url: '/launchy.png', width: 512, height: 512 }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Launchy | Starknet Launchpad',
    description: 'Deploy & trade tokens and NFTs on Starknet.',
    images: ['/launchy.png'],
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const networkLabel = process.env.NEXT_PUBLIC_STARKNET_NETWORK === 'mainnet' ? 'Mainnet' : 'Sepolia';

  return (
    <html lang="en" suppressHydrationWarning>
      <body suppressHydrationWarning>
        <Script id="strip-keychainify-class" strategy="beforeInteractive">
          {`
            (() => {
              const CLASS_NAME = 'keychainify-checked';
              const clean = () => {
                const nodes = document.getElementsByClassName(CLASS_NAME);
                while (nodes.length > 0) nodes[0].classList.remove(CLASS_NAME);
              };
              clean();
              new MutationObserver(clean).observe(document.documentElement, {
                subtree: true,
                childList: true,
                attributes: true,
                attributeFilter: ['class'],
              });
            })();
          `}
        </Script>
        <div className="container shell">
          <SiteHeader networkLabel={networkLabel} />
          <div className="page-flow">{children}</div>
        </div>
        <MobileBottomNav />
      </body>
    </html>
  );
}
