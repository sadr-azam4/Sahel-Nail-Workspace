import { useEffect, useRef, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import {
  AlertTriangle, Calculator, Database, Download, HardDrive, Info, Moon,
  Settings2, ShieldCheck, Sparkles, Sun, Monitor, Trash2, Upload, UserRound,
} from 'lucide-react';
import { db } from '../../database/db';
import { saveSettings } from '../../database/repositories';
import { useSettings } from '../../hooks/useSettings';
import { useToast } from '../../components/common/Toasts';
import { ConfirmDialog, Dialog } from '../../components/common/Dialog';
import { Field, Segmented } from '../../components/common/UI';
import type { ThemeMode } from '../../types';
import {
  backupFileName, downloadJson, exportBackup, restoreBackup, validateBackupFile,
  type BackupFile, type BackupSummary,
} from '../backup/backup';
import { APP_VERSION } from '../../version';
import { formatJalali, formatNumberFa, isoToLocalDateKey, toPersianDigits } from '../../utils/jalali';
import { formatToman } from '../../utils/money';
import { useNav } from '../../appContext';

export function SettingsPage() {
  const { navigate } = useNav();
  const { toast } = useToast();
  const settings = useSettings();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [restorePreview, setRestorePreview] = useState<{ file: BackupFile; summary: BackupSummary } | null>(null);
  const [restoreErrors, setRestoreErrors] = useState<string[] | null>(null);
  const [confirmRestore, setConfirmRestore] = useState(false);
  const [confirmWipe, setConfirmWipe] = useState(false);
  const [wipeText, setWipeText] = useState('');
  const [busy, setBusy] = useState(false);
  const [storage, setStorage] = useState<{ usage: number; quota: number } | null>(null);

  const doneAppts = useLiveQuery(() => db.appointments.filter((a) => a.status === 'done').toArray(), []);
  const lastBackup = settings.lastBackupAt;

  useEffect(() => {
    let alive = true;
    async function read() {
      try {
        if (navigator.storage?.estimate) {
          const est = await navigator.storage.estimate();
          if (alive) setStorage({ usage: est.usage ?? 0, quota: est.quota ?? 0 });
        }
      } catch {
        /* estimation unsupported */
      }
    }
    void read();
    return () => {
      alive = false;
    };
  }, []);

  function exportNow() {
    void (async () => {
      try {
        const file = await exportBackup();
        downloadJson(backupFileName(file.exportedAt), file);
        await saveSettings({ lastBackupAt: new Date().toISOString() });
        toast('پشتیبان دانلود شد', 'success');
      } catch {
        toast('تهیه پشتیبان ناموفق بود', 'error');
      }
    })();
  }

  function onPickFile() {
    fileInputRef.current?.click();
  }

  async function onFileChosen(f: File | undefined) {
    if (!f) return;
    try {
      const text = await f.text();
      let parsed: unknown;
      try {
        parsed = JSON.parse(text);
      } catch {
        setRestoreErrors(['فایل JSON معتبر نیست.']);
        return;
      }
      const res = validateBackupFile(parsed);
      if (res.ok) {
        setRestoreErrors(null);
        setRestorePreview({ file: res.file, summary: res.summary });
      } else {
        setRestorePreview(null);
        setRestoreErrors(res.errors);
      }
    } catch {
      toast('خواندن فایل ناموفق بود', 'error');
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }

  async function doRestore() {
    if (!restorePreview || busy) return;
    setBusy(true);
    try {
      await restoreBackup(restorePreview.file);
      setRestorePreview(null);
      setConfirmRestore(false);
      toast('بازیابی کامل شد', 'success');
    } catch {
      toast('بازیابی ناموفق بود؛ داده‌های قبلی دست‌نخورده ماندند', 'error');
    } finally {
      setBusy(false);
    }
  }

  async function doWipe() {
    if (busy) return;
    setBusy(true);
    try {
      await db.delete();
      location.reload();
    } catch {
      setBusy(false);
      toast('پاک‌سازی ناموفق بود', 'error');
    }
  }

  async function requestPersist() {
    try {
      if (!navigator.storage?.persist) {
        toast('این مرورگر از ذخیره‌سازی پایدار پشتیبانی نمی‌کند');
        return;
      }
      const ok = await navigator.storage.persist();
      toast(
        ok
          ? 'ذخیره‌سازی پایدار فعال شد'
          : 'مرورگر اجازه نداد؛ داده‌ها همچنان به‌طور معمول ذخیره می‌شوند',
        ok ? 'success' : 'info',
      );
    } catch {
      toast('درخواست ذخیره‌سازی پایدار ناموفق بود', 'error');
    }
  }

  const monthIncome = (doneAppts ?? []).reduce((s, a) => s + a.priceSnapshot, 0);
  const pct = storage && storage.quota > 0 ? Math.min(100, Math.round((storage.usage / storage.quota) * 100)) : 0;

  return (
    <div>
      {/* profile */}
      <div className="card">
        <h3 className="card-title">
          <UserRound size={17} /> پروفایل
        </h3>
        <Field label="نام شما (برای خوش‌آمدگویی)">
          <input
            className="input"
            value={settings.artistName}
            onChange={(e) => void saveSettings({ artistName: e.target.value })}
            placeholder="ساحل"
          />
        </Field>
        <Field label="نام سالن (اختیاری)">
          <input
            className="input"
            value={settings.salonName}
            onChange={(e) => void saveSettings({ salonName: e.target.value })}
            placeholder="مثلاً استودیو زیبا"
          />
        </Field>
        <p className="hint">تغییرات بلافاصله ذخیره می‌شود.</p>
      </div>

      {/* appearance */}
      <div className="card">
        <h3 className="card-title">
          {settings.theme === 'dark' ? <Moon size={17} /> : settings.theme === 'light' ? <Sun size={17} /> : <Monitor size={17} />}
          ظاهر برنامه
        </h3>
        <Segmented
          value={settings.theme}
          onChange={(v) => void saveSettings({ theme: v as ThemeMode })}
          options={[
            { id: 'light' as ThemeMode, label: 'روشن' },
            { id: 'dark' as ThemeMode, label: 'تاریک' },
            { id: 'system' as ThemeMode, label: 'هماهنگ با گوشی' },
          ]}
        />
      </div>

      {/* stats summary */}
      <div className="card">
        <h3 className="card-title">
          <Sparkles size={17} /> خلاصه آمار
        </h3>
        <div className="row-between" style={{ fontSize: 14 }}>
          <span className="text-secondary">نوبت‌های انجام‌شده تا امروز</span>
          <span>{formatNumberFa((doneAppts ?? []).length)}</span>
        </div>
        <div className="row-between" style={{ fontSize: 14, marginTop: 6 }}>
          <span className="text-secondary">مجموع درآمد ثبت‌شده</span>
          <span style={{ fontWeight: 700, color: 'var(--primary)' }}>{formatToman(monthIncome)}</span>
        </div>
      </div>

      {/* links */}
      <div className="card">
        <h3 className="card-title">
          <Settings2 size={17} /> ابزارها
        </h3>
        <button type="button" className="list-row" onClick={() => navigate('services')}>
          <Sparkles size={18} color="var(--primary)" />
          <span style={{ flex: 1 }}>فهرست خدمات</span>
        </button>
        <button type="button" className="list-row" onClick={() => navigate('calculator')}>
          <Calculator size={18} color="var(--primary)" />
          <span style={{ flex: 1 }}>ماشین‌حساب قیمت</span>
        </button>
      </div>

      {/* data & backup */}
      <div className="card">
        <h3 className="card-title">
          <Database size={17} /> داده‌ها و پشتیبان‌گیری
        </h3>
        <p className="text-secondary" style={{ marginBottom: 12 }}>
          همه داده‌ها فقط روی همین دستگاه (IndexedDB) ذخیره می‌شوند. برای انتقال به گوشی دیگر یا
          اطمینان، به‌صورت دستی فایل پشتیبان بگیرید.
        </p>
        {lastBackup && (
          <p className="hint" style={{ marginBottom: 8 }}>
            آخرین پشتیبان: {formatJalali(isoToLocalDateKey(lastBackup), { withWeekday: true })}
          </p>
        )}
        <div className="grid-2">
          <button type="button" className="btn btn-primary" onClick={exportNow}>
            <Download size={17} /> خروجی پشتیبان
          </button>
          <button type="button" className="btn btn-ghost" onClick={onPickFile}>
            <Upload size={17} /> بازیابی از فایل
          </button>
        </div>
        <input
          ref={fileInputRef}
          type="file"
          accept=".json,application/json"
          style={{ display: 'none' }}
          onChange={(e) => void onFileChosen(e.target.files?.[0])}
        />
      </div>

      {/* storage */}
      <div className="card">
        <h3 className="card-title">
          <HardDrive size={17} /> حافظه دستگاه
        </h3>
        {storage ? (
          <>
            <div className="progress-track" role="img" aria-label={`مصرف ${pct} درصد`}>
              <div className="progress-fill" style={{ width: `${Math.max(2, pct)}%` }} />
            </div>
            <p className="hint" style={{ marginTop: 8 }}>
              مصرف: {formatNumberFa(Math.max(1, Math.round(storage.usage / 1024)))} کیلوبایت از
              {' '}{formatNumberFa(Math.round(storage.quota / (1024 * 1024)))} مگابایت مجاز
            </p>
          </>
        ) : (
          <p className="hint">این مرورگر گزارش مصرف حافظه نمی‌دهد.</p>
        )}
        <button type="button" className="btn btn-ghost btn-block" style={{ marginTop: 10 }} onClick={() => void requestPersist()}>
          <ShieldCheck size={17} /> درخواست ذخیره‌سازی پایدار
        </button>
        <p className="hint" style={{ marginTop: 8 }}>
          با ذخیره‌سازی پایدار، مرورگر کمتر احتمال می‌دهد داده‌ها را خودکار پاک کند.
        </p>
      </div>

      {/* about */}
      <div className="card">
        <h3 className="card-title">
          <Info size={17} /> درباره
        </h3>
        <p className="text-secondary" style={{ fontSize: 13 }}>
          NailDesk نسخه {toPersianDigits(APP_VERSION)} — دستیار شخصی ناخن‌سالن، کاملاً آفلاین.
          بدون حساب کاربری، بدون سرور، بدون ارسال داده به بیرون. حریم خصوصی شما کامل است.
        </p>
      </div>

      {/* danger zone */}
      <div className="card" style={{ borderColor: 'var(--danger)' }}>
        <h3 className="card-title" style={{ color: 'var(--danger)' }}>
          <AlertTriangle size={17} /> منطقه خطر
        </h3>
        <p className="text-secondary" style={{ marginBottom: 10 }}>
          پاک‌کردن کامل همه داده‌ها (مشتری‌ها، نوبت‌ها، طرح‌ها و تنظیمات). این کار بازگشت‌پذیر نیست؛
          اگر پشتیبان لازم دارید، قبل از آن خروجی بگیرید.
        </p>
        <button type="button" className="btn btn-danger btn-block" onClick={() => { setWipeText(''); setConfirmWipe(true); }}>
          <Trash2 size={17} /> پاک کردن همه داده‌ها
        </button>
      </div>

      {/* restore preview dialog */}
      <Dialog
        open={restorePreview !== null}
        onClose={() => setRestorePreview(null)}
        title="بازیابی پشتیبان"
        footer={
          <>
            <button type="button" className="btn btn-ghost" onClick={() => setRestorePreview(null)} disabled={busy}>
              انصراف
            </button>
            <button type="button" className="btn btn-danger" onClick={() => setConfirmRestore(true)} disabled={busy}>
              {busy ? 'در حال بازیابی…' : 'بازیابی و جایگزینی'}
            </button>
          </>
        }
      >
        {restorePreview && (
          <>
            <div className="conflict-box">
              محتوای فایل پشتیبان:
              <ul>
                <li>مشتری‌ها: {formatNumberFa(restorePreview.summary.clients)}</li>
                <li>خدمات: {formatNumberFa(restorePreview.summary.services)}</li>
                <li>نوبت‌ها: {formatNumberFa(restorePreview.summary.appointments)}</li>
                <li>طرح‌ها: {formatNumberFa(restorePreview.summary.designs)}</li>
                <li>پیش‌فاکتورها: {formatNumberFa(restorePreview.summary.quotes)}</li>
              </ul>
            </div>
            <div className="danger-box">
              بازیابی، همه داده‌های فعلی را با محتوای این فایل جایگزین می‌کند. پیشنهاد می‌شود قبل از ادامه
              یک پشتیبان اضطراری از داده‌های فعلی بگیرید.
            </div>
            <button
              type="button"
              className="btn btn-ghost btn-block"
              onClick={() => {
                void (async () => {
                  const cur = await exportBackup();
                  downloadJson(backupFileName(cur.exportedAt), cur);
                  toast('پشتیبان اضطراری دانلود شد', 'success');
                })();
              }}
            >
              <Download size={16} /> دانلود پشتیبان اضطراری از داده‌های فعلی
            </button>
            <p className="hint" style={{ marginTop: 8 }}>
              نسخه فایل: {toPersianDigits(restorePreview.file.schemaVersion)} — تهیه‌شده با NailDesk {restorePreview.file.appVersion}
            </p>
          </>
        )}
      </Dialog>

      {/* validation errors dialog */}
      <Dialog
        open={restoreErrors !== null}
        onClose={() => setRestoreErrors(null)}
        title="فایل پشتیبان نامعتبر است"
        center
        footer={
          <button type="button" className="btn btn-primary btn-block" onClick={() => setRestoreErrors(null)}>
            متوجه شدم
          </button>
        }
      >
        <div className="danger-box">
          {(restoreErrors ?? []).map((e, i) => (
            <div key={i}>• {e}</div>
          ))}
        </div>
        <p className="hint">داده‌های فعلی شما هیچ تغییری نکرده‌اند.</p>
      </Dialog>

      <ConfirmDialog
        open={confirmRestore}
        onClose={() => setConfirmRestore(false)}
        title="جایگزینی کامل داده‌ها؟"
        message="همه داده‌های فعلی حذف و محتوای فایل پشتیبان جایگزین می‌شود. اگر خطایی رخ دهد، داده‌های قبلی دست‌نخورده می‌مانند."
        confirmLabel="بله، بازیابی کن"
        danger
        busy={busy}
        onConfirm={() => void doRestore()}
      />

      <ConfirmDialog
        open={confirmWipe}
        onClose={() => setConfirmWipe(false)}
        title="پاک کردن همه داده‌ها"
        message="برای تأیید، کلمه «پاک کن» را در کادر زیر بنویسید."
        confirmLabel="پاک کردن کامل"
        danger
        busy={busy}
        confirmDisabled={wipeText.trim() !== 'پاک کن'}
        onConfirm={() => void doWipe()}
      >
        <input
          className="input"
          value={wipeText}
          onChange={(e) => setWipeText(e.target.value)}
          placeholder="پاک کن"
          style={{ marginTop: 10 }}
        />
      </ConfirmDialog>
    </div>
  );
}
