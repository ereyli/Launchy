import { CreatePageClient } from '~~/components/page-clients/create-page-client';

type SearchParams = {
  type?: string;
};

export const revalidate = 60;

export default async function CreatePage({ searchParams }: { searchParams?: Promise<SearchParams> }) {
  const params = (await searchParams) || {};
  const initialType = params.type === 'token' ? 'token' : 'nft';

  return <CreatePageClient initialType={initialType} />;
}
