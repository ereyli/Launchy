import { HomePageClient } from '~~/components/page-clients/home-page-client';
import { EMPTY_HOME_PAYLOAD, loadHomePayload } from '~~/lib/server/ui-data';

export const revalidate = 60;

export default async function HomePage() {
  const initialData = await loadHomePayload().catch(() => EMPTY_HOME_PAYLOAD);
  return <HomePageClient initialData={initialData} />;
}
