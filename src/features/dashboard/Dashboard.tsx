import { useLiveQuery } from 'dexie-react-hooks';
import {
  CalendarDays, CalendarPlus, Calculator, Images, Palette, Sparkles,
} from 'lucide-react';
import { db } from '../../database/db';
import { useNav } from '../../appContext';
import { useSettings } from '../../hooks/useSettings';
import {
  formatJalali, formatJalaliMonth, formatNumberFa, monthStartEndKeys,
  todayJalali, todayKey, toPersianDigits,
} from '../../utils/jalali';
import { formatToman } from '../../utils/money';
import { formatTimeRangeFa, timeToMinutes } from '../../utils/time';
import { sortAppointmentsByTime } from '../appointments/conflicts';
import { EmptyState } from '../../components/common/UI';
import { cx } from '../../utils/misc';

export function Dashboard() {
  const { navigate } = useNav();
  const settings = useSettings();
  const today = todayKey();
  const { jy, jm } = todayJalali();
  const [monthStart, monthEnd] = monthStartEndKeys(jy, jm);

  const todayAppts = useLiveQuery(
    () => db.appointments.where('dateKey').equals(today).toArray(),
    [today],
  );
  const monthAppts = useLiveQuery(
    () => db.appointments.where('dateKey').between(monthStart, monthEnd, true, true).toArray(),
    [monthStart, monthEnd],
  );
  const clientCount = useLiveQuery(
    () => db.clients.filter((c) => !c.archivedAt).count(),
    [],
  );
  const designCount = useLiveQuery(() => db.designs.count(), []);

  const activeToday = sortAppointmentsByTime(
    (todayAppts ?? []).filter((a) => a.status !== 'cancelled'),
  );
  // "Next" = the first scheduled appointment that has not finished yet
  // (end time still ahead of the current wall-clock). Falls back to the
  // first scheduled one once the whole day is over.
  const nowMin = (() => {
    const n = new Date();
    return n.getHours() * 60 + n.getMinutes();
  })();
  const nextAppt =
    activeToday.find(
      (a) => a.status === 'scheduled' && (timeToMinutes(a.startTime) ?? 0) + a.durationMinutes > nowMin,
    ) ?? activeToday.find((a) => a.status === 'scheduled');
  const doneMonth = (monthAppts ?? []).filter((a) => a.status === 'done');
  const monthIncome = doneMonth.reduce((s, a) => s + a.priceSnapshot, 0);

  const quick: Array<{ label: string; icon: typeof CalendarPlus; go: () => void }> = [
    { label: 'نوبت جدید', icon: CalendarPlus, go: () => navigate('calendar', { openNew: true, dateKey: today }) },
    { label: 'طراحی ناخن', icon: Palette, go: () => navigate('designer') },
    { label: 'ماشین‌حساب', icon: Calculator, go: () => navigate('calculator') },
    { label: 'فهرست خدمات', icon: Sparkles, go: () => navigate('services') },
  ];

  return (
    <div>
      <div style={{ marginBottom: 14 }}>
        <h2 style={{ fontSize: 20, fontWeight: 700 }}>
          سلام {settings.artistName || 'دوست من'} جان 🌸
        </h2>
        <p className="greeting-date" style={{ marginTop: 2 }}>
          {formatJalali(today, { withWeekday: true })}
          {settings.salonName ? ` — ${settings.salonName}` : ''}
        </p>
      </div>

      {/* Today's appointments */}
      <div className="card">
        <div className="row-between" style={{ marginBottom: 8 }}>
          <h3 className="card-title" style={{ margin: 0 }}>
            <CalendarDays size={17} /> نوبت‌های امروز
          </h3>
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => navigate('calendar')}>
            تقویم
          </button>
        </div>
        {activeToday.length === 0 ? (
          <EmptyState icon={<CalendarPlus size={34} />} text="امروز نوبتی ثبت نشده است." />
        ) : (
          <div className="stack">
            {activeToday.map((a) => (
              <button
                key={a.id}
                type="button"
                className="list-row"
                onClick={() => navigate('calendar', { dateKey: a.dateKey })}
                style={{ textAlign: 'start' }}
              >
                <span className={cx('badge', a.status === 'done' ? 'done' : 'scheduled')}>
                  {formatTimeRangeFa(a.startTime, a.durationMinutes)}
                </span>
                <span style={{ fontWeight: 500, flex: 1 }}>{a.customerName}</span>
                {a.id === nextAppt?.id && <span className="offline-chip">بعدی</span>}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Month stats */}
      <div className="stat-grid" style={{ marginBottom: 14 }}>
        <div className="stat">
          <div className="value">{toPersianDigits(formatNumberFa(monthAppts?.length ?? 0))}</div>
          <div className="label">نوبت {formatJalaliMonth(jy, jm)}</div>
        </div>
        <div className="stat">
          <div className="value" style={{ fontSize: 15 }}>{formatToman(monthIncome)}</div>
          <div className="label">درآمد ثبت‌شده این ماه</div>
        </div>
        <div className="stat">
          <div className="value">{toPersianDigits(formatNumberFa(clientCount ?? 0))}</div>
          <div className="label">مشتری فعال</div>
        </div>
        <div className="stat">
          <div className="value">{toPersianDigits(formatNumberFa(designCount ?? 0))}</div>
          <div className="label">طرح ذخیره‌شده</div>
        </div>
      </div>

      {/* Quick actions */}
      <div className="card">
        <h3 className="card-title">
          <Sparkles size={17} /> دسترسی سریع
        </h3>
        <div className="grid-2">
          {quick.map((q) => {
            const Icon = q.icon;
            return (
              <button key={q.label} type="button" className="btn btn-ghost" onClick={q.go}>
                <Icon size={18} /> {q.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Gallery teaser */}
      <div className="card">
        <div className="row-between">
          <div>
            <h3 className="card-title" style={{ marginBottom: 4 }}>
              <Images size={17} /> گالری طرح‌ها
            </h3>
            <p className="text-secondary">طرح‌های ذخیره‌شده و پیش‌نمایش‌های محبوب شما.</p>
          </div>
          <button type="button" className="btn btn-primary btn-sm" onClick={() => navigate('gallery')}>
            <Images size={16} /> مشاهده
          </button>
        </div>
      </div>
    </div>
  );
}
