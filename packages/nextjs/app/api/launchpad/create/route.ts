import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  const body = await request.json();

  // Burada server-side validation + optional Starkzap server signer akisi olacak.
  return NextResponse.json({ ok: true, received: body });
}
