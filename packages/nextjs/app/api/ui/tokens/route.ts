import { NextResponse } from 'next/server';
import { loadTokensListPayload } from '~~/lib/server/ui-data';

export const revalidate = 30;

export async function GET() {
  const payload = await loadTokensListPayload();
  return NextResponse.json(payload);
}
