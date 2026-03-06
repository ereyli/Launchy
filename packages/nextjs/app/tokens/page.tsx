import { TokensPageClient } from '~~/components/page-clients/tokens-page-client';

export const revalidate = 60;

export default function TokensPage() {
  return <TokensPageClient />;
}
