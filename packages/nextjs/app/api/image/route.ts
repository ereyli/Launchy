import { NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function isAllowedImageUrl(value: string) {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' || url.protocol === 'http:';
  } catch {
    return false;
  }
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const target = searchParams.get('url')?.trim() || '';

  if (!target || !isAllowedImageUrl(target)) {
    return NextResponse.json({ error: 'Invalid image URL.' }, { status: 400 });
  }

  const upstream = await fetch(target, {
    cache: 'force-cache',
    next: { revalidate: 3600 },
    headers: {
      accept: 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
      'user-agent': 'LaunchyImageProxy/1.0',
    },
  });

  if (!upstream.ok || !upstream.body) {
    return NextResponse.json({ error: `Image fetch failed with status ${upstream.status}.` }, { status: 502 });
  }

  const contentType = upstream.headers.get('content-type') || 'image/*';

  return new NextResponse(upstream.body, {
    status: 200,
    headers: {
      'content-type': contentType,
      'cache-control': 'public, max-age=3600, s-maxage=3600, stale-while-revalidate=86400',
    },
  });
}
