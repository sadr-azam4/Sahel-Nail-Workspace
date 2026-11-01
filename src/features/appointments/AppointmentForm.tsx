import { useEffect, useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { AlertTriangle } from 'lucide-react';
import { db } from '../../database/db';
import type { Appointment, AppointmentServiceLine, AppointmentStatus } from '../../types';
import {
  PERSIAN_MONTHS, fromJalali, jalaliMonthLength, toJalali, toPersianDigits,
  todayJalali, normalizeDigits, type JYearMonthDay,
} from '../../utils/jalali';
import { parseAmount, AMOUNT_ERROR_TEXT } from '../../utils/money';
import { timeToMinutes } from '../../utils/time';
import { nowIso } from '../../utils/misc';
import { Dialog } from '../../components/common/Dialog';
import { Field } from '../../components/common/UI';
import { cx } from '../../utils/misc';
import { describeConflict, findConflicts } from './conflicts';

const DURATION_CHIPS = [30, 45, 60, 90, 120, 150, 180];
const STATUS_OPTIONS: Array<{ id: AppointmentStatus; label: string }> = [
  { id: 'scheduled', label: 'برنامه‌ریزی شده' },
  { id: 'done', label: 'انجام شد' },
  { id: 'cancelled', label: 'لغو شد' },
];

interface AppointmentFormProps {
  dateKey: string;
  appointment?: Appointment;
  onClose(): void;
  onSaved(): void;
}

export function AppointmentForm({ dateKey, appointment, onClose, onSaved }: AppointmentFormProps) {
  const editing = appointment;
  const clients = useLiveQuery(
    () => db.clients.filter((c) => !c.archivedAt).toArray(),
    [],
  );
  const services = useLiveQuery(
    () => db.services.filter((s) => s.active).toArray(),
    [],
  );

  const [customerChoice, setCustomerChoice] = useState<string>(
    editing?.customerId !== undefined ? String(editing.customerId) : '',
  );
  const [guestName, setGuestName] = useState('');
  const [date, setDate] = useState<JYearMonthDay>(() => toJalali(editing?.dateKey ?? dateKey));
  const [startTime, setStartTime] = useState(editing?.startTime ?? '10:00');
  const [duration, setDuration] = useState(editing?.durationMinutes ?? 60);
  const [durationTouched, setDurationTouched] = useState(editing !== undefined);
  const [selectedIds, setSelectedIds] = useState<number[]>(() => {
    if (!editing) return [];
    const ids: number[] = [];
    for (const line of editing.services) {
      if (line.serviceId !== undefined) ids.push(line.serviceId);
    }
    return ids;
  });
  const [priceInput, setPriceInput] = useState(editing ? String(editing.priceSnapshot) : '');
  const [priceTouched, setPriceTouched] = useState(editing !== undefined);
  const [status, setStatus] = useState<AppointmentStatus>(editing?.status ?? 'scheduled');
  const [notes, setNotes] = useState(editing?.notes ?? '');
  const [showConflict, setShowConflict] = useState(false);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);

  const sortedClients = useMemo(
    () => [...(clients ?? [])].sort((a, b) => a.name.localeCompare(b.name, 'fa')),
    [clients],
  );
  const sortedServices = useMemo(
    () => [...(services ?? [])].sort((a, b) => a.name.localeCompare(b.name, 'fa')),
    [services],
  );

  const chosenLines: AppointmentServiceLine[] = useMemo(() => {
    return selectedIds
      .map((id) => sortedServices.find((s) => s.id === id))
      .filter((s): s is NonNullable<typeof s> => Boolean(s))
      .map((s) => ({ serviceId: s.id, name: s.name, price: s.defaultPrice, duration: s.defaultDuration }));
  }, [selectedIds, sortedServices]);

  const sumDuration = chosenLines.reduce((s, l) => s + l.duration, 0);
  const sumPrice = chosenLines.reduce((s, l) => s + l.price, 0);

  // Auto-fill duration/price from chosen services unless the user overrode them.
  useEffect(() => {
    if (!durationTouched) setDuration(sumDuration > 0 ? sumDuration : 60);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sumDuration, durationTouched]);
  useEffect(() => {
    if (!priceTouched) setPriceInput(sumPrice > 0 ? String(sumPrice) : '');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sumPrice, priceTouched]);

  // Clamp day when month/year changes.
  useEffect(() => {
    const maxD = jalaliMonthLength(date.jy, date.jm);
    if (date.jd > maxD) setDate({ ...date, jd: maxD });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [date.jy, date.jm]);

  const dateKeyChosen = fromJalali(date.jy, date.jm, date.jd);
  // Live conflict pool for the CHOSEN day — queried directly from the DB so
  // it stays correct even when the chosen month differs from the calendar
  // view the form was opened from.
  const dayPool = useLiveQuery(
    () => db.appointments.where('dateKey').equals(dateKeyChosen).toArray(),
    [dateKeyChosen],
  );
  const conflicts = findConflicts(
    { dateKey: dateKeyChosen, startTime, durationMinutes: duration },
    dayPool ?? [],
    editing?.id,
  ).map(describeConflict);

  const customerName = (() => {
    if (customerChoice === 'guest') return guestName.trim();
    const id = Number(customerChoice);
    const c = sortedClients.find((x) => x.id === id);
    return c ? c.name : '';
  })();

  const dayOptions = Array.from({ length: jalaliMonthLength(date.jy, date.jm) }, (_, i) => i + 1);
  const yearOptions = useMemo(() => {
    const base = todayJalali().jy;
    return Array.from({ length: 7 }, (_, i) => base - 2 + i);
  }, []);

  async function save(force: boolean) {
    const errs: string[] = [];
    if (!customerName) {
      errs.push(customerChoice === 'guest' ? 'نام مشتری مهمان را وارد کنید' : 'مشتری را انتخاب کنید یا «مهمان» را بزنید');
    }
    if (timeToMinutes(startTime) === null) errs.push('ساعت شروع نامعتبر است');
    if (!Number.isInteger(duration) || duration <= 0) errs.push('مدت جلسه نامعتبر است');
    const priceRes = parseAmount(priceInput);
    if (!priceRes.ok) errs.push(AMOUNT_ERROR_TEXT[priceRes.error]);
    if (errs.length > 0) {
      setErrors(errs);
      return;
    }
    const price = priceRes.ok ? priceRes.value : 0;

    if (conflicts.length > 0 && !force) {
      setShowConflict(true);
      return;
    }

    if (saving) return;
    setSaving(true);
    try {
      const record: Appointment = {
        id: editing?.id,
        customerId: customerChoice && customerChoice !== 'guest' ? Number(customerChoice) : undefined,
        customerName,
        dateKey: dateKeyChosen,
        startTime,
        durationMinutes: duration,
        services: chosenLines.map((l) => ({ ...l })),
        priceSnapshot: price,
        status,
        notes: notes.trim() || undefined,
        createdAt: editing?.createdAt ?? nowIso(),
        updatedAt: nowIso(),
      };
      if (editing?.id !== undefined) {
        await db.appointments.put(record);
      } else {
        const { id: _drop, ...withoutId } = record;
        void _drop;
        await db.appointments.add(withoutId);
      }
      onSaved();
    } catch {
      setErrors(['ذخیره‌سازی ناموفق بود؛ دوباره تلاش کنید.']);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog
      open
      onClose={onClose}
      title={editing ? 'ویرایش نوبت' : 'نوبت جدید'}
      footer={
        <>
          <button type="button" className="btn btn-ghost" onClick={onClose} disabled={saving}>
            انصراف
          </button>
          <button type="button" className="btn btn-primary" onClick={() => void save(false)} disabled={saving}>
            {saving ? 'در حال ذخیره…' : 'ذخیره نوبت'}
          </button>
        </>
      }
    >
      {errors.length > 0 && (
        <div className="danger-box">
          {errors.map((e, i) => (
            <div key={i}>• {e}</div>
          ))}
        </div>
      )}

      {showConflict && conflicts.length > 0 && (
        <div className="conflict-box">
          <div className="row" style={{ gap: 6, fontWeight: 700 }}>
            <AlertTriangle size={16} /> تداخل زمانی با نوبت‌های دیگر:
          </div>
          <ul>
            {conflicts.map((c, i) => (
              <li key={i}>{c}</li>
            ))}
          </ul>
          <div className="row" style={{ gap: 8, marginTop: 8 }}>
            <button type="button" className="btn btn-danger btn-sm" onClick={() => void save(true)}>
              ذخیره با وجود تداخل
            </button>
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => setShowConflict(false)}>
              بازبینی زمان
            </button>
          </div>
        </div>
      )}

      <Field label="مشتری" required>
        <select
          className="select"
          value={customerChoice}
          onChange={(e) => setCustomerChoice(e.target.value)}
        >
          <option value="">— انتخاب کنید —</option>
          {sortedClients.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
          <option value="guest">مهمان (بدون ثبت پرونده)</option>
        </select>
      </Field>

      {customerChoice === 'guest' && (
        <Field label="نام مشتری مهمان" required>
          <input
            className="input"
            value={guestName}
            onChange={(e) => setGuestName(e.target.value)}
            placeholder="مثلاً خانم محمدی"
          />
        </Field>
      )}

      <div className="field">
        <span className="label">تاریخ *</span>
        <div className="row" style={{ gap: 8 }}>
          <select
            className="select"
            value={date.jd}
            onChange={(e) => setDate({ ...date, jd: Number(e.target.value) })}
            aria-label="روز"
            style={{ maxWidth: 90 }}
          >
            {dayOptions.map((d) => (
              <option key={d} value={d}>
                {toPersianDigits(d)}
              </option>
            ))}
          </select>
          <select
            className="select"
            value={date.jm}
            onChange={(e) => setDate({ ...date, jm: Number(e.target.value) })}
            aria-label="ماه"
          >
            {PERSIAN_MONTHS.map((m, i) => (
              <option key={m} value={i + 1}>
                {m}
              </option>
            ))}
          </select>
          <select
            className="select"
            value={date.jy}
            onChange={(e) => setDate({ ...date, jy: Number(e.target.value) })}
            aria-label="سال"
            style={{ maxWidth: 110 }}
          >
            {yearOptions.map((y) => (
              <option key={y} value={y}>
                {toPersianDigits(y)}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid-2">
        <Field label="ساعت شروع *" hint="زمان محلی گوشی">
          <input
            type="time"
            className="input"
            value={startTime}
            onChange={(e) => setStartTime(e.target.value)}
          />
        </Field>
        <Field label="مدت (دقیقه) *">
          <input
            type="number"
            className="input"
            inputMode="numeric"
            min={5}
            step={5}
            value={duration}
            onChange={(e) => {
              setDurationTouched(true);
              const v = Number(normalizeDigits(e.target.value));
              setDuration(Number.isFinite(v) ? Math.max(5, Math.round(v)) : 0);
            }}
          />
        </Field>
      </div>

      <div className="chips" style={{ marginBottom: 12 }}>
        {DURATION_CHIPS.map((d) => (
          <button
            key={d}
            type="button"
            className={cx('chip', duration === d && 'active')}
            onClick={() => {
              setDurationTouched(true);
              setDuration(d);
            }}
          >
            {toPersianDigits(d)} دقیقه
          </button>
        ))}
      </div>

      <div className="field">
        <span className="label">خدمات (قیمت و مدت از نرخ امروز ثبت می‌شود)</span>
        {sortedServices.length === 0 ? (
          <span className="hint">هنوز خدمتی در فهرست نیست؛ قیمت را دستی وارد کنید.</span>
        ) : (
          <div className="stack" style={{ maxHeight: 210, overflowY: 'auto' }}>
            {sortedServices.map((s) => {
              const checked = s.id !== undefined && selectedIds.includes(s.id);
              return (
                <label key={s.id} className="row" style={{ gap: 10, cursor: 'pointer', fontSize: 14 }}>
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={(e) =>
                      setSelectedIds((prev) =>
                        e.target.checked && s.id !== undefined
                          ? [...prev, s.id]
                          : prev.filter((x) => x !== s.id),
                      )
                    }
                    style={{ width: 19, height: 19, accentColor: 'var(--primary)' }}
                  />
                  <span style={{ flex: 1 }}>{s.name}</span>
                  <span className="text-secondary" style={{ fontSize: 12 }}>
                    {toPersianDigits(s.defaultPrice.toLocaleString('en-US').replace(/,/g, '\u066C'))} — {toPersianDigits(s.defaultDuration)}′
                  </span>
                </label>
              );
            })}
          </div>
        )}
      </div>

      <Field
        label="قیمت نهایی (تومان) *"
        hint={chosenLines.length > 0 && !priceTouched ? 'به‌صورت خودکار از خدمات انتخابی محاسبه شد' : undefined}
      >
        <input
          className="input"
          inputMode="numeric"
          value={priceInput}
          onChange={(e) => {
            setPriceTouched(true);
            setPriceInput(e.target.value);
          }}
          placeholder="مثلاً ۴۵۰٬۰۰۰"
        />
      </Field>

      <div className="field">
        <span className="label">وضعیت</span>
        <div className="chips">
          {STATUS_OPTIONS.map((s) => (
            <button
              key={s.id}
              type="button"
              className={cx('chip', status === s.id && 'active')}
              onClick={() => setStatus(s.id)}
            >
              {s.label}
            </button>
          ))}
        </div>
      </div>

      <Field label="یادداشت">
        <textarea
          className="textarea"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="مثلاً آدرس پارکینگ، رنگ مورد علاقه…"
        />
      </Field>
    </Dialog>
  );
}
