function splitDecimalString(input: string) {
  const trimmed = input.trim();
  if (!trimmed) return null;
  const sign = trimmed.startsWith('-') ? '-' : '';
  const unsigned = sign ? trimmed.slice(1) : trimmed;
  if (!/^\d+(\.\d+)?$/.test(unsigned)) return null;
  const [wholeRaw, fractionRaw = ''] = unsigned.split('.');
  const whole = wholeRaw.replace(/^0+(?=\d)/, '') || '0';
  return {
    sign,
    whole,
    fraction: fractionRaw,
  };
}

function groupWithDots(whole: string) {
  return whole.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

export function formatIntegerDots(value: string | number | bigint) {
  const str = typeof value === 'string' ? value : value.toString();
  const sign = str.startsWith('-') ? '-' : '';
  const unsigned = sign ? str.slice(1) : str;
  const digits = unsigned.replace(/\D/g, '') || '0';
  return `${sign}${groupWithDots(digits.replace(/^0+(?=\d)/, '') || '0')}`;
}

export function formatDecimalDots(value: string | number | bigint, maxFractionDigits = 6) {
  const asString = typeof value === 'string' ? value : value.toString();
  const parts = splitDecimalString(asString);
  if (!parts) return asString;

  const groupedWhole = groupWithDots(parts.whole);
  if (!parts.fraction) return `${parts.sign}${groupedWhole}`;

  const clippedFraction = parts.fraction.slice(0, Math.max(0, maxFractionDigits)).replace(/0+$/, '');
  if (!clippedFraction) return `${parts.sign}${groupedWhole}`;
  return `${parts.sign}${groupedWhole},${clippedFraction}`;
}

export function normalizeIntegerInput(value: string) {
  const digits = value.replace(/\D/g, '');
  return digits.replace(/^0+(?=\d)/, '') || '0';
}
