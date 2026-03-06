import { NextResponse } from 'next/server';
import { env } from '~~/lib/config';

export const dynamic = 'force-dynamic';

const AVNU_MAINNET_PAYMASTER_URL = 'https://starknet.paymaster.avnu.fi';

function buildTargetUrl(request: Request) {
  const incoming = new URL(request.url);
  const target = new URL(AVNU_MAINNET_PAYMASTER_URL);
  target.search = incoming.search;
  return target;
}

async function proxyPaymaster(request: Request) {
  const apiKey = env.AVNU_API_KEY.trim();
  if (!apiKey) {
    return NextResponse.json(
      { error: 'AVNU_API_KEY is not configured on the server.' },
      { status: 503 },
    );
  }

  const contentType = request.headers.get('content-type') || 'application/json';
  const body = request.method === 'GET' || request.method === 'HEAD' ? undefined : await request.text();

  const response = await fetch(buildTargetUrl(request), {
    method: request.method,
    headers: {
      'content-type': contentType,
      accept: 'application/json',
      'x-paymaster-api-key': apiKey,
    },
    body,
    cache: 'no-store',
  });

  return new NextResponse(response.body, {
    status: response.status,
    headers: {
      'content-type': response.headers.get('content-type') || 'application/json',
      'cache-control': 'no-store',
    },
  });
}

export async function POST(request: Request) {
  return proxyPaymaster(request);
}

export async function GET(request: Request) {
  return proxyPaymaster(request);
}
