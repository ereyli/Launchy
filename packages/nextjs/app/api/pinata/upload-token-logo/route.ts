import { NextResponse } from 'next/server';
import { ipfsGatewayUrl, pinFileToIpfs } from '~~/lib/pinata/server';
import {
  assertImageUpload,
  assertRateLimit,
  assertReasonableTokenText,
  assertSameOrigin,
  RouteGuardError,
} from '~~/lib/server/mutation-guard';

function asString(value: unknown) {
  return typeof value === 'string' ? value.trim() : '';
}

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    assertRateLimit(request, { key: 'pinata-token-logo', limit: 10, windowMs: 10 * 60 * 1000 });

    const formData = await request.formData();
    const fileEntry = formData.get('file');
    const name = asString(formData.get('name')) || 'token';
    const symbol = asString(formData.get('symbol')) || 'TOKEN';
    const file = fileEntry as File;

    assertImageUpload(file, 2 * 1024 * 1024);
    assertReasonableTokenText(name, 'Name', 80);
    assertReasonableTokenText(symbol, 'Symbol', 20);

    const imageCid = await pinFileToIpfs(file, `${name}-${symbol}-logo`);

    return NextResponse.json({
      ok: true,
      imageCid,
      imageGatewayUrl: ipfsGatewayUrl(imageCid),
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Token logo upload failed.' },
      { status: error instanceof RouteGuardError ? error.status : 500 },
    );
  }
}
