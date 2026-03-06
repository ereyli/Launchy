import { NextResponse } from 'next/server';
import { env } from '~~/lib/config';

export async function POST() {
  if (!env.PINATA_JWT) {
    return NextResponse.json({ error: 'PINATA_JWT missing' }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    message: 'Use POST /api/pinata/upload for server-side Pinata pinning.',
  });
}
