import { useState } from 'react';
import { Sparkles } from 'lucide-react';
import { saveSettings } from '../../database/repositories';
import { DEFAULT_SERVICES } from '../services/defaultServices';
import { db } from '../../database/db';
import { nowIso } from '../../utils/misc';

type Step = 0 | 1 | 2;

export function Onboarding() {
  const [step, setStep] = useState<Step>(0);
  const [name, setName] = useState('');
  const [salon, setSalon] = useState('');
  const [addDefaults, setAddDefaults] = useState(true);
  const [busy, setBusy] = useState(false);

  const trimmed = name.trim();

  async function finish() {
    if (!trimmed || busy) return;
    setBusy(true);
    try {
      if (addDefaults) {
        const count = await db.services.count();
        if (count === 0) {
          await db.services.bulkAdd(
            DEFAULT_SERVICES.map((s) => ({ ...s, createdAt: nowIso(), updatedAt: nowIso() })),
          );
        }
      }
      await saveSettings({
        artistName: trimmed,
        salonName: salon.trim(),
        onboardingDone: true,
      });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="app-main" style={{ paddingTop: '10vh', maxWidth: 480, margin: '0 auto' }}>
      <div style={{ textAlign: 'center', marginBottom: 26 }}>
        <div
          style={{
            width: 76,
            height: 76,
            borderRadius: 24,
            margin: '0 auto 14px',
            background: 'linear-gradient(180deg,#FF9EBE,#DB2777)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: 'var(--shadow-float)',
          }}
        >
          <Sparkles size={36} color="#fff" />
        </div>
        <h1 style={{ fontSize: 22, fontWeight: 700 }}>به NailDesk خوش آمدید 🌸</h1>
        <p className="text-secondary" style={{ marginTop: 8 }}>
          دستیار شخصی شما برای مدیریت ناخن‌سالن؛ همه‌چیز روی همین گوشی، بدون نیاز به اینترنت.
        </p>
      </div>

      <div className="card">
        {step === 0 && (
          <>
            <h2 className="card-title">چطور کار می‌کند؟</h2>
            <ul style={{ paddingInlineStart: 18, margin: 0, color: 'var(--text-2)', fontSize: 14 }}>
              <li>نوبت‌ها روی تقویم شمسی ثبت می‌شوند.</li>
              <li>طرح ناخن هر مشتری را با ویرایشگر ده‌ناخنی می‌سازید.</li>
              <li>قیمت‌ها با ماشین‌حساب و فهرست خدمات مدیریت می‌شوند.</li>
              <li>از همه داده‌ها نسخه پشتیبان JSON می‌گیرید.</li>
            </ul>
            <button
              type="button"
              className="btn btn-primary btn-block"
              style={{ marginTop: 16 }}
              onClick={() => setStep(1)}
            >
              شروع کنیم
            </button>
          </>
        )}

        {step === 1 && (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (trimmed) setStep(2);
            }}
          >
            <div className="field">
              <label className="label" htmlFor="ob-name">
                اسم شما چیه؟ *
              </label>
              <input
                id="ob-name"
                className="input"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="ساحل"
                autoComplete="name"
                enterKeyHint="next"
                autoFocus
              />
              {name.length > 0 && !trimmed && (
                <span className="field-error">نام نمی‌تواند خالی باشد</span>
              )}
            </div>
            <div className="field">
              <label className="label" htmlFor="ob-salon">
                نام سالن یا استودیو (اختیاری)
              </label>
              <input
                id="ob-salon"
                className="input"
                value={salon}
                onChange={(e) => setSalon(e.target.value)}
                placeholder="مثلاً استودیو زیبا"
                enterKeyHint="done"
              />
            </div>
            <div className="row" style={{ justifyContent: 'space-between' }}>
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => setStep(0)}>
                بازگشت
              </button>
              <button type="submit" className="btn btn-primary" disabled={!trimmed}>
                مرحله بعد
              </button>
            </div>
          </form>
        )}

        {step === 2 && (
          <>
            <h2 className="card-title">خدمات پیش‌فرض</h2>
            <p className="text-secondary" style={{ marginBottom: 12 }}>
              می‌توانید فهرست خدمات رایج را یک‌جا اضافه کنید؛ بعداً در «فهرست خدمات» قابل ویرایش است.
            </p>
            <label className="row" style={{ gap: 10, cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={addDefaults}
                onChange={(e) => setAddDefaults(e.target.checked)}
                style={{ width: 20, height: 20, accentColor: 'var(--primary)' }}
              />
              <span style={{ fontWeight: 500 }}>
                افزودن {DEFAULT_SERVICES.length} خدمت رایج ناخن (مانند مانیکور، ژلیش، کاشت)
              </span>
            </label>
            <div className="row" style={{ justifyContent: 'space-between', marginTop: 16 }}>
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => setStep(1)}>
                بازگشت
              </button>
              <button type="button" className="btn btn-primary" onClick={finish} disabled={busy}>
                {busy ? 'در حال آماده‌سازی…' : 'شروع کنیم 🌸'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
