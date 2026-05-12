import { ProfilePageClient } from '~~/components/page-clients/profile-page-client';
import { EMPTY_PROFILE_PAYLOAD, loadProfilePayload } from '~~/lib/server/ui-data';

export const revalidate = 60;

export default async function ProfilePage() {
  const initialData = await loadProfilePayload().catch(() => EMPTY_PROFILE_PAYLOAD);
  return <ProfilePageClient initialData={initialData} />;
}
