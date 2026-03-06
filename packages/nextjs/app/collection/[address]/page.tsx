import Link from 'next/link';
import { MintForm } from '~~/components/mint-form';
import { CopyButton } from '~~/components/copy-button';
import { formatDecimalDots, formatIntegerDots } from '~~/lib/format';
import { fetchCollectionByAddress, fetchLaunchpadData } from '~~/lib/launchpad/collections';
import { getPinataAlias } from '~~/lib/pinata/alias-store';
import { ipfsGatewayUrl } from '~~/lib/pinata/server';
import { checksumAddress } from '~~/lib/starknet/address';
import { notFound } from 'next/navigation';

export default async function CollectionPage({ params }: { params: Promise<{ address: string }> }) {
  const { address } = await params;
  let collection: Awaited<ReturnType<typeof fetchCollectionByAddress>>;
  let launchpad: Awaited<ReturnType<typeof fetchLaunchpadData>>;
  try {
    [collection, launchpad] = await Promise.all([
      fetchCollectionByAddress(address),
      fetchLaunchpadData(),
    ]);
  } catch {
    notFound();
  }
  const pinata = await getPinataAlias(collection.baseUri);
  const mintedPct = collection.maxSupply > 0 ? ((collection.minted / collection.maxSupply) * 100).toFixed(1) : '0.0';

  return (
    <main className="grid">
      <div className="figma-back-link">
        <Link href="/nft-launchpad">
          <button className="ghost-button">← Back to Launchpad</button>
        </Link>
      </div>

      <section className="figma-page-hero">
        <h1>{collection.name}</h1>
        <p>
          A unique collection with live minting stats and on-chain mint flow.
        </p>
      </section>

      <section className="hero hero-ultra collection-hero-premium">
        <span className="hero-kicker">Mint</span>
        <h2>Collection Stats</h2>
        <div className="compact-meta-grid">
          <article className="compact-meta-item">
            <span className="muted">Minted</span>
            <strong>{formatIntegerDots(collection.minted)}</strong>
          </article>
          <article className="compact-meta-item">
            <span className="muted">Remaining</span>
            <strong>{formatIntegerDots(Math.max(collection.maxSupply - collection.minted, 0))}</strong>
          </article>
          <article className="compact-meta-item">
            <span className="muted">Total supply</span>
            <strong>{formatIntegerDots(collection.maxSupply)}</strong>
          </article>
        </div>
        <div className="mint-progress-premium">
          <div className="mint-progress-head">
            <span>Mint progress</span>
            <strong>{mintedPct}%</strong>
          </div>
          <div className="launch-progress"><div className="launch-progress-bar" style={{ width: `${mintedPct}%` }} /></div>
          <small className="muted">
            {formatIntegerDots(collection.minted)} / {formatIntegerDots(collection.maxSupply)} minted
          </small>
        </div>
      </section>

      <section className="collection-mint-layout figma-detail-grid">
        <div className="figma-panel panel-overview collection-overview-card">
          {pinata ? (
            <img className="collection-image" src={ipfsGatewayUrl(pinata.imageCid)} alt={`${collection.name} cover`} />
          ) : (
            <div className="collection-image collection-image-placeholder">
              <span>{collection.symbol || collection.name}</span>
            </div>
          )}
          <div className="overview-fields">
            <div className="overview-field"><span>Name</span><strong>{collection.name}</strong></div>
            <div className="overview-field"><span>Symbol</span><strong>{collection.symbol}</strong></div>
            <div className="overview-field"><span>Mint price</span><strong>{formatDecimalDots(collection.mintPriceStrk)} STRK</strong></div>
            <div className="overview-field">
              <span>Contract</span>
              <div className="inline-row">
                <strong className="mono">{checksumAddress(collection.address).slice(0, 14)}...</strong>
                <CopyButton value={checksumAddress(collection.address)} />
              </div>
            </div>
          </div>
        </div>
        <div className="mint-side-single figma-detail-side figma-panel">
          <MintForm
            collectionAddress={collection.address}
            mintFeeStrk={launchpad.mintFeeStrk}
            mintPriceStrk={collection.mintPriceStrk}
            isFreeMintModel={collection.model === 'free'}
          />
        </div>
      </section>
    </main>
  );
}
