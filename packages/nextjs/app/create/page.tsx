import { CreateProjectShell } from '~~/components/create-project-shell';
import { env } from '~~/lib/config';
import { fetchLaunchpadData } from '~~/lib/launchpad/collections';

export const dynamic = 'force-dynamic';

type SearchParams = {
  type?: string;
};

export default async function CreatePage({ searchParams }: { searchParams?: Promise<SearchParams> }) {
  const params = (await searchParams) || {};
  const initialType = params.type === 'token' ? 'token' : 'nft';
  let deployFeeStrk = '0';
  let mintFeeStrk = '0';
  if (env.NEXT_PUBLIC_FACTORY_ADDRESS) {
    try {
      const data = await fetchLaunchpadData();
      deployFeeStrk = data.deployFeeStrk;
      mintFeeStrk = data.mintFeeStrk;
    } catch {
      // Leave fallback values when RPC is temporarily unavailable.
    }
  }

  return (
    <main className="grid">
      <section className="figma-page-hero">
        <h1>Create New Project</h1>
        <p>Launch your {initialType === 'token' ? 'token' : 'NFT collection'} on Starknet.</p>
      </section>
      <CreateProjectShell
        initialType={initialType}
        deployFeeStrk={deployFeeStrk}
        mintFeeStrk={mintFeeStrk}
        nftFactoryConfigured={Boolean(env.NEXT_PUBLIC_FACTORY_ADDRESS)}
        tokenFactoryConfigured={Boolean(env.NEXT_PUBLIC_TOKEN_FACTORY_ADDRESS)}
      />
    </main>
  );
}
