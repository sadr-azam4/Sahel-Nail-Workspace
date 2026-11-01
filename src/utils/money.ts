// ---------------------------------------------------------------------------
// Money utilities — validated integer Toman everywhere.
// Floating point never touches monetary arithmetic: inputs are parsed to
// integers and all totals are computed with integer math.
// ---------------------------------------------------------------------------

import { formatNumberFa, normalizeDigits } from './jalali';

export type ParseAmountError =
  | 'empty'
  | 'invalid'
  | 'negative'
  | 'too-large';

export const AMOUNT_ERROR_TEXT: Record<ParseAmountError, string> = {
  empty: 'مبلغ را وارد کنید',
  invalid: 'مبلغ نامعتبر است',
  negative: 'مبلغ نمی‌تواند منفی باشد',
  'too-large': 'مبلغ بیش از حد مجاز است',
};

export type ParseAmountResult =
  | { ok: true; value: number }
  | { ok: false; error: ParseAmountError };

const MAX_AMOUNT = 1e12; // sanity guard

/** Accepts Persian/Latin digits, "٬" and "," separators and spaces. */
export function parseAmount(raw: string | number): ParseAmountResult {
  const s = normalizeDigits(String(raw)).replace(/[\u066C,\s\u200f\u200e]/g, '');
  if (!s) return { ok: false, error: 'empty' };
  if (!/^-?\d+$/.test(s)) return { ok: false, error: 'invalid' };
  const v = Number(s);
  if (!Number.isFinite(v)) return { ok: false, error: 'invalid' };
  if (v < 0) return { ok: false, error: 'negative' };
  if (v > MAX_AMOUNT) return { ok: false, error: 'too-large' };
  return { ok: true, value: v }; // integer by regex
}

export function isNonNegativeInteger(v: unknown): v is number {
  return typeof v === 'number' && Number.isInteger(v) && v >= 0;
}

/** "۴۵۰٬۰۰۰ تومان" */
export function formatToman(value: number, currencyLabel = 'تومان'): string {
  return `${formatNumberFa(value)} ${currencyLabel}`.trim();
}

export type DiscountError = 'negative' | 'pct-range' | 'exceeds-subtotal';

export const DISCOUNT_ERROR_TEXT: Record<DiscountError, string> = {
  negative: 'تخفیف نمی‌تواند منفی باشد',
  'pct-range': 'درصد تخفیف باید بین ۰ تا ۱۰۰ باشد',
  'exceeds-subtotal': 'تخفیف نمی‌تواند از مبلغ کل بیشتر باشد',
};

export function resolveDiscount(
  subtotal: number,
  discount: number,
  isPercent: boolean,
): { ok: true; value: number } | { ok: false; error: DiscountError } {
  if (!Number.isFinite(discount) || discount < 0) return { ok: false, error: 'negative' };
  let value: number;
  if (isPercent) {
    if (discount > 100) return { ok: false, error: 'pct-range' };
    // integer floor keeps money math exact
    value = Math.floor((subtotal * discount) / 100);
  } else {
    if (!Number.isInteger(discount)) return { ok: false, error: 'negative' };
    value = discount;
  }
  if (value > subtotal) return { ok: false, error: 'exceeds-subtotal' };
  return { ok: true, value };
}

export interface TotalsResult {
  subtotal: number;
  discountValue: number;
  finalPrice: number;
}

export function computeTotals(
  lines: Array<{ unitPrice: number; quantity: number }>,
  discount: number,
  isPercent: boolean,
): { ok: true; totals: TotalsResult } | { ok: false; error: DiscountError } {
  // integer math only — unitPrice and quantity are integers
  const subtotal = lines.reduce((sum, l) => sum + l.unitPrice * l.quantity, 0);
  const res = resolveDiscount(subtotal, discount, isPercent);
  if (!res.ok) return res;
  return {
    ok: true,
    totals: { subtotal, discountValue: res.value, finalPrice: subtotal - res.value },
  };
}
