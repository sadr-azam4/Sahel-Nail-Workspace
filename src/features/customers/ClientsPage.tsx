import { useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import {
  Archive, ArchiveRestore, ChevronLeft, Palette, Pencil, Phone, Plus, Search, Trash2, UserRound,
} from 'lucide-react';
import { db } from '../../database/db';
import { useNav } from '../../appContext';
import { useToast } from '../../components/common/Toasts';
import { ConfirmDialog, Dialog } from '../../components/common/Dialog';
import { EmptyState, Field } from '../../components/common/UI';
import type { Appointment, Client, Design } from '../../types';
import { nowIso } from '../../utils/misc';
import { formatJalali, isoToLocalDateKey, toPersianDigits } from '../../utils/jalali';
import { formatToman } from '../../utils/money';
import { formatTimeRangeFa } from '../../utils/time';
import { cx } from '../../utils/misc';
import { useSettings } from '../../hooks/useSettings';
import { cloneDesign } from '../nail-designer/designerLogic';
import { saveDraft } from '../../database/repositories';

interface FormState {
  name: string;
  phone: string;
  preferredShape: string;
  preferredColors: string;
  preferredLength: string;
  notes: string;
}

const emptyForm: FormState = { name: '', phone: '', preferredShape: '', preferredColors: '', preferredLength: '', notes: '' };

export function ClientsPage() {
  const { params, navigate } = useNav();
  const { toast } = useToast();
  const settings = useSettings();
  const clients = useLiveQuery(() => db.clients.toArray(), []);
  const appointments = useLiveQuery(() => db.appointments.toArray(), []);
  const designs = useLiveQuery(() => db.designs.toArray(), []);
  const [q, setQ] = useState('');
  const [showArchived, setShowArchived] = useState(settings.prefs.showArchivedClients);
  const [detailId, setDetailId] = useState<number | null>(params.clientId ?? null);
  const [form, setForm] = useState<FormState | null>(null);
  const [editing, setEditing] = useState<Client | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Client | null>(null);
  const [busy, setBusy] = useState(false);

  const visible = useMemo(() => {
    let list = [...(clients ?? [])].sort((a, b) => a.name.localeCompare(b.name, 'fa'));
    if (!showArchived) list = list.filter((c) => !c.archivedAt);
    const query = q.trim();
    if (query) {
      list = list.filter((c) => c.name.includes(query) || (c.phone ?? '').includes(query));
    }
    return list;
  }, [clients, q, showArchived]);

  const detail = useMemo(
    () => (detailId !== null ? (clients ?? []).find((c) => c.id === detailId) ?? null : null),
    [clients, detailId],
  );

  const clientAppointments = useMemo(() => {
    if (!detail) return [];
    return [...(appointments ?? [])]
      .filter((a) => a.customerId === detail.id)
      .sort((a, b) => (a.dateKey + a.startTime).localeCompare(b.dateKey + b.startTime))
      .reverse();
  }, [appointments, detail]);

  const clientDesigns = useMemo(
    () => (designs ?? []).filter((d) => d.customerId === detail?.id),
    [designs, detail],
  );

  function openNew() {
    setEditing(null);
    setForm(emptyForm);
  }

  function openEdit(c: Client) {
    setEditing(c);
    setForm({
      name: c.name,
      phone: c.phone ?? '',
      preferredShape: c.preferredShape ?? '',
      preferredColors: c.preferredColors ?? '',
      preferredLength: c.preferredLength ?? '',
      notes: c.notes ?? '',
    });
  }

  async function save() {
    if (!form || busy) return;
    const name = form.name.trim();
    if (!name) {
      toast('نام مشتری را وارد کنید', 'error');
      return;
    }
    setBusy(true);
    try {
      const data = {
        name,
        phone: form.phone.trim() || undefined,
        preferredShape: form.preferredShape.trim() || undefined,
        preferredColors: form.preferredColors.trim() || undefined,
        preferredLength: form.preferredLength.trim() || undefined,
        notes: form.notes.trim() || undefined,
        updatedAt: nowIso(),
      };
      if (editing?.id !== undefined) {
        await db.clients.update(editing.id, data);
        toast('اطلاعات مشتری به‌روزرسانی شد', 'success');
      } else {
        await db.clients.add({ ...data, createdAt: nowIso(), updatedAt: nowIso() });
        toast('مشتری اضافه شد', 'success');
      }
      setForm(null);
      setEditing(null);
    } finally {
      setBusy(false);
    }
  }

  async function toggleArchive(c: Client) {
    if (c.id === undefined) return;
    if (c.archivedAt) {
      await db.clients.update(c.id, { archivedAt: undefined, updatedAt: nowIso() });
      toast('از بایگانی خارج شد');
    } else {
      await db.clients.update(c.id, { archivedAt: nowIso(), updatedAt: nowIso() });
      toast('مشتری بایگانی شد');
    }
  }

  async function confirmDelete() {
    if (!deleteTarget?.id || busy) return;
    setBusy(true);
    try {
      const id = deleteTarget.id;
      // Detach references but keep immutable name snapshots on records.
      await db.transaction('rw', db.clients, db.appointments, db.designs, async () => {
        await db.clients.delete(id);
        const aps = await db.appointments.where('customerId').equals(id).toArray();
        await db.appointments.bulkPut(aps.map((a) => ({ ...a, customerId: undefined })));
        const dgs = await db.designs.where('customerId').equals(id).toArray();
        await db.designs.bulkPut(dgs.map((d) => ({ ...d, customerId: undefined })));
      });
      setDetailId(null);
      setDeleteTarget(null);
      toast('مشتری حذف شد؛ نوبت‌ها با نام ثبت‌شده باقی ماندند');
    } finally {
      setBusy(false);
    }
  }

  function renderFormDialog() {
    return (
      <Dialog
        open={form !== null}
        onClose={() => setForm(null)}
        title={editing ? 'ویرایش مشتری' : 'مشتری جدید'}
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
            <Field label="نام" required>
              <input
                className="input"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="ساحل"
                autoFocus
              />
            </Field>
            <Field label="شماره تماس (اختیاری)" hint="شماره اجباری نیست">
              <input
                className="input dir-ltr"
                inputMode="tel"
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                placeholder="0912…"
              />
            </Field>
            <div className="grid-2">
              <Field label="فرم دلخواه">
                <input
                  className="input"
                  value={form.preferredShape}
                  onChange={(e) => setForm({ ...form, preferredShape: e.target.value })}
                  placeholder="بادامی"
                />
              </Field>
              <Field label="طول دلخواه">
                <input
                  className="input"
                  value={form.preferredLength}
                  onChange={(e) => setForm({ ...form, preferredLength: e.target.value })}
                  placeholder="متوسط"
                />
              </Field>
            </div>
            <Field label="رنگ‌های مورد علاقه">
              <input
                className="input"
                value={form.preferredColors}
                onChange={(e) => setForm({ ...form, preferredColors: e.target.value })}
                placeholder="صورتی، نود"
              />
            </Field>
            <Field label="یادداشت">
              <textarea
                className="textarea"
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
                placeholder="حساسیت، سلیقه‌ها…"
              />
            </Field>
          </>
        )}
      </Dialog>
    );
  }

  // ---- detail view ----
  if (detail) {
    const totalPaid = clientAppointments
      .filter((a) => a.status === 'done')
      .reduce((s, a) => s + a.priceSnapshot, 0);
    return (
      <div>
        <button type="button" className="btn btn-ghost btn-sm" onClick={() => setDetailId(null)} style={{ marginBottom: 12 }}>
          <ChevronLeft size={16} style={{ transform: 'scaleX(-1)' }} /> همه مشتری‌ها
        </button>

        <div className="card">
          <div className="row" style={{ gap: 12 }}>
            <div className="avatar" style={{ width: 52, height: 52, fontSize: 20 }}>
              {detail.name.trim().charAt(0)}
            </div>
            <div style={{ flex: 1 }}>
              <h2 style={{ fontSize: 18, fontWeight: 700 }}>{detail.name}</h2>
              {detail.phone && (
                <div className="row" style={{ gap: 5, marginTop: 2 }}>
                  <Phone size={14} color="var(--text-2)" />
                  <span className="dir-ltr text-secondary">{detail.phone}</span>
                </div>
              )}
            </div>
            <button type="button" className="icon-btn" onClick={() => openEdit(detail)} aria-label="ویرایش مشتری">
              <Pencil size={18} />
            </button>
          </div>
          {(detail.preferredShape || detail.preferredColors || detail.preferredLength) && (
            <div className="chips" style={{ marginTop: 10 }}>
              {detail.preferredShape && <span className="chip">فرم: {detail.preferredShape}</span>}
              {detail.preferredColors && <span className="chip">رنگ‌ها: {detail.preferredColors}</span>}
              {detail.preferredLength && <span className="chip">طول: {detail.preferredLength}</span>}
            </div>
          )}
          {detail.notes && <p className="text-secondary" style={{ marginTop: 10 }}>یادداشت: {detail.notes}</p>}

          <div className="stat-grid" style={{ marginTop: 14 }}>
            <div className="stat" style={{ boxShadow: 'none' }}>
              <div className="value">{toPersianDigits(clientAppointments.length)}</div>
              <div className="label">نوبت</div>
            </div>
            <div className="stat" style={{ boxShadow: 'none' }}>
              <div className="value" style={{ fontSize: 15 }}>{formatToman(totalPaid)}</div>
              <div className="label">مجموع پرداخت</div>
            </div>
          </div>

          <div className="grid-2" style={{ marginTop: 12 }}>
            <button type="button" className="btn btn-ghost" onClick={() => void toggleArchive(detail)}>
              {detail.archivedAt ? <ArchiveRestore size={17} /> : <Archive size={17} />}
              {detail.archivedAt ? 'خروج از بایگانی' : 'بایگانی'}
            </button>
            <button type="button" className="btn btn-danger-soft" onClick={() => setDeleteTarget(detail)}>
              <Trash2 size={17} /> حذف مشتری
            </button>
          </div>
        </div>

        <div className="card">
          <h3 className="card-title">سابقه خدمات</h3>
          {clientAppointments.length === 0 ? (
            <EmptyState icon={<UserRound size={30} />} text="هنوز نوبتی برای این مشتری ثبت نشده است." />
          ) : (
            <div className="stack">
              {clientAppointments.map((a: Appointment) => (
                <div key={a.id} className="list-row">
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 500, fontSize: 14 }}>
                      {formatJalali(a.dateKey)} — {formatTimeRangeFa(a.startTime, a.durationMinutes)}
                    </div>
                    <div className="text-secondary" style={{ fontSize: 12.5 }}>
                      {a.services.map((s) => s.name).join('، ') || 'بدون خدمت ثبت‌شده'}
                    </div>
                  </div>
                  <div style={{ textAlign: 'end' }}>
                    <span className={cx('badge', a.status)}>
                      {a.status === 'done' ? 'انجام شد' : a.status === 'cancelled' ? 'لغو شد' : 'برنامه‌ریزی'}
                    </span>
                    <div style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--primary)', marginTop: 3 }}>
                      {formatToman(a.priceSnapshot)}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="card">
          <h3 className="card-title">
            <Palette size={17} /> طرح‌های این مشتری
          </h3>
          {clientDesigns.length === 0 ? (
            <EmptyState icon={<Palette size={30} />} text="طرحی برای این مشتری ذخیره نشده است." />
          ) : (
            <div className="stack">
              {clientDesigns.map((d: Design) => (
                <div key={d.id} className="list-row">
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 500, fontSize: 14 }}>{d.title || 'بدون عنوان'}</div>
                    <div className="text-secondary" style={{ fontSize: 12.5 }}>
                      {formatJalali(isoToLocalDateKey(d.updatedAt), { withYear: false })}
                    </div>
                  </div>
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm"
                    onClick={() => {
                      // Open a deep copy in the designer — the saved design
                      // itself is never mutated until explicitly saved.
                      void saveDraft(cloneDesign(d)).then(() => navigate('designer'));
                    }}
                  >
                    <Palette size={15} /> استفاده دوباره
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {renderFormDialog()}
        <ConfirmDialog
          open={deleteTarget !== null}
          onClose={() => setDeleteTarget(null)}
          title="حذف مشتری"
          message={`«${deleteTarget?.name ?? ''}» حذف شود؟ نوبت‌های قبلی با نام او به‌صورت ثابت باقی می‌مانند.`}
          confirmLabel="حذف کن"
          danger
          busy={busy}
          onConfirm={confirmDelete}
        />
      </div>
    );
  }

  // ---- list view ----
  return (
    <div>
      <div className="searchbar">
        <input
          className="input"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="جست‌وجو بر اساس نام یا شماره…"
          aria-label="جست‌وجوی مشتری"
        />
        <Search size={17} aria-hidden="true" />
      </div>

      <label className="row-between" style={{ marginBottom: 12, fontSize: 13.5, color: 'var(--text-2)', cursor: 'pointer' }}>
        <span>نمایش بایگانی‌شده‌ها</span>
        <input
          type="checkbox"
          checked={showArchived}
          onChange={(e) => setShowArchived(e.target.checked)}
          style={{ width: 19, height: 19, accentColor: 'var(--primary)' }}
        />
      </label>

      <div className="card">
        {visible.length === 0 ? (
          <EmptyState icon={<UserRound size={38} />} text="مشتری‌ای یافت نشد. با دکمه + اولین مشتری را اضافه کنید." />
        ) : (
          visible.map((c) => {
            const count = (appointments ?? []).filter((a) => a.customerId === c.id).length;
            return (
              <button key={c.id} type="button" className="list-row" onClick={() => setDetailId(c.id as number)}>
                <span className="avatar">{c.name.trim().charAt(0)}</span>
                <span style={{ flex: 1, minWidth: 0 }}>
                  <span style={{ display: 'block', fontWeight: 500 }}>
                    {c.name}
                    {c.archivedAt && <span className="badge idea" style={{ marginInlineStart: 8 }}>بایگانی</span>}
                  </span>
                  <span className="text-secondary" style={{ fontSize: 12.5, display: 'block' }}>
                    {c.phone ? <span className="dir-ltr">{c.phone}</span> : 'بدون شماره'} · {toPersianDigits(count)} نوبت
                  </span>
                </span>
                <ChevronLeft size={18} color="var(--text-2)" />
              </button>
            );
          })
        )}
      </div>

      <button type="button" className="fab" onClick={openNew} aria-label="مشتری جدید">
        <Plus size={26} />
      </button>

      {renderFormDialog()}
    </div>
  );
}
