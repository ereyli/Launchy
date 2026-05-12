import { CollectionsPageClient } from '~~/components/page-clients/collections-page-client';
import { EMPTY_COLLECTIONS_PAYLOAD, loadCollectionsPayload } from '~~/lib/server/ui-data';

export const revalidate = 60;

export default async function CollectionsPage() {
  const { collections } = await loadCollectionsPayload().catch(() => EMPTY_COLLECTIONS_PAYLOAD);
  return <CollectionsPageClient initialItems={collections} />;
}
