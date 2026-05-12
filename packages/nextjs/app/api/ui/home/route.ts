import { NextResponse } from 'next/server';
import { loadHomePayload } from '~~/lib/server/ui-data';

export const revalidate = 30;

export async function GET() {
  const payload = await loadHomePayload();
  return NextResponse.json(payload);
}
