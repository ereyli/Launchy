import { addAddressPadding, getChecksumAddress, validateAndParseAddress } from 'starknet';

function fallbackCanonical(address: string) {
  if (!address) return '';
  const value = address.trim();
  // Some providers return felt addresses as decimal strings.
  if (/^\d+$/.test(value)) {
    return `0x${BigInt(value).toString(16)}`;
  }
  if (!value.startsWith('0x')) return value;
  return `0x${BigInt(value).toString(16)}`;
}

export function canonicalAddress(address: string) {
  if (!address) return '';
  try {
    const parsed = validateAndParseAddress(address);
    return `0x${BigInt(parsed).toString(16)}`;
  } catch {
    return fallbackCanonical(address);
  }
}

export function sameAddress(a: string, b: string) {
  try {
    return canonicalAddress(a) === canonicalAddress(b);
  } catch {
    return (a || '').toLowerCase() === (b || '').toLowerCase();
  }
}

export function paddedAddress(address: string) {
  try {
    return addAddressPadding(canonicalAddress(address));
  } catch {
    return fallbackCanonical(address);
  }
}

export function checksumAddress(address: string) {
  try {
    return getChecksumAddress(paddedAddress(address));
  } catch {
    return fallbackCanonical(address);
  }
}

export function shortAddress(address: string, start = 8, end = 4) {
  const normalized = checksumAddress(address);
  if (normalized.length <= start + end + 3) return normalized;
  return `${normalized.slice(0, start)}...${normalized.slice(-end)}`;
}
