import { CollectionsPageClient } from '~~/components/page-clients/collections-page-client';

export const revalidate = 60;

export default function CollectionsPage() {
  return <CollectionsPageClient />;
}
