import { NextResponse } from 'next/server';
import { fetchLaunchpadData } from '~~/lib/launchpad/collections';

export const revalidate = 60;

export async function GET() {
  const data = await fetchLaunchpadData();
  return NextResponse.json(data);
}
