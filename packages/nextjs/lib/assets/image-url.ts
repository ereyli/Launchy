export function proxiedImageUrl(url?: string | null) {
  const trimmed = url?.trim();
  if (!trimmed) return undefined;

  if (
    trimmed.startsWith('/') ||
    trimmed.startsWith('data:') ||
    trimmed.startsWith('blob:') ||
    trimmed.startsWith('/api/image?url=')
  ) {
    return trimmed;
  }

  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
    return `/api/image?url=${encodeURIComponent(trimmed)}`;
  }

  return trimmed;
}
