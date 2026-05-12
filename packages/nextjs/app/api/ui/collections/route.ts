import { NextResponse } from 'next/server';
import { loadCollectionsPayload } from '~~/lib/server/ui-data';

export const revalidate = 30;

export async function GET() {
  const payload = await loadCollectionsPayload();
  return NextResponse.json(payload);
}
