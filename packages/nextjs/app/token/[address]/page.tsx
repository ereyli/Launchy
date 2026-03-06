import Link from 'next/link';
import { notFound } from 'next/navigation';
import { CopyButton } from '~~/components/copy-button';
import { TokenPriceChart } from '~~/components/token-price-chart';
import { TokenLaunchWizard } from '~~/components/token-launch-wizard';
import { TokenTradePanel } from '~~/components/token-trade-panel';
import { env } from '~~/lib/config';
import { formatDecimalDots } from '~~/lib/format';
import { canonicalAddress, checksumAddress, sameAddress, shortAddress } from '~~/lib/starknet/address';
import { fetchTokenByAddress } from '~~/lib/token-launchpad/tokens';

export default async function TokenDetailsPage({
  params,
  searchParams,
}: {
  params: Promise<{ address: string }>;
  searchParams?: Promise<{ side?: string }>;
}) {
  const { address } = await params;
  const resolvedSearch = searchParams ? await searchParams : undefined;
  const defaultSide = resolvedSearch?.side === 'sell' ? 'sell' : 'buy';
  const fallbackQuoteToken = canonicalAddress(
    env.NEXT_PUBLIC_STRK_ADDRESS || '0x04718f5a0fc34cc1af16a1cdee98ffb20c31f5cd61d6ab07201858f4287c938d',
  );

  let token;
  try {
    token = await fetchTokenByAddress(address);
  } catch {
    notFound();
  }

  const tokenAddress = canonicalAddress(token.address);
  const tokenOwner = checksumAddress(token.owner);
  const quoteTokenForTrade = canonicalAddress(token.launchData?.quoteToken || fallbackQuoteToken);
  const canShowTrade = token.isLaunched;
  const tokenBig = BigInt(tokenAddress);
  const quoteBig = BigInt(quoteTokenForTrade);
  const poolKey = token.launchData
    ? {
      token0: tokenBig < quoteBig ? tokenAddress : quoteTokenForTrade,
      token1: tokenBig < quoteBig ? quoteTokenForTrade : tokenAddress,
      fee: BigInt(token.launchData.fee).toString(),
      tickSpacing: BigInt(token.launchData.tickSpacing).toString(),
      extension: '0x0',
    }
    : undefined;

  return (
    <main className="grid">
      <div className="figma-back-link">
        <Link href="/token-launchpad">
          <button className="ghost-button">← Back to Launchpad</button>
        </Link>
      </div>

      <section className="hero hero-ultra token-hero-premium">
        <span className="hero-kicker">Token Launchpad</span>
        <h1>{token.name}</h1>
        <p className="lead">Trade and track this token directly from your launchpad.</p>
        {token.logoImageUrl ? (
          <img
            src={token.logoImageUrl}
            alt={`${token.name} logo`}
            className="token-detail-logo"
          />
        ) : null}
        <div className="badges">
          <span className="badge">{token.symbol}</span>
        </div>
      </section>

      <section className="figma-panel token-detail-header-card">
        <h2>Token Overview</h2>
        <div className="compact-meta-grid">
          <article className="compact-meta-item">
            <span className="muted">Supply</span>
            <strong>{formatDecimalDots(token.totalSupplyFormatted, 0)}</strong>
          </article>
          <article className="compact-meta-item">
            <span className="muted">Owner</span>
            <div className="inline-row">
              <strong className="mono">{shortAddress(tokenOwner)}</strong>
              <CopyButton value={tokenOwner} />
            </div>
          </article>
          <article className="compact-meta-item">
            <span className="muted">Token</span>
            <div className="inline-row">
              <strong className="mono">{shortAddress(tokenAddress)}</strong>
              <CopyButton value={checksumAddress(tokenAddress)} />
            </div>
          </article>
        </div>
      </section>

      {!token.isLaunched ? (
        <TokenLaunchWizard
          tokenAddress={tokenAddress}
          strkAddress={fallbackQuoteToken}
        />
      ) : null}

      {canShowTrade ? (
        <div className="figma-detail-grid">
          <div className="figma-detail-main">
            <TokenPriceChart
              tokenAddress={tokenAddress}
              quoteTokenAddress={quoteTokenForTrade}
              tokenSymbol={token.symbol}
              totalSupply={token.totalSupplyFormatted}
              quoteTokenSymbol={sameAddress(quoteTokenForTrade, fallbackQuoteToken) ? 'STRK' : 'QUOTE'}
              poolKey={poolKey}
            />
          </div>
          <div className="figma-detail-side">
            <TokenTradePanel
              tokenAddress={tokenAddress}
              quoteTokenAddress={quoteTokenForTrade}
              quoteTokenSymbol={sameAddress(quoteTokenForTrade, fallbackQuoteToken) ? 'STRK' : 'QUOTE'}
              tokenSymbol={token.symbol}
              defaultSide={defaultSide}
              poolKey={poolKey}
            />
          </div>
        </div>
      ) : null}

      {canShowTrade && !token.launchData ? (
        <section className="panel">
          <p className="muted">Pool data is syncing. You can still open the trade panel now.</p>
        </section>
      ) : null}
    </main>
  );
}
