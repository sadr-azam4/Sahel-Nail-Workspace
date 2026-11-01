// ---------------------------------------------------------------------------
// Backup export / validation / transactional restore.
//
// SAFETY RULES
// - Restore is full-replacement and only happens after validation passes,
//   details are shown, an emergency backup is offered and the user confirms.
// - Restore runs inside a single Dexie transaction: ANY failure rolls back
//   and leaves the existing database untouched.
// - All ids and relationships are preserved verbatim.
// ---------------------------------------------------------------------------

import { db } from '../../database/db';
import { DEFAULT_SETTINGS } from '../../database/repositories';
import type {
  Appointment,
  Client,
  Design,
  Draft,
  FingerId,
  Nail,
  Quote,
  QuoteLine,
  Service,
  SettingsRow,
} from '../../types';
import { APP_VERSION } from '../../version';
import { isoToLocalDateKey, todayKey } from '../../utils/jalali';
import { isNonNegativeInteger } from '../../utils/money';
import { FINGERS, SHAPES, LENGTHS, FINISHES, PATTERNS, DECOR_TYPES } from '../nail-designer/designerLogic';

export const BACKUP_SCHEMA_VERSION = 1;
export const BACKUP_APP_ID = 'naildesk';

export interface BackupData {
  settings: SettingsRow[];
  clients: Client[];
  services: Service[];
  appointments: Appointment[];
  designs: Design[];
  quotes: Quote[];
  drafts: Draft[];
}

export interface BackupFile {
  app: string;
  schemaVersion: number;
  appVersion: string;
  exportedAt: string;
  data: BackupData;
}

export async function exportBackup(): Promise<BackupFile> {
  const [settings, clients, services, appointments, designs, quotes, drafts] =
    await Promise.all([
      db.settings.toArray(),
      db.clients.toArray(),
      db.services.toArray(),
      db.appointments.toArray(),
      db.designs.toArray(),
      db.quotes.toArray(),
      db.drafts.toArray(),
    ]);
  return {
    app: BACKUP_APP_ID,
    schemaVersion: BACKUP_SCHEMA_VERSION,
    appVersion: APP_VERSION,
    exportedAt: new Date().toISOString(),
    data: { settings, clients, services, appointments, designs, quotes, drafts },
  };
}

export function backupFileName(exportedAtIso?: string): string {
  // Local date — never slice the UTC ISO string (would shift the day for
  // exports made between local midnight and the UTC offset).
  const day = exportedAtIso ? isoToLocalDateKey(exportedAtIso) : todayKey();
  return `naildesk-backup-${day}.json`;
}

