import 'server-only';

type RateEntry = {
  count: number;
  resetAt: number;
};

const rateBuckets = new Map<string, RateEntry>();

export class RouteGuardError extends Error {
  status: number;

  constructor(message: string, status = 400) {
    super(message);
    this.status = status;
  }
}

function requestOrigin(request: Request) {
  const originHeader = request.headers.get('origin');
  if (originHeader) {
    try {
      return new URL(originHeader).origin;
    } catch {
      throw new RouteGuardError('Invalid Origin header.', 403);
    }
  }

  const refererHeader = request.headers.get('referer');
  if (refererHeader) {
    try {
      return new URL(refererHeader).origin;
    } catch {
      throw new RouteGuardError('Invalid Referer header.', 403);
    }
  }

  throw new RouteGuardError('Cross-site or non-browser mutation blocked.', 403);
}

export function assertSameOrigin(request: Request) {
  const expectedOrigin = new URL(request.url).origin;
  const actualOrigin = requestOrigin(request);
  if (actualOrigin !== expectedOrigin) {
    throw new RouteGuardError('Cross-origin mutation blocked.', 403);
  }
}

export function readClientIp(request: Request) {
  const forwardedFor = request.headers.get('x-forwarded-for');
  if (forwardedFor) {
    return forwardedFor.split(',')[0]?.trim() || 'unknown';
  }
  return request.headers.get('x-real-ip')?.trim() || 'unknown';
}

export function assertRateLimit(
  request: Request,
  options: {
    key: string;
    limit: number;
    windowMs: number;
  },
) {
  const now = Date.now();
  const bucketKey = `${options.key}:${readClientIp(request)}`;
  const current = rateBuckets.get(bucketKey);
  if (!current || current.resetAt <= now) {
    rateBuckets.set(bucketKey, { count: 1, resetAt: now + options.windowMs });
    return;
  }
  if (current.count >= options.limit) {
    throw new RouteGuardError('Too many requests. Please retry later.', 429);
  }
  current.count += 1;
  rateBuckets.set(bucketKey, current);
}

export function assertImageUpload(file: File, maxBytes: number) {
  if (!(file instanceof File)) {
    throw new RouteGuardError('Image file is required.', 400);
  }
  if (!file.type.startsWith('image/')) {
    throw new RouteGuardError('Only image files are supported.', 400);
  }
  if (file.size === 0) {
    throw new RouteGuardError('Uploaded image is empty.', 400);
  }
  if (file.size > maxBytes) {
    throw new RouteGuardError(`Image exceeds ${Math.floor(maxBytes / (1024 * 1024))}MB limit.`, 413);
  }
}

export function assertReasonableTokenText(value: string, field: string, maxLen: number) {
  const trimmed = value.trim();
  if (!trimmed) {
    throw new RouteGuardError(`${field} is required.`, 400);
  }
  if (trimmed.length > maxLen) {
    throw new RouteGuardError(`${field} is too long.`, 400);
  }
}

export function assertCidLike(value: string) {
  const cid = value.trim();
  if (!/^[a-zA-Z0-9]+$/.test(cid) || cid.length < 20 || cid.length > 120) {
    throw new RouteGuardError('Invalid IPFS CID.', 400);
  }
}
