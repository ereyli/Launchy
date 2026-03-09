export function getSiteUrl() {
  const raw = process.env.NEXT_PUBLIC_SITE_URL || process.env.SITE_URL || 'https://starklaunchy.fun';
  return raw.replace(/\/$/, '');
}

export function toAbsoluteUrl(url: string) {
  if (/^https?:\/\//i.test(url)) return url;
  return new URL(url.startsWith('/') ? url : `/${url}`, getSiteUrl()).toString();
}
