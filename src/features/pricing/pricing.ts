// ---------------------------------------------------------------------------
// Pure quote/pricing logic for the calculator. Integer Toman only.
// ---------------------------------------------------------------------------

import type { Quote, QuoteLine } from '../../types';
import { computeTotals, type TotalsResult } from '../../utils/money';
import { nowIso } from '../../utils/misc';

export interface QuoteDraftLine {
  serviceId?: number;
  name: string;
  unitPrice: number;
  quantity: number;
}

export type QuoteTotalsResult =
  | { ok: true; totals: TotalsResult }
  | { ok: false; error: 'negative' | 'pct-range' | 'exceeds-subtotal' };

export function quoteTotals(
  lines: QuoteDraftLine[],
  discount: number,
  isPercent: boolean,
): QuoteTotalsResult {
  return computeTotals(lines, discount, isPercent);
}

/**
 * Builds an immutable quote record. Lines are snapshotted (name + unit price
 * at quote time) so later catalog changes never alter existing quotes.
 */
export function buildQuote(
  lines: QuoteDraftLine[],
  totals: TotalsResult,
  meta: { customerId?: number; customerName?: string; currencyLabel: string },
): Quote {
  const snapLines: QuoteLine[] = lines.map((l) => ({
    serviceId: l.serviceId,
    name: l.name,
    unitPrice: l.unitPrice,
    quantity: l.quantity,
  }));
  return {
    customerId: meta.customerId,
    customerName: meta.customerName,
    lines: snapLines,
    subtotal: totals.subtotal,
    discount: totals.discountValue,
    finalPrice: totals.finalPrice,
    currencyLabel: meta.currencyLabel,
    createdAt: nowIso(),
  };
}
