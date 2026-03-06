import Link from 'next/link';
import { formatDecimalDots } from '~~/lib/format';
import { shortAddress } from '~~/lib/starknet/address';
import type { TokenLaunchRecord } from '~~/lib/token-launchpad/types';

function hueFromAddress(address: string) {
  let hash = 0;
  for (let i = 2; i < address.length; i += 1) hash = (hash * 31 + address.charCodeAt(i)) % 360;
  return hash;
}

export function TokenCard({ token, compact = false }: { token: TokenLaunchRecord; compact?: boolean }) {
  const hue = hueFromAddress(token.address);
  const ownerShort = shortAddress(token.owner);

  return (
    <article className={`launch-card ${compact ? 'launch-card-compact' : ''}`}>
      <div
        className="launch-cover token-cover"
        style={{
          background: `linear-gradient(135deg, hsl(${hue} 74% 54%) 0%, hsl(${(hue + 64) % 360} 79% 42%) 100%)`,
        }}
      >
        {token.logoImageUrl ? (
          <img className="launch-cover-image" src={token.logoImageUrl} alt={`${token.name} logo`} />
        ) : (
          <span className="token-fallback-logo">{token.symbol.slice(0, 3).toUpperCase()}</span>
        )}
        <span className="launch-model">{token.isLaunched ? 'LIVE' : 'DEPLOYED'}</span>
      </div>

      <div className="launch-content">
        <div className="launch-head">
          <h3>{token.name}</h3>
          <span className="launch-symbol">{token.symbol}</span>
        </div>
        <p className="launch-meta">{ownerShort}</p>
        <div className="launch-stats">
          <span>Supply <b>{formatDecimalDots(token.totalSupplyFormatted, 0)}</b></span>
          <span>Block <b>{token.createdAtBlock ?? '-'}</b></span>
        </div>
        <div className="launch-actions">
          <Link href={`/token/${token.address}`}>
            <button>{compact ? 'Open' : 'Open Token'}</button>
          </Link>
        </div>
      </div>
    </article>
  );
}
