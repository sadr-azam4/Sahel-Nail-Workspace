import { useEffect, useRef, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import {
  Copy, ClipboardPaste, Download, Eraser, ImageDown, MoreVertical, Plus, Redo2,
  Save, Share2, Undo2, X,
} from 'lucide-react';
import { db } from '../../database/db';
import { loadDraft, saveDraft } from '../../database/repositories';
import type { Design, DesignStatus, FingerId, Nail, NailFinish, NailLength, NailShape, PatternType } from '../../types';
import { cx, nowIso } from '../../utils/misc';
import { toPersianDigits } from '../../utils/jalali';
import { useToast } from '../../components/common/Toasts';
import { Dialog, ConfirmDialog } from '../../components/common/Dialog';
import { Field, Segmented } from '../../components/common/UI';
import { useHistory } from '../../hooks/useHistory';
import { HandSvg } from './HandSvg';
import { NailPlate } from './NailPlate';
import {
  DECOR_TYPES, FINGER_LABELS, FINISHES, PALETTE, PATTERNS,
  SHAPES, LENGTHS, DESIGN_STATUS_LABELS,
  addDecoration, applyColorToAll, applyStyleToAll, createDesign, parseTags,
  pasteNail, removeDecoration, resetNail, updateNail,
} from './designerLogic';
import { downloadDesignSvg, shareOrDownloadDesign } from './exportDesign';

const CATEGORIES = ['کلاسیک', 'فرنچ', 'عروس', 'ژلی', 'مینیمال', 'فصلی'];

export function DesignerPage() {
  const { toast } = useToast();
  const hist = useHistory<Design>(createDesign());
  const design = hist.value;
  const [selected, setSelected] = useState<FingerId>('L3');
  const [copiedNail, setCopiedNail] = useState<Nail | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [saveState, setSaveState] = useState<'saving' | 'saved' | 'error'>('saved');
  const lastSavedRef = useRef<string | null>(null);
  const [saveDialog, setSaveDialog] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [confirmNew, setConfirmNew] = useState(false);
  const [busy, setBusy] = useState(false);

  const clients = useLiveQuery(() => db.clients.toArray(), []) ?? [];

  // Load autosaved draft once on mount.
  useEffect(() => {
    let alive = true;
    loadDraft()
      .then((d) => {
        if (!alive) return;
        if (d) {
          hist.reset(d);
          lastSavedRef.current = JSON.stringify(d);
        }
        setLoaded(true);
      })
      .catch(() => setLoaded(true));
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Debounced autosave into IndexedDB — state text only updates after the
  // storage transaction actually succeeded.
  useEffect(() => {
    if (!loaded) return;
    const json = JSON.stringify(design);
    if (lastSavedRef.current === json) return;
    setSaveState('saving');
    const t = window.setTimeout(async () => {
      try {
        await saveDraft(design);
        lastSavedRef.current = json;
        setSaveState('saved');
      } catch {
        setSaveState('error');
      }
    }, 800);
    return () => window.clearTimeout(t);
  }, [design, loaded]);

  const nail = design.nails[selected];

  const set = (next: Design) => hist.push(next);
  const patchNail = (patch: Parameters<typeof updateNail>[2]) =>
    set(updateNail(design, selected, patch));

  async function startNew() {
    const fresh = createDesign();
    hist.reset(fresh);
    lastSavedRef.current = null;
    setConfirmNew(false);
    try {
      await saveDraft(fresh);
      lastSavedRef.current = JSON.stringify(fresh);
    } catch {
      /* autosave will retry */
    }
    toast('طرح جدید آماده است');
  }

  const [form, setForm] = useState({
    title: '',
    category: 'کلاسیک',
    tags: '',
    customerId: '' as string,
    status: 'idea' as DesignStatus,
  });

  function openSaveDialog() {
    setForm({
      title: design.title,
      category: design.category || 'کلاسیک',
      tags: design.tags.join('، '),
      customerId: design.customerId ? String(design.customerId) : '',
      status: design.status,
    });
    setMenuOpen(false);
    setSaveDialog(true);
  }

  async function saveDesign() {
    const title = form.title.trim();
    if (!title) {
      toast('عنوان طرح را وارد کنید', 'error');
      return;
    }
    if (busy) return;
    setBusy(true);
    try {
      const customerId = form.customerId ? Number(form.customerId) : undefined;
      const record: Design = {
        ...design,
        title,
        category: form.category.trim() || 'کلاسیک',
        tags: parseTags(form.tags),
        customerId,
        status: form.status,
        updatedAt: nowIso(),
      };
      if (design.id) {
        await db.designs.put(record);
        hist.patchSilent({ ...record, id: design.id });
      } else {
        const id = await db.designs.add(record);
        hist.patchSilent({ ...record, id });
      }
      lastSavedRef.current = JSON.stringify(hist.value);
      setSaveDialog(false);
      toast('طرح ذخیره شد', 'success');
    } catch {
      toast('ذخیره‌سازی ناموفق بود', 'error');
    } finally {
      setBusy(false);
    }
  }

  async function doShare() {
    setMenuOpen(false);
    try {
      const r = await shareOrDownloadDesign(design);
      if (r === 'downloaded') toast('تصویر ذخیره شد', 'success');
    } catch {
      toast('اشتراک‌گذاری انجام نشد', 'error');
    }
  }

  function downloadSvg() {
    setMenuOpen(false);
    try {
      downloadDesignSvg(design);
      toast('فایل SVG ذخیره شد', 'success');
    } catch {
      toast('خروجی SVG ناموفق بود', 'error');
    }
  }

  const SAVE_STATE_TEXT = {
    saving: 'در حال ذخیره',
    saved: 'ذخیره شد',
    error: 'خطا در ذخیره‌سازی',
  } as const;

  return (
    <div>
      <div className="row-between" style={{ marginBottom: 10 }}>
        <span className={`save-state ${saveState}`}>{SAVE_STATE_TEXT[saveState]}</span>
        <div className="row" style={{ gap: 4 }}>
          <button
            type="button"
            className="icon-btn"
            onClick={hist.undo}
            disabled={!hist.canUndo}
            aria-label="واگرد"
          >
            <Undo2 size={20} />
          </button>
          <button
            type="button"
            className="icon-btn"
            onClick={hist.redo}
            disabled={!hist.canRedo}
            aria-label="ازنو"
          >
            <Redo2 size={20} />
          </button>
          <button
            type="button"
            className="icon-btn"
            onClick={openSaveDialog}
            aria-label="ذخیره طرح"
          >
            <Save size={20} />
          </button>
          <button
            type="button"
            className="icon-btn"
            onClick={() => setMenuOpen(true)}
            aria-label="گزینه‌های بیشتر"
          >
            <MoreVertical size={20} />
          </button>
        </div>
      </div>

      {/* Stage: two hands, tap a nail to select it */}
      <div className="designer-stage">
        <HandSvg
          side="left"
          nails={design.nails}
          selected={selected}
          onSelect={setSelected}
          prefix="page-l"
        />
        <HandSvg
          side="right"
          nails={design.nails}
          selected={selected}
          onSelect={setSelected}
          prefix="page-r"
        />
      </div>

      {/* Selected nail editor */}
      <div className="card">
        <div className="card-title">
          <span>{FINGER_LABELS[selected]}</span>
          {design.nails[selected].notes.trim() && (
            <span className="badge idea">یادداشت دارد</span>
          )}
        </div>

        <div className="row" style={{ gap: 14, alignItems: 'stretch', marginBottom: 14 }}>
          <svg width="84" height="108" viewBox="-10 -8 104 122" aria-hidden="true">
            <NailPlate nail={nail} w={84} l={100} uid={`sel-${selected}`} />
          </svg>
          <div style={{ flex: 1 }}>
            <div className="chips" style={{ marginBottom: 8 }}>
              {SHAPES.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  className={cx('chip', nail.shape === s.id && 'active')}
                  onClick={() => patchNail({ shape: s.id as NailShape })}
                >
                  {s.label}
                </button>
              ))}
            </div>
            <div className="chips">
              {LENGTHS.map((l) => (
                <button
                  key={l.id}
                  type="button"
                  className={cx('chip', nail.length === l.id && 'active')}
                  onClick={() => patchNail({ length: l.id as NailLength })}
                >
                  {l.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="field">
          <span className="label">رنگ اصلی</span>
          <div className="color-grid">
            {PALETTE.map((c) => (
              <button
                key={c}
                type="button"
                className={cx('color-dot', nail.baseColor.toLowerCase() === c.toLowerCase() && 'active')}
                style={{ background: c }}
                onClick={() => patchNail({ baseColor: c })}
                aria-label={`رنگ ${c}`}
              />
            ))}
            <input
              type="color"
              className="color-input"
              value={/^#[0-9a-fA-F]{6}$/.test(nail.baseColor) ? nail.baseColor : '#e75a8b'}
              onChange={(e) => patchNail({ baseColor: e.target.value })}
              aria-label="رنگ سفارشی"
              title="رنگ سفارشی"
            />
          </div>
        </div>

        <div className="field">
          <span className="label">جلا</span>
          <div className="chips">
            {FINISHES.map((f) => (
              <button
                key={f.id}
                type="button"
                className={cx('chip', nail.finish === f.id && 'active')}
                onClick={() => patchNail({ finish: f.id as NailFinish })}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>

        <div className="field">
          <span className="label">طرح (الگو)</span>
          <div className="chips">
            {PATTERNS.map((p) => (
              <button
                key={p.id}
                type="button"
                className={cx('chip', nail.pattern.type === p.id && 'active')}
                onClick={() => patchNail({ pattern: { ...nail.pattern, type: p.id as PatternType } })}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>

        {nail.pattern.type !== 'solid' && (
          <>
            <div className="grid-2">
              <div className="field">
                <span className="label">رنگ طرح</span>
                <input
                  type="color"
                  className="input"
                  style={{ padding: 4, height: 46 }}
                  value={/^#[0-9a-fA-F]{6}$/.test(nail.pattern.color) ? nail.pattern.color : '#ffffff'}
                  onChange={(e) => patchNail({ pattern: { ...nail.pattern, color: e.target.value } })}
                />
              </div>
              {(nail.pattern.type === 'marble' || nail.pattern.type === 'ombre') && (
                <div className="field">
                  <span className="label">رنگ مکمل</span>
                  <input
                    type="color"
                    className="input"
                    style={{ padding: 4, height: 46 }}
                    value={/^#[0-9a-fA-F]{6}$/.test(nail.pattern.accent) ? nail.pattern.accent : '#ffffff'}
                    onChange={(e) => patchNail({ pattern: { ...nail.pattern, accent: e.target.value } })}
                  />
                </div>
              )}
            </div>
            {(nail.pattern.type === 'stripes' || nail.pattern.type === 'dots') && (
              <div className="field">
                <span className="label">تراکم: {toPersianDigits(nail.pattern.density)}</span>
                <input
                  type="range"
                  min={1}
                  max={5}
                  value={nail.pattern.density}
                  onChange={(e) => patchNail({ pattern: { ...nail.pattern, density: Number(e.target.value) } })}
                  style={{ accentColor: 'var(--primary)' }}
                />
              </div>
            )}
          </>
        )}

        <div className="field">
          <span className="label">تزئینات</span>
          <div className="chips" style={{ marginBottom: 8 }}>
            {DECOR_TYPES.map((t) => (
              <button
                key={t.id}
                type="button"
                className="chip"
                onClick={() => {
                  set(addDecoration(design, selected, t.id, '#FFFFFF'));
                }}
              >
                <Plus size={14} /> {t.label}
              </button>
            ))}
          </div>
          {nail.decorations.length === 0 ? (
            <span className="hint">بدون تزئین — یکی از دکمه‌های بالا را بزنید.</span>
          ) : (
            <div className="stack">
              {nail.decorations.map((deco) => (
                <div key={deco.id} className="row-between" style={{ background: 'var(--surface-2)', borderRadius: 12, padding: '6px 10px' }}>
                  <span style={{ fontSize: 13 }}>
                    {DECOR_TYPES.find((t) => t.id === deco.type)?.label} — اندازه {toPersianDigits(deco.size)}
                  </span>
                  <div className="row" style={{ gap: 6 }}>
                    <input
                      type="color"
                      value={/^#[0-9a-fA-F]{6}$/.test(deco.color) ? deco.color : '#ffffff'}
                      onChange={(e) =>
                        patchNail({
                          decorations: nail.decorations.map((x) =>
                            x.id === deco.id ? { ...x, color: e.target.value } : x,
                          ),
                        })
                      }
                      style={{ width: 34, height: 34, padding: 2, border: '1px solid var(--border)', borderRadius: 8, background: 'var(--surface)' }}
                      aria-label="رنگ تزئین"
                    />
                    <button
                      type="button"
                      className="icon-btn"
                      style={{ width: 34, height: 34 }}
                      onClick={() => set(removeDecoration(design, selected, deco.id))}
                      aria-label="حذف تزئین"
                    >
                      <X size={16} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <Field label="یادداشت این ناخن">
          <textarea
            className="textarea"
            value={nail.notes}
            onChange={(e) => patchNail({ notes: e.target.value })}
            placeholder="مثلاً سنگ‌ها کوچک‌تر شود"
          />
        </Field>

        <div className="chips">
          <button
            type="button"
            className="chip"
            onClick={() => {
              setCopiedNail({ ...nail });
              toast('ویژگی‌های این ناخن کپی شد؛ ناخن دیگر را انتخاب و «چسباندن» را بزنید');
            }}
          >
            <Copy size={14} /> کپی این ناخن
          </button>
          <button
            type="button"
            className={cx('chip', copiedNail && 'active')}
            disabled={!copiedNail}
            onClick={() => {
              if (!copiedNail) return;
              set(pasteNail(design, selected, copiedNail));
            }}
          >
            <ClipboardPaste size={14} /> چسباندن{copiedNail ? ` (${FINGER_LABELS[copiedNail.finger]})` : ''}
          </button>
          <button
            type="button"
            className="chip"
            onClick={() => set(applyColorToAll(design, nail.baseColor))}
          >
            <Copy size={14} /> این رنگ برای همه
          </button>
          <button
            type="button"
            className="chip"
            onClick={() => set(applyStyleToAll(design, selected))}
          >
            <Copy size={14} /> استایل کامل برای همه
          </button>
          <button type="button" className="chip" onClick={() => set(resetNail(design, selected))}>
            <Eraser size={14} /> بازنشانی این ناخن
          </button>
        </div>
      </div>

      {/* More menu */}
      <Dialog open={menuOpen} onClose={() => setMenuOpen(false)} title="گزینه‌ها" center>
        <div className="stack">
          <button type="button" className="btn btn-ghost btn-block" onClick={openSaveDialog}>
            <Save size={18} /> ذخیره در گالری
          </button>
          <button
            type="button"
            className="btn btn-ghost btn-block"
            onClick={async () => {
              setMenuOpen(false);
              try {
                const r = await shareOrDownloadDesign(design);
                if (r === 'downloaded') toast('تصویر PNG ذخیره شد', 'success');
              } catch {
                toast('خروجی PNG ناموفق بود', 'error');
              }
            }}
          >
            <ImageDown size={18} /> خروجی تصویر (PNG)
          </button>
          <button type="button" className="btn btn-ghost btn-block" onClick={downloadSvg}>
            <Download size={18} /> خروجی برداری (SVG)
          </button>
          <button type="button" className="btn btn-ghost btn-block" onClick={doShare}>
            <Share2 size={18} /> اشتراک‌گذاری
          </button>
          <button type="button" className="btn btn-danger-soft btn-block" onClick={() => { setMenuOpen(false); setConfirmNew(true); }}>
            <Plus size={18} /> شروع طراحی جدید
          </button>
        </div>
      </Dialog>

      {/* Save dialog */}
      <Dialog
        open={saveDialog}
        onClose={() => setSaveDialog(false)}
        title={design.id ? 'به‌روزرسانی طرح' : 'ذخیره طرح در گالری'}
        footer={
          <>
            <button type="button" className="btn btn-ghost" onClick={() => setSaveDialog(false)} disabled={busy}>
              انصراف
            </button>
            <button type="button" className="btn btn-primary" onClick={saveDesign} disabled={busy}>
              {busy ? 'در حال ذخیره…' : 'ذخیره'}
            </button>
          </>
        }
      >
        <Field label="عنوان طرح" required>
          <input
            className="input"
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
            placeholder="مثلاً فرنچ صورتی عروس"
            autoFocus
          />
        </Field>
        <Field label="دسته">
          <input
            className="input"
            value={form.category}
            onChange={(e) => setForm({ ...form, category: e.target.value })}
            list="designer-categories"
            placeholder="کلاسیک"
          />
          <datalist id="designer-categories">
            {CATEGORIES.map((c) => (
              <option key={c} value={c} />
            ))}
          </datalist>
        </Field>
        <Field label="برچسب‌ها" hint="با ویرگول جدا کنید">
          <input
            className="input"
            value={form.tags}
            onChange={(e) => setForm({ ...form, tags: e.target.value })}
            placeholder="صورتی، ساده، تابستانی"
          />
        </Field>
        <Field label="مشتری (اختیاری)">
          <select
            className="select"
            value={form.customerId}
            onChange={(e) => setForm({ ...form, customerId: e.target.value })}
          >
            <option value="">بدون مشتری</option>
            {clients.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="وضعیت">
          <Segmented
            value={form.status}
            onChange={(v) => setForm({ ...form, status: v })}
            options={[
              { id: 'idea' as DesignStatus, label: DESIGN_STATUS_LABELS.idea },
              { id: 'proposed' as DesignStatus, label: DESIGN_STATUS_LABELS.proposed },
              { id: 'approved' as DesignStatus, label: DESIGN_STATUS_LABELS.approved },
            ]}
          />
        </Field>
      </Dialog>

      <ConfirmDialog
        open={confirmNew}
        onClose={() => setConfirmNew(false)}
        title="شروع طراحی جدید؟"
        message="طرح فعلی اگر در گالری ذخیره نشده باشد، با طرح خالی جایگزین می‌شود. ادامه می‌دهید؟"
        confirmLabel="طرح جدید"
        danger
        onConfirm={startNew}
      />
    </div>
  );
}
