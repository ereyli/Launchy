import { HomePageClient } from '~~/components/page-clients/home-page-client';

export const revalidate = 60;

export default function HomePage() {
  return <HomePageClient />;
}
