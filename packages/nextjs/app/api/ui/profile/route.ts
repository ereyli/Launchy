import { NextResponse } from 'next/server';
import { loadProfilePayload } from '~~/lib/server/ui-data';

export const revalidate = 30;

export async function GET() {
  const payload = await loadProfilePayload();
  return NextResponse.json(payload);
}
