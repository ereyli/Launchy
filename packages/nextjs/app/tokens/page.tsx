import { TokensPageClient } from '~~/components/page-clients/tokens-page-client';
import { EMPTY_TOKENS_PAYLOAD, loadTokensListPayload } from '~~/lib/server/ui-data';

export const revalidate = 60;

export default async function TokensPage() {
  const { items } = await loadTokensListPayload().catch(() => EMPTY_TOKENS_PAYLOAD);
  return <TokensPageClient initialItems={items} />;
}
