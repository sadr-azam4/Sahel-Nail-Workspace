import { useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { Minus, Plus, ReceiptText, Trash2 } from 'lucide-react';
import { db } from '../../database/db';
import { useToast } from '../../components/common/Toasts';
import { Dialog } from '../../components/common/Dialog';
import { EmptyState, Field, Segmented } from '../../components/common/UI';
import type { QuoteDraftLine } from './pricing';
import { buildQuote, quoteTotals } from './pricing';
import { formatToman, parseAmount, AMOUNT_ERROR_TEXT, DISCOUNT_ERROR_TEXT } from '../../utils/money';
import { toPersianDigits } from '../../utils/jalali';
import { cx, uid } from '../../utils/misc';
import { useSettings } from '../../hooks/useSettings';

type DiscountMode = 'percent' | 'amount';

interface ManualLine extends QuoteDraftLine {
  localId: string;
}

export function CalculatorPage() {
  const { toast } = useToast();
  const settings = useSettings();
  const services = useLiveQuery(() => db.services.filter((s) => s.active).toArray(), []);
  const quotes = useLiveQuery(
    () => db.quotes.orderBy('createdAt').reverse().limit(12).toArray(),
    [],
  );
  const clients = useLiveQuery(() => db.clients.filter((c) => !c.archivedAt).toArray(), []);

  const [qty, setQty] = useState<Record<number, number>>({});
  const [manualLines, setManualLines] = useState<ManualLine[]>([]);
  const [manualName, setManualName] = useState('');
  const [manualPrice, setManualPrice] = useState('');
  const [manualPriceError, setManualPriceError] = useState<string | null>(null);
  const [manualQty, setManualQty] = useState(1);
  const [discountInput, setDiscountInput] = useState('');
  const [discountMode, setDiscountMode] = useState<DiscountMode>('percent');
  const [saveDialog, setSaveDialog] = useState(false);
  const [customerId, setCustomerId] = useState('');
  const [busy, setBusy] = useState(false);

  const sortedServices = useMemo(
    () => [...(services ?? [])].sort((a, b) => a.name.localeCompare(b.name, 'fa')),
    [services],
  );

  const lines: QuoteDraftLine[] = useMemo(() => {
    const fromServices: QuoteDraftLine[] = Object.entries(qty)
      .filter(([, q]) => q > 0)
      .map((([idStr, q]): QuoteDraftLine | null => {
        const s = sortedServices.find((x) => x.id === Number(idStr));
        if (!s) return null;
        return { serviceId: s.id, name: s.name, unitPrice: s.defaultPrice, quantity: q };
      }))
      .filter((l): l is QuoteDraftLine => l !== null);
    return [...fromServices, ...manualLines];
  }, [qty, sortedServices, manualLines]);

  function addManualLine() {
    const name = manualName.trim();
    if (!name) {
      toast('شرح ردیف دلخواه را وارد کنید', 'error');
      return;
    }
    const price = parseAmount(manualPrice);
    if (!price.ok) {
      setManualPriceError(AMOUNT_ERROR_TEXT[price.error]);
      return;
    }
    setManualPriceError(null);
    setManualLines((prev) => [...prev, { localId: uid(), name, unitPrice: price.value, quantity: Math.max(1, manualQty) }]);
    setManualName('');
    setManualPrice('');
    setManualQty(1);
  }

  function setManualQuantity(localId: string, q: number) {
    setManualLines((prev) =>
      prev.map((l) => (l.localId === localId ? { ...l, quantity: Math.min(99, Math.max(1, q)) } : l)),
    );
  }

  const discountNum = (() => {
    const r = parseAmount(discountInput === '' ? '0' : discountInput);
    return r.ok ? r.value : -1; // -1 marks invalid input
  })();

  const totals = quoteTotals(lines, Math.max(0, discountNum), discountMode === 'percent');
  const ok = totals.ok && discountNum >= 0;
  const errorText = !totals.ok
    ? DISCOUNT_ERROR_TEXT[totals.error]
    : discountNum < 0
      ? AMOUNT_ERROR_TEXT.invalid
      : null;

  function setQuantity(id: number, q: number) {
    setQty((prev) => {
      const next = { ...prev };
      if (q <= 0) delete next[id];
      else next[id] = Math.min(99, q);
      return next;
    });
  }

  function reset() {
    setQty({});
    setManualLines([]);
    setManualName('');
    setManualPrice('');
    setManualQty(1);
    setDiscountInput('');
    setCustomerId('');
  }

  async function saveQuote() {
    if (!ok || busy) return;
    setBusy(true);
    try {
      const cid = customerId ? Number(customerId) : undefined;
      const client = cid !== undefined ? (clients ?? []).find((c) => c.id === cid) : undefined;
      const quote = buildQuote(lines, totals.totals, {
        customerId: cid,
        customerName: client?.name,
        currencyLabel: settings.currencyLabel,
      });
      await db.quotes.add(quote);
      setSaveDialog(false);
      reset();
      toast('پیش‌فاکتور ذخیره شد', 'success');
    } catch {
      toast('ذخیره پیش‌فاکتور ناموفق بود', 'error');
    } finally {
      setBusy(false);
    }
  }

  async function deleteQuote(id?: number) {
    if (id === undefined) return;
    await db.quotes.delete(id);
    toast('پیش‌فاکتور حذف شد');
  }

  return (
    <div>
      <div className="card">
        <h3 className="card-title">
          <ReceiptText size={17} /> انتخاب خدمات
        </h3>
        {sortedServices.length === 0 ? (
          <EmptyState icon={<ReceiptText size={34} />} text="برای محاسبه، ابتدا از «فهرست خدمات» خدمات را اضافه کنید." />
        ) : (
          <div className="chips">
            {sortedServices.map((s) => {
              const q = s.id !== undefined ? (qty[s.id] ?? 0) : 0;
              return (
                <button
                  key={s.id}
                  type="button"
                  className={cx('chip', q > 0 && 'active')}
                  onClick={() => setQuantity(s.id as number, q > 0 ? 0 : 1)}
                >
                  {s.name}
                  {q > 0 ? ` ×${toPersianDigits(q)}` : ''}
                </button>
              );
            })}
          </div>
        )}
      </div>

      <div className="card">
        <h3 className="card-title">
          <Plus size={17} /> ردیف دلخواه (خارج از فهرست)
        </h3>
        <p className="text-secondary" style={{ fontSize: 12.5, marginBottom: 10 }}>
          برای کارهای خاص مثل ترمیم یک ناخن یا خدمات جانبی که در فهرست نیست.
        </p>
        <div className="grid-2">
          <Field label="شرح ردیف">
            <input
              className="input"
              value={manualName}
              onChange={(e) => setManualName(e.target.value)}
              placeholder="مثلاً ترمیم یک ناخن"
            />
          </Field>
          <Field label="مبلغ (تومان)" error={manualPriceError ?? undefined}>
            <input
              className={'input' + (manualPriceError ? ' invalid' : '')}
              inputMode="numeric"
              value={manualPrice}
              onChange={(e) => {
                setManualPriceError(null);
                setManualPrice(e.target.value);
              }}
              placeholder="مثلاً ۸۰٬۰۰۰"
            />
          </Field>
        </div>
        <div className="row-between" style={{ marginTop: 4 }}>
          <div className="qty-stepper" aria-label="تعداد ردیف دلخواه">
            <button type="button" onClick={() => setManualQty((q) => Math.max(1, q - 1))} aria-label="کاهش">
              <Minus size={15} />
            </button>
            <span className="qty">{toPersianDigits(manualQty)}</span>
            <button type="button" onClick={() => setManualQty((q) => Math.min(99, q + 1))} aria-label="افزایش">
              <Plus size={15} />
            </button>
          </div>
          <button type="button" className="btn btn-ghost" onClick={addManualLine}>
            <Plus size={16} /> افزودن ردیف
          </button>
        </div>
      </div>

      {lines.length > 0 && (
        <div className="card">
          <h3 className="card-title">ردیف‌ها</h3>
          <div className="stack">
            {lines.map((l) => {
              const manual = 'localId' in l;
              const ml = l as ManualLine;
              return (
                <div key={manual ? ml.localId : l.serviceId} className="row-between">
                  <span style={{ fontSize: 14, flex: 1, minWidth: 0 }}>
                    {l.name}
                    <span className="text-secondary"> — {formatToman(l.unitPrice)}</span>
                  </span>
                  <div className="row" style={{ gap: 8 }}>
                    <div className="qty-stepper" aria-label={`تعداد ${l.name}`}>
                      <button
                        type="button"
                        onClick={() =>
                          manual
                            ? setManualQuantity(ml.localId, ml.quantity - 1)
                            : setQuantity(l.serviceId as number, (qty[l.serviceId as number] ?? 0) - 1)
                        }
                        aria-label="کاهش"
                      >
                        <Minus size={15} />
                      </button>
                      <span className="qty">{toPersianDigits(l.quantity)}</span>
                      <button
                        type="button"
                        onClick={() =>
                          manual
                            ? setManualQuantity(ml.localId, ml.quantity + 1)
                            : setQuantity(l.serviceId as number, (qty[l.serviceId as number] ?? 0) + 1)
                        }
                        aria-label="افزایش"
                      >
                        <Plus size={15} />
                      </button>
                    </div>
                    {manual && (
                      <button
                        type="button"
                        className="icon-btn"
                        style={{ width: 34, height: 34, color: 'var(--danger)' }}
                        onClick={() => setManualLines((prev) => prev.filter((x) => x.localId !== ml.localId))}
                        aria-label="حذف ردیف"
                      >
                        <Trash2 size={15} />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          <div className="divider" />

          <Field label="نوع تخفیف">
            <Segmented
              value={discountMode}
              onChange={(v) => {
                setDiscountMode(v);
              }}
              options={[
                { id: 'percent' as DiscountMode, label: 'درصد' },
                { id: 'amount' as DiscountMode, label: 'مبلغ (تومان)' },
              ]}
            />
          </Field>
          <Field
            label={discountMode === 'percent' ? 'درصد تخفیف' : 'مبلغ تخفیف (تومان)'}
            error={errorText ?? undefined}
          >
            <input
              className={'input' + (errorText ? ' invalid' : '')}
              inputMode="numeric"
              value={discountInput}
              onChange={(e) => {
                setDiscountInput(e.target.value);
              }}
              placeholder={discountMode === 'percent' ? 'مثلاً ۱۰' : 'مثلاً ۱۰۰٬۰۰۰'}
            />
          </Field>

          <div className="divider" />

          <div className="row-between" style={{ fontSize: 14 }}>
            <span className="text-secondary">جمع کل</span>
            <span>{formatToman(totals.ok ? totals.totals.subtotal : 0)}</span>
          </div>
          <div className="row-between" style={{ fontSize: 14, marginTop: 6 }}>
            <span className="text-secondary">تخفیف</span>
            <span style={{ color: 'var(--danger)' }}>−{formatToman(totals.ok ? totals.totals.discountValue : 0)}</span>
          </div>
          <div className="row-between" style={{ marginTop: 10, fontSize: 18, fontWeight: 700 }}>
            <span>قابل پرداخت</span>
            <span style={{ color: 'var(--primary)' }}>{formatToman(ok ? totals.totals.finalPrice : 0)}</span>
          </div>

          <div className="grid-2" style={{ marginTop: 14 }}>
            <button type="button" className="btn btn-ghost" onClick={reset}>
              شروع مجدد
            </button>
            <button
              type="button"
              className="btn btn-primary"
              disabled={!ok || lines.length === 0}
              onClick={() => setSaveDialog(true)}
            >
              ثبت پیش‌فاکتور
            </button>
          </div>
        </div>
      )}

      <div className="card">
        <h3 className="card-title">پیش‌فاکتورهای اخیر</h3>
        {(quotes ?? []).length === 0 ? (
          <EmptyState icon={<ReceiptText size={30} />} text="هنوز پیش‌فاکتوری ثبت نشده است." />
        ) : (
          <div className="stack">
            {(quotes ?? []).map((q) => (
              <div key={q.id} className="list-row">
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 500, fontSize: 14 }}>
                    {q.customerName || 'بدون مشتری'} — {formatToman(q.finalPrice, q.currencyLabel)}
                  </div>
                  <div className="text-secondary" style={{ fontSize: 12 }}>
                    {q.lines.map((l) => `${l.name} ×${toPersianDigits(l.quantity)}`).join('، ')}
                  </div>
                </div>
                <button
                  type="button"
                  className="icon-btn"
                  style={{ width: 36, height: 36, color: 'var(--danger)' }}
                  onClick={() => void deleteQuote(q.id)}
                  aria-label="حذف پیش‌فاکتور"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      <Dialog
        open={saveDialog}
        onClose={() => setSaveDialog(false)}
        title="ثبت پیش‌فاکتور"
        footer={
          <>
            <button type="button" className="btn btn-ghost" onClick={() => setSaveDialog(false)} disabled={busy}>
              انصراف
            </button>
            <button type="button" className="btn btn-primary" onClick={() => void saveQuote()} disabled={busy}>
              {busy ? 'در حال ذخیره…' : 'ذخیره'}
            </button>
          </>
        }
      >
        <p className="text-secondary" style={{ marginBottom: 12 }}>
          قیمت خدمات در همین لحظه به‌صورت ثابت در پیش‌فاکتور ثبت می‌شود و تغییر نرخ‌های بعدی روی آن اثری ندارد.
          جمع: {formatToman(totals.ok ? totals.totals.finalPrice : 0)}
        </p>
        <Field label="مشتری (اختیاری)">
          <select className="select" value={customerId} onChange={(e) => setCustomerId(e.target.value)}>
            <option value="">بدون مشتری</option>
            {(clients ?? []).map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </Field>
      </Dialog>
    </div>
  );
}
