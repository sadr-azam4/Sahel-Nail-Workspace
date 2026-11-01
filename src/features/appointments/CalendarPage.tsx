import { useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import {
  CalendarDays, Check, ChevronLeft, ChevronRight, Pencil, Plus, Trash2, X,
} from 'lucide-react';
import { db } from '../../database/db';
import { useNav } from '../../appContext';
import { useToast } from '../../components/common/Toasts';
import { ConfirmDialog } from '../../components/common/Dialog';
import { EmptyState } from '../../components/common/UI';
import type { Appointment } from '../../types';
import {
  formatJalali, formatJalaliMonth, jalaliMonthLength, fromJalali, toJalali,
  todayJalali, todayKey, toPersianDigits, weekdayIndexSat0, WEEKDAYS_SHORT,
  shiftJalaliMonth, monthStartEndKeys,
} from '../../utils/jalali';
import { formatTimeRangeFa } from '../../utils/time';
import { formatToman as fmtMoney } from '../../utils/money';
import { sortAppointmentsByTime } from './conflicts';
import { AppointmentForm } from './AppointmentForm';
import { cx } from '../../utils/misc';

const STATUS_LABELS: Record<Appointment['status'], string> = {
  scheduled: 'برنامه‌ریزی شده',
  done: 'انجام شد',
  cancelled: 'لغو شد',
};

export function CalendarPage() {
  const { params } = useNav();
  const { toast } = useToast();
  const [view, setView] = useState(() => toJalali(params.dateKey ?? todayKey()));
  const [selectedKey, setSelectedKey] = useState(() => params.dateKey ?? todayKey());
  const [formState, setFormState] = useState<{ dateKey: string; appointment?: Appointment } | null>(
    () => (params.openNew ? { dateKey: params.dateKey ?? todayKey() } : null),
  );
  const [deleteTarget, setDeleteTarget] = useState<Appointment | null>(null);
  const [busy, setBusy] = useState(false);

  const [mStart, mEnd] = monthStartEndKeys(view.jy, view.jm);
  const monthAppts = useLiveQuery(
    () => db.appointments.where('dateKey').between(mStart, mEnd, true, true).toArray(),
    [mStart, mEnd],
  );

  const byDay = useMemo(() => {
    const map = new Map<string, Appointment[]>();
    for (const a of monthAppts ?? []) {
      const list = map.get(a.dateKey) ?? [];
      list.push(a);
      map.set(a.dateKey, list);
    }
    return map;
  }, [monthAppts]);

  const firstDayKey = fromJalali(view.jy, view.jm, 1);
  const lead = weekdayIndexSat0(firstDayKey);
  const days = jalaliMonthLength(view.jy, view.jm);
  const today = todayKey();

  const dayAppts = sortAppointmentsByTime(byDay.get(selectedKey) ?? []);

  async function setStatus(a: Appointment, status: Appointment['status']) {
    if (a.id === undefined) return;
    await db.appointments.update(a.id, { status, updatedAt: new Date().toISOString() });
  }

  async function confirmDelete() {
    if (!deleteTarget?.id || busy) return;
    setBusy(true);
    try {
      await db.appointments.delete(deleteTarget.id);
      setDeleteTarget(null);
      toast('نوبت حذف شد');
    } finally {
      setBusy(false);
    }
  }

  const cells: Array<null | number> = [
    ...Array.from({ length: lead }, () => null),
    ...Array.from({ length: days }, (_, i) => i + 1),
  ];

  return (
    <div>
      <div className="card" style={{ padding: 12 }}>
        <div className="row-between" style={{ marginBottom: 10 }}>
          <button
            type="button"
            className="icon-btn"
            onClick={() => setView(shiftJalaliMonth(view.jy, view.jm, 1))}
            aria-label="ماه بعد"
          >
            <ChevronLeft size={20} />
          </button>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontWeight: 700, fontSize: 16 }}>{formatJalaliMonth(view.jy, view.jm)}</div>
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              style={{ minHeight: 30, marginTop: 2 }}
              onClick={() => {
                const t = todayJalali();
                setView({ jy: t.jy, jm: t.jm, jd: t.jd });
                setSelectedKey(today);
              }}
            >
              امروز
            </button>
          </div>
          <button
            type="button"
            className="icon-btn"
            onClick={() => setView(shiftJalaliMonth(view.jy, view.jm, -1))}
            aria-label="ماه قبل"
          >
            <ChevronRight size={20} />
          </button>
        </div>

        <div className="cal-dow">
          {WEEKDAYS_SHORT.map((w, i) => (
            <span key={i}>{w}</span>
          ))}
        </div>
        <div className="cal-grid">
          {cells.map((d, i) => {
            if (d === null) return <span key={`x${i}`} />;
            const key = fromJalali(view.jy, view.jm, d);
            const list = byDay.get(key) ?? [];
            const active = list.filter((a) => a.status !== 'cancelled');
            const dots: Appointment['status'][] = [];
            for (const a of list) {
              if (dots.length < 3 && !dots.includes(a.status)) dots.push(a.status);
            }
            return (
              <button
                key={key}
                type="button"
                className={cx(
                  'cal-cell',
                  key === today && 'today',
                  key === selectedKey && 'selected',
                )}
                onClick={() => setSelectedKey(key)}
                aria-label={`${formatJalali(key)} — ${toPersianDigits(active.length)} نوبت فعال`}
              >
                <span>{toPersianDigits(d)}</span>
                <span className="cal-dots">
                  {dots.map((s, j) => (
                    <span key={j} className={cx('cal-dot', s)} />
                  ))}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Selected day */}
      <div className="card">
        <div className="row-between" style={{ marginBottom: 8 }}>
          <h3 className="card-title" style={{ margin: 0 }}>
            <CalendarDays size={17} /> {formatJalali(selectedKey, { withWeekday: true })}
          </h3>
          <button
            type="button"
            className="btn btn-primary btn-sm"
            onClick={() => setFormState({ dateKey: selectedKey })}
          >
            <Plus size={16} /> نوبت
          </button>
        </div>

        {dayAppts.length === 0 ? (
          <EmptyState icon={<CalendarDays size={34} />} text="برای این روز نوبتی ثبت نشده است." />
        ) : (
          <div className="stack">
            {dayAppts.map((a) => (
              <div
                key={a.id}
                className="card"
                style={{
                  margin: 0,
                  padding: 12,
                  opacity: a.status === 'cancelled' ? 0.65 : 1,
                  borderInlineStart: `3px solid ${a.status === 'done' ? 'var(--success)' : a.status === 'cancelled' ? 'var(--text-2)' : 'var(--primary)'}`,
                }}
              >
                <div className="row-between">
                  <div style={{ minWidth: 0 }}>
                    <div className="row" style={{ flexWrap: 'wrap', gap: 6 }}>
                      <span className={cx('badge', a.status)}>{STATUS_LABELS[a.status]}</span>
                      <strong>{a.customerName}</strong>
                    </div>
                    <div className="text-secondary" style={{ margin: '4px 0' }}>
                      {formatTimeRangeFa(a.startTime, a.durationMinutes)}
                      {a.services.length > 0 && ` · ${a.services.map((s) => s.name).join('، ')}`}
                    </div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--primary)' }}>
                      {fmtMoney(a.priceSnapshot)}
                    </div>
                    {a.notes && <div className="text-secondary" style={{ marginTop: 4 }}>یادداشت: {a.notes}</div>}
                  </div>
                  <div className="stack" style={{ gap: 6 }}>
                    <div className="row" style={{ gap: 2 }}>
                      {a.status === 'scheduled' && (
                        <>
                          <button
                            type="button"
                            className="icon-btn"
                            style={{ width: 36, height: 36, color: 'var(--success)' }}
                            onClick={() => void setStatus(a, 'done')}
                            aria-label="علامت‌گذاری انجام شد"
                          >
                            <Check size={18} />
                          </button>
                          <button
                            type="button"
                            className="icon-btn"
                            style={{ width: 36, height: 36, color: 'var(--text-2)' }}
                            onClick={() => void setStatus(a, 'cancelled')}
                            aria-label="لغو نوبت"
                          >
                            <X size={18} />
                          </button>
                        </>
                      )}
                      {a.status === 'cancelled' && (
                        <button
                          type="button"
                          className="icon-btn"
                          style={{ width: 36, height: 36, color: 'var(--primary)' }}
                          onClick={() => void setStatus(a, 'scheduled')}
                          aria-label="فعال‌سازی دوباره"
                        >
                          <Check size={18} />
                        </button>
                      )}
                      <button
                        type="button"
                        className="icon-btn"
                        style={{ width: 36, height: 36 }}
                        onClick={() => setFormState({ dateKey: a.dateKey, appointment: a })}
                        aria-label="ویرایش نوبت"
                      >
                        <Pencil size={17} />
                      </button>
                      <button
                        type="button"
                        className="icon-btn"
                        style={{ width: 36, height: 36, color: 'var(--danger)' }}
                        onClick={() => setDeleteTarget(a)}
                        aria-label="حذف نوبت"
                      >
                        <Trash2 size={17} />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {dayAppts.length > 0 && (
          <p className="hint" style={{ marginTop: 10 }}>
            مجموع این روز: {fmtMoney(dayAppts.filter((a) => a.status !== 'cancelled').reduce((s, a) => s + a.priceSnapshot, 0))}
          </p>
        )}
      </div>

      {formState && (
        <AppointmentForm
          dateKey={formState.dateKey}
          appointment={formState.appointment}
          onClose={() => setFormState(null)}
          onSaved={() => {
            setFormState(null);
            toast('نوبت ذخیره شد', 'success');
          }}
        />
      )}

      <ConfirmDialog
        open={deleteTarget !== null}
        onClose={() => setDeleteTarget(null)}
        title="حذف نوبت"
        message={`نوبت ${deleteTarget?.customerName ?? ''} در ${deleteTarget ? formatJalali(deleteTarget.dateKey, { withWeekday: true }) : ''} حذف شود؟`}
        confirmLabel="حذف کن"
        danger
        busy={busy}
        onConfirm={confirmDelete}
      />
    </div>
  );
}
