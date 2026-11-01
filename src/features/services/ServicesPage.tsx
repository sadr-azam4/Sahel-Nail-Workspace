import { useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { Pencil, Plus, Sparkles, Trash2 } from 'lucide-react';
import { db } from '../../database/db';
import { useToast } from '../../components/common/Toasts';
import { ConfirmDialog, Dialog } from '../../components/common/Dialog';
import { EmptyState, Field, Switch } from '../../components/common/UI';
import type { Service } from '../../types';
import { nowIso } from '../../utils/misc';
import { formatToman, parseAmount, AMOUNT_ERROR_TEXT } from '../../utils/money';
import { toPersianDigits } from '../../utils/jalali';

interface FormState {
  name: string;
  category: string;
  price: string;
  duration: string;
  description: string;
  active: boolean;
}

const emptyForm: FormState = {
  name: '',
  category: '',
  price: '',
  duration: '60',
  description: '',
  active: true,
};

const DURATION_CHIPS = [15, 30, 45, 60, 90, 120];

export function ServicesPage() {
  const { toast } = useToast();
  const services = useLiveQuery(() => db.services.toArray(), []);
  const [form, setForm] = useState<FormState | null>(null);
  const [editing, setEditing] = useState<Service | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Service | null>(null);
  const [priceError, setPriceError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const grouped = useMemo(() => {
    const map = new Map<string, Service[]>();
    for (const s of [...(services ?? [])].sort((a, b) => a.name.localeCompare(b.name, 'fa'))) {
      const key = s.category.trim() || 'بدون دسته';
      const list = map.get(key) ?? [];
      list.push(s);
      map.set(key, list);
    }
    return [...map.entries()];
  }, [services]);

  const categories = useMemo(
    () => [...new Set((services ?? []).map((s) => s.category).filter(Boolean))],
    [services],
  );

  function openNew() {
    setEditing(null);
    setForm(emptyForm);
    setPriceError(null);
  }

  function openEdit(s: Service) {
    setEditing(s);
    setForm({
      name: s.name,
      category: s.category,
      price: String(s.defaultPrice),
      duration: String(s.defaultDuration),
      description: s.description ?? '',
      active: s.active,
    });
    setPriceError(null);
  }

  async function toggleActive(s: Service) {
    if (s.id === undefined) return;
    await db.services.update(s.id, { active: !s.active, updatedAt: nowIso() });
  }

  async function save() {
    if (!form || busy) return;
    const name = form.name.trim();
    if (!name) {
      toast('نام خدمت را وارد کنید', 'error');
      return;
    }
    const price = parseAmount(form.price);
    if (!price.ok) {
      setPriceError(AMOUNT_ERROR_TEXT[price.error]);
      return;
    }
    const duration = Number(form.duration);
    if (!Number.isInteger(duration) || duration <= 0) {
      toast('مدت زمان نامعتبر است', 'error');
      return;
    }
    setBusy(true);
    try {
      const base: Omit<Service, 'id' | 'createdAt' | 'updatedAt'> = {
        name,
        category: form.category.trim() || 'بدون دسته',
        defaultPrice: price.value,
        defaultDuration: duration,
        description: form.description.trim() || undefined,
        active: form.active,
      };
      if (editing?.id !== undefined) {
        await db.services.update(editing.id, { ...base, updatedAt: nowIso() });
      } else {
        await db.services.add({ ...base, createdAt: nowIso(), updatedAt: nowIso() });
      }
      setForm(null);
      setEditing(null);
      toast('خدمت ذخیره شد', 'success');
    } finally {
      setBusy(false);
    }
  }

  async function confirmDelete() {
    if (!deleteTarget?.id || busy) return;
    setBusy(true);
    try {
      await db.services.delete(deleteTarget.id);
      setDeleteTarget(null);
      toast('خدمت حذف شد — نوبت‌های قبلی بدون تغییر می‌مانند');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      {grouped.length === 0 ? (
        <div className="card">
          <EmptyState
            icon={<Sparkles size={38} />}
            text="فهرست خدمات خالی است. با دکمه + اولین خدمت را اضافه کنید."
          />
        </div>
      ) : (
        grouped.map(([cat, list]) => (
          <div className="card" key={cat}>
            <h3 className="card-title">{cat}</h3>
            {list.map((s) => (
              <div key={s.id} className="list-row">
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 500 }}>{s.name}</div>
                  <div className="text-secondary" style={{ fontSize: 12.5 }}>
                    {formatToman(s.defaultPrice)} · {toPersianDigits(s.defaultDuration)} دقیقه
                    {!s.active && ' · غیرفعال'}
                  </div>
                </div>
                <Switch checked={s.active} onChange={() => void toggleActive(s)} label={`فعال بودن ${s.name}`} />
                <button type="button" className="icon-btn" onClick={() => openEdit(s)} aria-label={`ویرایش ${s.name}`}>
                  <Pencil size={17} />
                </button>
                <button
                  type="button"
                  className="icon-btn"
                  style={{ color: 'var(--danger)' }}
                  onClick={() => setDeleteTarget(s)}
                  aria-label={`حذف ${s.name}`}
                >
                  <Trash2 size={17} />
                </button>
              </div>
            ))}
          </div>
        ))
      )}

      <button type="button" className="fab" onClick={openNew} aria-label="خدمت جدید">
        <Plus size={26} />
      </button>

      <Dialog
        open={form !== null}
        onClose={() => setForm(null)}
        title={editing ? 'ویرایش خدمت' : 'خدمت جدید'}
        footer={
          <>
            <button type="button" className="btn btn-ghost" onClick={() => setForm(null)} disabled={busy}>
              انصراف
            </button>
            <button type="button" className="btn btn-primary" onClick={() => void save()} disabled={busy}>
              {busy ? 'در حال ذخیره…' : 'ذخیره'}
            </button>
          </>
        }
      >
        {form && (
          <>
            <Field label="نام خدمت" required>
              <input
                className="input"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="مثلاً ژلیش"
                autoFocus
              />
            </Field>
            <Field label="دسته">
              <input
                className="input"
                value={form.category}
                onChange={(e) => setForm({ ...form, category: e.target.value })}
                list="service-categories"
                placeholder="مثلاً لاک"
              />
              <datalist id="service-categories">
                {categories.map((c) => (
                  <option key={c} value={c} />
                ))}
              </datalist>
            </Field>
            <Field label="قیمت پیش‌فرض (تومان)" required error={priceError ?? undefined}>
              <input
                className={'input' + (priceError ? ' invalid' : '')}
                inputMode="numeric"
                value={form.price}
                onChange={(e) => {
                  setPriceError(null);
                  setForm({ ...form, price: e.target.value });
                }}
                placeholder="مثلاً ۶۰۰٬۰۰۰"
              />
            </Field>
            <div className="chips" style={{ marginBottom: 12 }}>
              {DURATION_CHIPS.map((d) => (
                <button
                  key={d}
                  type="button"
                  className="chip"
                  onClick={() => setForm({ ...form, duration: String(d) })}
                >
                  {toPersianDigits(d)} دقیقه
                </button>
              ))}
            </div>
            <Field label="مدت زمان پیش‌فرض (دقیقه)" required>
              <input
                className="input"
                inputMode="numeric"
                value={form.duration}
                onChange={(e) => setForm({ ...form, duration: e.target.value })}
              />
            </Field>
            <Field label="توضیحات (اختیاری)">
              <textarea
                className="textarea"
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
              />
            </Field>
            <label className="row-between" style={{ cursor: 'pointer' }}>
              <span>فعال در فهرست انتخاب</span>
              <Switch checked={form.active} onChange={(v) => setForm({ ...form, active: v })} label="فعال" />
            </label>
          </>
        )}
      </Dialog>

      <ConfirmDialog
        open={deleteTarget !== null}
        onClose={() => setDeleteTarget(null)}
        title="حذف خدمت"
        message={`«${deleteTarget?.name ?? ''}» از فهرست حذف شود؟ نوبت‌ها و پیش‌فاکتورهای قبلی با قیمت همان روز حفظ می‌شوند.`}
        confirmLabel="حذف کن"
        danger
        busy={busy}
        onConfirm={confirmDelete}
      />
    </div>
  );
}
