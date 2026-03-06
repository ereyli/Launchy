import { ProfilePageClient } from '~~/components/page-clients/profile-page-client';

export const revalidate = 60;

export default function ProfilePage() {
  return <ProfilePageClient />;
}
