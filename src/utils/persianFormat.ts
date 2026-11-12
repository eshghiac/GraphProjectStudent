const PERSIAN_DIGITS = ['۰', '۱', '۲', '۳', '۴', '۵', '۶', '۷', '۸', '۹'];

export function toPersianDigits(input: string | number | undefined | null): string {
  if (input === undefined || input === null) return '';
  return String(input).replace(/\d/g, (digit) => PERSIAN_DIGITS[Number(digit)] ?? digit);
}

export function formatZoomPercent(zoom: number): string {
  return `${toPersianDigits(Math.round(zoom * 100))}٪`;
}
