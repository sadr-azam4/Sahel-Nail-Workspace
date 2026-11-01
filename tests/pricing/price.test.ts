import { describe, expect, it } from 'vitest';
import {
  AMOUNT_ERROR_TEXT, computeTotals, formatToman, parseAmount, resolveDiscount,
} from '../../src/utils/money';

describe('parseAmount (integer Toman)', () => {
  it('parses plain and Persian digits', () => {
    expect(parseAmount('450000')).toEqual({ ok: true, value: 450000 });
    expect(parseAmount('۴۵۰٬۰۰۰')).toEqual({ ok: true, value: 450000 });
    expect(parseAmount('1,250,000')).toEqual({ ok: true, value: 1250000 });
    expect(parseAmount('۵')).toEqual({ ok: true, value: 5 });
  });

  it('rejects empty / invalid input', () => {
    expect(parseAmount('')).toEqual({ ok: false, error: 'empty' });
    expect(parseAmount('   ')).toEqual({ ok: false, error: 'empty' });
    expect(parseAmount('12.5')).toEqual({ ok: false, error: 'invalid' });
    expect(parseAmount('1e5')).toEqual({ ok: false, error: 'invalid' });
    expect(parseAmount('abc')).toEqual({ ok: false, error: 'invalid' });
  });

  it('rejects negative values (incl. Persian minus digits)', () => {
    expect(parseAmount('-5')).toEqual({ ok: false, error: 'negative' });
    expect(parseAmount('-۱۰')).toEqual({ ok: false, error: 'negative' });
  });

  it('rejects oversized values', () => {
    expect(parseAmount('2000000000000')).toEqual({ ok: false, error: 'too-large' });
  });

  it('has Persian error text for every code', () => {
    for (const code of ['empty', 'invalid', 'negative', 'too-large'] as const) {
      expect(AMOUNT_ERROR_TEXT[code].length).toBeGreaterThan(3);
    }
  });
});

describe('formatToman', () => {
  it('formats with grouping and currency label', () => {
    expect(formatToman(1250000)).toBe('۱٬۲۵۰٬۰۰۰ تومان');
    expect(formatToman(0)).toBe('۰ تومان');
  });
});

describe('discount resolution', () => {
  it('percent discount floors to integer Toman', () => {
    expect(resolveDiscount(999, 10, true)).toEqual({ ok: true, value: 99 });
  });

  it('rejects percent > 100', () => {
    expect(resolveDiscount(1000, 150, true)).toEqual({ ok: false, error: 'pct-range' });
    expect(resolveDiscount(1000, 101, true)).toEqual({ ok: false, error: 'pct-range' });
  });

  it('rejects discount exceeding subtotal', () => {
    expect(resolveDiscount(1000, 2000, false)).toEqual({ ok: false, error: 'exceeds-subtotal' });
  });

  it('rejects negative', () => {
    expect(resolveDiscount(1000, -1, false)).toEqual({ ok: false, error: 'negative' });
  });

  it('allows exact subtotal discount', () => {
    expect(resolveDiscount(1000, 1000, false)).toEqual({ ok: true, value: 1000 });
  });
});

describe('computeTotals', () => {
  const lines = [
    { unitPrice: 500000, quantity: 2 },
    { unitPrice: 250000, quantity: 1 },
  ];

  it('sums integer subtotals', () => {
    const r = computeTotals(lines, 0, false);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.totals.subtotal).toBe(1250000);
  });

  it('applies percent discount', () => {
    const r = computeTotals(lines, 10, true);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.totals.discountValue).toBe(125000);
      expect(r.totals.finalPrice).toBe(1125000);
    }
  });

  it('applies amount discount', () => {
    const r = computeTotals(lines, 300000, false);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.totals.finalPrice).toBe(950000);
  });

  it('fails on invalid discount', () => {
    expect(computeTotals(lines, 1300000, false).ok).toBe(false);
    expect(computeTotals(lines, 101, true).ok).toBe(false);
  });

  it('handles empty lines', () => {
    const r = computeTotals([], 0, false);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.totals.finalPrice).toBe(0);
  });
});
