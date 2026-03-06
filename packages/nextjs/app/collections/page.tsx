import { NftLaunchpadView } from '~~/components/figma/nft-launchpad-view';
import { fetchLaunchpadData } from '~~/lib/launchpad/collections';

export const dynamic = 'force-dynamic';

export default async function CollectionsPage() {
  const data = await fetchLaunchpadData();

  return (
    <main className="figma-nft-page">
      <section className="figma-nft-page-header">
        <h1>NFT Launchpad</h1>
        <p>Discover and mint NFT collections on Starknet</p>
      </section>
      <NftLaunchpadView items={data.collections} />
    </main>
  );
}