export function downloadJson(filename: string, data: unknown): void {
  const blob = new Blob([JSON.stringify(data, null, 2)], {
    type: 'application/json;charset=utf-8',
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

// --- validation --------------------------------------------------------------

export interface BackupSummary {
  settings: number;
  clients: number;
  services: number;
  appointments: number;
  designs: number;
  quotes: number;
  drafts: number;
}

export type BackupValidation =
  | { ok: true; file: BackupFile; summary: BackupSummary }
  | { ok: false; errors: string[] };

function isStr(v: unknown): v is string {
  return typeof v === 'string';
}

function isIsoTs(v: unknown): boolean {
  return isStr(v) && !Number.isNaN(Date.parse(v));
}

export function validateBackupFile(parsed: unknown): BackupValidation {
  const errors: string[] = [];
  const check = (cond: boolean, msg: string): void => {
    if (!cond && errors.length < 12) errors.push(msg);
  };
  if (typeof parsed !== 'object' || parsed === null) {
    return { ok: false, errors: ['فایل پشتیبان معتبر نیست.'] };
  }
  const f = parsed as Partial<BackupFile>;
  check(f.app === BACKUP_APP_ID, 'این فایل پشتیبان NailDesk نیست.');
  check(
    typeof f.schemaVersion === 'number' && f.schemaVersion >= 1 && f.schemaVersion <= BACKUP_SCHEMA_VERSION,
    `نسخه ساختار پشتیبان پشتیبانی نمی‌شود (نسخه فایل: ${String(f.schemaVersion)}).`,
  );
  check(isIsoTs(f.exportedAt), 'زمان تهیه پشتیبان نامعتبر است.');
  const d = f.data;
  if (typeof d !== 'object' || d === null) {
    return { ok: false, errors: [...errors, 'داده‌های پشتیبان یافت نشد.'] };
  }
  const data = d as Partial<BackupData>;

  const arr = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);
  const clients = arr(data.clients);
  const services = arr(data.services);
  const appointments = arr(data.appointments);
  const designs = arr(data.designs);
  const quotes = arr(data.quotes);
  const drafts = arr(data.drafts);
  const settingsArr = arr(data.settings);

  // --- clients
  const clientIds = new Set<number>();
  clients.forEach((c, i) => {
    const cl = c as Partial<Client>;
    check(isStr(cl.name) && cl.name.trim().length > 0, `مشتری ${i + 1}: نام نامعتبر است.`);
    check(cl.id === undefined || typeof cl.id === 'number', `مشتری ${i + 1}: شناسه نامعتبر.`);
    if (typeof cl.id === 'number') clientIds.add(cl.id);
    check(cl.phone === undefined || isStr(cl.phone), `مشتری ${i + 1}: شماره تماس نامعتبر.`);
  });

  // --- services
  services.forEach((s, i) => {
    const sv = s as Partial<Service>;
    check(isStr(sv.name) && sv.name.trim().length > 0, `خدمت ${i + 1}: نام نامعتبر است.`);
    check(
      isNonNegativeInteger(sv.defaultPrice),
      `خدمت ${i + 1}: قیمت باید عدد صحیح نامنفی باشد.`,
    );
    check(
      typeof sv.defaultDuration === 'number' && sv.defaultDuration > 0,
      `خدمت ${i + 1}: مدت زمان نامعتبر است.`,
    );
    check(typeof sv.active === 'boolean', `خدمت ${i + 1}: وضعیت فعال نامعتبر است.`);
  });

  // --- appointments
  const refOk = (id: unknown) => id === undefined || id === null || clientIds.has(id as number);
  appointments.forEach((a, i) => {
    const ap = a as Partial<Appointment>;
    check(isStr(ap.customerName) && ap.customerName.trim().length > 0, `نوبت ${i + 1}: نام مشتری نامعتبر است.`);
    check(/^\d{4}-\d{2}-\d{2}$/.test(String(ap.dateKey)), `نوبت ${i + 1}: تاریخ نامعتبر است.`);
    check(/^\d{2}:\d{2}$/.test(String(ap.startTime)), `نوبت ${i + 1}: ساعت نامعتبر است.`);
    check(
      typeof ap.durationMinutes === 'number' && ap.durationMinutes > 0 && Number.isInteger(ap.durationMinutes),
      `نوبت ${i + 1}: مدت نامعتبر است.`,
    );
    check(
      isNonNegativeInteger(ap.priceSnapshot),
      `نوبت ${i + 1}: قیمت باید عدد صحیح نامنفی باشد.`,
    );
    check(
      ap.status === 'scheduled' || ap.status === 'done' || ap.status === 'cancelled',
      `نوبت ${i + 1}: وضعیت نامعتبر است.`,
    );
    const lines = Array.isArray(ap.services) ? ap.services : [];
    check(Array.isArray(ap.services), `نوبت ${i + 1}: فهرست خدمات نامعتبر است.`);
    lines.forEach((l, j) => {
      const ln = l as Partial<Appointment['services'][number]>;
      check(isStr(ln.name), `نوبت ${i + 1}، خدمت ${j + 1}: نام نامعتبر.`);
      check(isNonNegativeInteger(ln.price), `نوبت ${i + 1}، خدمت ${j + 1}: قیمت نامعتبر.`);
      check(
        typeof ln.duration === 'number' && ln.duration > 0,
        `نوبت ${i + 1}، خدمت ${j + 1}: مدت نامعتبر.`,
      );
    });
    check(refOk(ap.customerId), `نوبت ${i + 1}: مشتری ارجاع‌شده در فایل پیدا نشد.`);
  });

  // --- designs
  const shapeSet = new Set(SHAPES.map((s) => s.id));
  const lenSet = new Set(LENGTHS.map((s) => s.id));
  const finSet = new Set(FINISHES.map((s) => s.id));
  const patSet = new Set(PATTERNS.map((s) => s.id));
  const decoSet = new Set(DECOR_TYPES.map((s) => s.id));
  designs.forEach((dd, i) => {
    const de = dd as Partial<Design>;
    check(isStr(de.title), `طرح ${i + 1}: عنوان نامعتبر است.`);
    check(
      typeof de.nails === 'object' && de.nails !== null,
      `طرح ${i + 1}: ساختار ناخن‌ها نامعتبر است.`,
    );
    if (typeof de.nails === 'object' && de.nails !== null) {
      for (const fin of FINGERS) {
        const nail = (de.nails as Record<string, unknown>)[fin] as Partial<Nail> | undefined;
        if (!nail) {
          check(false, `طرح ${i + 1}: ناخن ${fin} یافت نشد.`);
          continue;
        }
        check(shapeSet.has(nail.shape as never), `طرح ${i + 1}، ناخن ${fin}: فرم نامعتبر.`);
        check(lenSet.has(nail.length as never), `طرح ${i + 1}، ناخن ${fin}: طول نامعتبر.`);
        check(finSet.has(nail.finish as never), `طرح ${i + 1}، ناخن ${fin}: جلا نامعتبر.`);
        check(
          isStr(nail.baseColor) && /^#[0-9a-fA-F]{3,8}$/.test(nail.baseColor),
          `طرح ${i + 1}، ناخن ${fin}: رنگ نامعتبر.`,
        );
        const p = nail.pattern as Partial<Design['nails'][FingerId]['pattern']> | undefined;
        check(
          typeof p === 'object' && p !== null && patSet.has(p.type as never),
          `طرح ${i + 1}، ناخن ${fin}: الگو نامعتبر.`,
        );
        const decos = nail.decorations;
        check(Array.isArray(decos) && decos.length <= 12, `طرح ${i + 1}، ناخن ${fin}: تزئینات نامعتبر.`);
        (Array.isArray(decos) ? decos : []).forEach((dc) => {
          const dv = dc as Partial<Design['nails'][FingerId]['decorations'][number]>;
          check(decoSet.has(dv.type as never), `طرح ${i + 1}، ناخن ${fin}: نوع تزئین نامعتبر.`);
        });
      }
    }
    check(
      de.status === 'idea' || de.status === 'proposed' || de.status === 'approved',
      `طرح ${i + 1}: وضعیت نامعتبر است.`,
    );
    check(refOk(de.customerId), `طرح ${i + 1}: مشتری ارجاع‌شده پیدا نشد.`);
  });

  // --- quotes
  quotes.forEach((qq, i) => {
    const q = qq as Partial<Quote>;
    check(Array.isArray(q.lines), `پیش‌فاکتور ${i + 1}: ردیف‌ها نامعتبر است.`);
    (Array.isArray(q.lines) ? q.lines : []).forEach((l, j) => {
      const ln = l as Partial<QuoteLine>;
      check(isStr(ln.name), `پیش‌فاکتور ${i + 1}، ردیف ${j + 1}: نام نامعتبر.`);
      check(isNonNegativeInteger(ln.unitPrice), `پیش‌فاکتور ${i + 1}، ردیف ${j + 1}: قیمت نامعتبر.`);
      check(
        typeof ln.quantity === 'number' && Number.isInteger(ln.quantity) && ln.quantity > 0,
        `پیش‌فاکتور ${i + 1}، ردیف ${j + 1}: تعداد نامعتبر.`,
      );
    });
    check(isNonNegativeInteger(q.subtotal), `پیش‌فاکتور ${i + 1}: جمع کل نامعتبر.`);
    check(isNonNegativeInteger(q.discount), `پیش‌فاکتور ${i + 1}: تخفیف نامعتبر.`);
    check(isNonNegativeInteger(q.finalPrice), `پیش‌فاکتور ${i + 1}: مبلغ نهایی نامعتبر.`);
  });

  // --- drafts (only designer key allowed)
  drafts.forEach((dr, i) => {
    const draft = dr as Partial<Draft>;
    check(draft.key === 'designer', `پیش‌نویس ${i + 1}: کلید نامعتبر است.`);
  });

  // --- settings
  check(settingsArr.length <= 1, 'بیش از یک ردیف تنظیمات در فایل وجود دارد.');
  if (settingsArr.length === 1) {
    const st = settingsArr[0] as Partial<SettingsRow>;
    check(st.key === 'app', 'ردیف تنظیمات نامعتبر است.');
    check(isStr(st.artistName), 'نام هنرمند در تنظیمات نامعتبر است.');
  }

  if (errors.length > 0) return { ok: false, errors };

  const file: BackupFile = {
    app: BACKUP_APP_ID,
    schemaVersion: f.schemaVersion as number,
    appVersion: isStr(f.appVersion) ? f.appVersion : 'unknown',
    exportedAt: f.exportedAt as string,
    data: {
      settings: settingsArr as SettingsRow[],
      clients: clients as Client[],
      services: services as Service[],
      appointments: appointments as Appointment[],
      designs: designs as Design[],
      quotes: quotes as Quote[],
      drafts: drafts as Draft[],
    },
  };
  return {
    ok: true,
    file,
    summary: {
      settings: settingsArr.length,
      clients: clients.length,
      services: services.length,
      appointments: appointments.length,
      designs: designs.length,
      quotes: quotes.length,
      drafts: drafts.length,
    },
  };
}

// --- restore -----------------------------------------------------------------

/**
 * Full-replacement restore inside ONE transaction. On any error the
 * transaction aborts and the previous database content survives untouched.
 */
export async function restoreBackup(file: BackupFile): Promise<void> {
  await db.transaction(
    'rw',
    [db.settings, db.clients, db.services, db.appointments, db.designs, db.quotes, db.drafts],
    async () => {
      await Promise.all(db.tables.map((t) => t.clear()));
      const d = file.data;
      if (d.settings.length > 0) {
        await db.settings.bulkPut(d.settings);
      } else {
        await db.settings.bulkPut([{ ...DEFAULT_SETTINGS }]);
      }
      if (d.clients.length) await db.clients.bulkPut(d.clients);
      if (d.services.length) await db.services.bulkPut(d.services);
      if (d.appointments.length) await db.appointments.bulkPut(d.appointments);
      if (d.designs.length) await db.designs.bulkPut(d.designs);
      if (d.quotes.length) await db.quotes.bulkPut(d.quotes);
      if (d.drafts.length) await db.drafts.bulkPut(d.drafts);
    },
  );
}

/** Used by tests and the emergency path. Same transactional guarantees. */
export async function replaceAll(data: BackupData): Promise<void> {
  await restoreBackup({
    app: BACKUP_APP_ID,
    schemaVersion: BACKUP_SCHEMA_VERSION,
    appVersion: APP_VERSION,
    exportedAt: new Date().toISOString(),
    data,
  });
}
