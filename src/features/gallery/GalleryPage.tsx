import { useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { Copy, Download, Heart, ImageDown, Images, Pencil, Plus, Star, Trash2 } from 'lucide-react';
import { db } from '../../database/db';
import { useNav } from '../../appContext';
import { useToast } from '../../components/common/Toasts';
import { ConfirmDialog, Dialog } from '../../components/common/Dialog';
import { EmptyState } from '../../components/common/UI';
import { HandContent } from '../nail-designer/HandSvg';
import { DESIGN_STATUS_LABELS, cloneDesign, createDesign } from '../nail-designer/designerLogic';
import { saveDraft } from '../../database/repositories';
import { nowIso } from '../../utils/misc';
import { formatJalali, isoToLocalDateKey } from '../../utils/jalali';
import { downloadDesignSvg, shareOrDownloadDesign } from '../nail-designer/exportDesign';
import type { Design, DesignStatus } from '../../types';
import { cx } from '../../utils/misc';

type StatusFilter = 'all' | DesignStatus | 'favorites';

export function GalleryPage() {
  const { navigate } = useNav();
  const { toast } = useToast();
  const designs = useLiveQuery(() => db.designs.toArray(), []);
  const [q, setQ] = useState('');
  const [filter, setFilter] = useState<StatusFilter>('all');
  const [viewer, setViewer] = useState<Design | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Design | null>(null);
  const [busy, setBusy] = useState(false);

  const filtered = useMemo(() => {
    let list = [...(designs ?? [])].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
    if (filter === 'favorites') list = list.filter((d) => d.favorite);
    else if (filter !== 'all') list = list.filter((d) => d.status === filter);
    const query = q.trim();
    if (query) {
      list = list.filter(
        (d) =>
          d.title.includes(query) ||
          d.category.includes(query) ||
          d.tags.some((t) => t.includes(query)),
      );
    }
    return list;
  }, [designs, q, filter]);

  async function editDesign(d: Design) {
    // Load a deep clone into the designer draft — the saved design itself
    // is never mutated until the user explicitly saves.
    await saveDraft(cloneDesign(d));
    navigate('designer');
  }

  async function duplicate(d: Design) {
    const copy = cloneDesign(d);
    copy.favorite = false;
    await db.designs.add(copy);
    toast('طرح تکثیر شد', 'success');
  }

  async function toggleFavorite(d: Design) {
    if (d.id === undefined) return;
    await db.designs.update(d.id, { favorite: !d.favorite, updatedAt: nowIso() });
    if (viewer?.id === d.id) setViewer({ ...viewer, favorite: !d.favorite });
  }

  async function confirmDelete() {
    if (!deleteTarget?.id || busy) return;
    setBusy(true);
    try {
      await db.designs.delete(deleteTarget.id);
      setViewer(null);
      setDeleteTarget(null);
      toast('طرح حذف شد');
    } finally {
      setBusy(false);
    }
  }

  async function exportPng(d: Design) {
    try {
      const r = await shareOrDownloadDesign(d);
      if (r === 'downloaded') toast('تصویر PNG ذخیره شد', 'success');
    } catch {
      toast('خروجی PNG ناموفق بود', 'error');
    }
  }

  function exportSvg(d: Design) {
    try {
      downloadDesignSvg(d);
      toast('فایل SVG ذخیره شد', 'success');
    } catch {
      toast('خروجی SVG ناموفق بود', 'error');
    }
  }

  return (
    <div>
      <div className="searchbar">
        <input
          className="input"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="جست‌وجوی عنوان، دسته یا برچسب…"
          aria-label="جست‌وجو در طرح‌ها"
        />
        <Images size={17} aria-hidden="true" />
      </div>

      <div className="chips" style={{ marginBottom: 14 }}>
        <button type="button" className={cx('chip', filter === 'all' && 'active')} onClick={() => setFilter('all')}>
          همه
        </button>
        {(['idea', 'proposed', 'approved', 'favorites'] as StatusFilter[]).map((f) => (
          <button key={f} type="button" className={cx('chip', filter === f && 'active')} onClick={() => setFilter(f)}>
            {f === 'favorites' ? 'علاقه‌مندی‌ها' : DESIGN_STATUS_LABELS[f as DesignStatus]}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div className="card">
          <EmptyState
            icon={<Images size={38} />}
            text="هنوز طرحی اینجا نیست. از تب «طراحی» یک طرح بسازید و ذخیره کنید."
          />
        </div>
      ) : (
        <div className="gallery-grid">
          {filtered.map((d) => (
            <div key={d.id} className="gallery-card">
              <button
                type="button"
                className="gallery-thumb"
                onClick={() => setViewer(d)}
                aria-label={`مشاهده طرح ${d.title || 'بدون عنوان'}`}
              >
                <svg viewBox="0 0 520 250" style={{ width: '100%', height: 'auto', display: 'block' }} aria-hidden="true">
                  <HandContent prefix={`gal-${d.id}-l`} side="left" nails={d.nails} selected={null} />
                  <g transform="translate(260,0)">
                    <HandContent prefix={`gal-${d.id}-r`} side="right" nails={d.nails} selected={null} />
                  </g>
                </svg>
              </button>
              <div className="gallery-card-info">
                <div className="row-between">
                  <span className="gallery-card-title">{d.title || 'بدون عنوان'}</span>
                  <button
                    type="button"
                    className="icon-btn"
                    style={{ width: 30, height: 30 }}
                    onClick={() => toggleFavorite(d)}
                    aria-label={d.favorite ? 'حذف از علاقه‌مندی‌ها' : 'افزودن به علاقه‌مندی‌ها'}
                  >
                    <Star size={17} color={d.favorite ? '#F5A623' : 'var(--text-2)'} fill={d.favorite ? '#F5A623' : 'none'} />
                  </button>
                </div>
                <div className="row-between" style={{ marginTop: 4 }}>
                  <span className="badge idea">{d.category}</span>
                  <span className={cx('badge', d.status)}>{DESIGN_STATUS_LABELS[d.status]}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <button
        type="button"
        className="fab"
        onClick={() => {
          void saveDraft(createDesign()).then(() => navigate('designer'));
        }}
        aria-label="طرح جدید"
      >
        <Plus size={26} />
      </button>

      {/* Viewer dialog */}
      <Dialog open={viewer !== null} onClose={() => setViewer(null)} title={viewer?.title || 'بدون عنوان'}>
        {viewer && (
          <>
            <svg viewBox="0 0 520 250" style={{ width: '100%', height: 'auto' }} aria-hidden="true">
              <HandContent prefix={`vw-${viewer.id}-l`} side="left" nails={viewer.nails} selected={null} />
              <g transform="translate(260,0)">
                <HandContent prefix={`vw-${viewer.id}-r`} side="right" nails={viewer.nails} selected={null} />
              </g>
            </svg>
            <div className="chips" style={{ margin: '10px 0' }}>
              <span className="badge idea">{viewer.category}</span>
              <span className={cx('badge', viewer.status)}>{DESIGN_STATUS_LABELS[viewer.status]}</span>
              {viewer.tags.map((t) => (
                <span key={t} className="chip" style={{ minHeight: 26, fontSize: 11.5 }}>
                  #{t}
                </span>
              ))}
            </div>
            <p className="text-secondary">
              آخرین ویرایش: {formatJalali(isoToLocalDateKey(viewer.updatedAt))}
            </p>
            <div className="grid-2" style={{ marginTop: 12 }}>
              <button type="button" className="btn btn-ghost" onClick={() => void exportPng(viewer)}>
                <ImageDown size={17} /> خروجی PNG
              </button>
              <button type="button" className="btn btn-ghost" onClick={() => exportSvg(viewer)}>
                <Download size={17} /> خروجی SVG
              </button>
              <button type="button" className="btn btn-ghost" onClick={() => toggleFavorite(viewer)}>
                <Heart size={17} color={viewer.favorite ? '#F5A623' : undefined} fill={viewer.favorite ? '#F5A623' : 'none'} />
                {viewer.favorite ? 'حذف علاقه‌مندی' : 'علاقه‌مندی'}
              </button>
              <button type="button" className="btn btn-ghost" onClick={() => void duplicate(viewer)}>
                <Copy size={17} /> تکثیر
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => {
                  const target = viewer;
                  setViewer(null);
                  void editDesign(target);
                }}
              >
                <Pencil size={17} /> ویرایش
              </button>
              <button type="button" className="btn btn-danger-soft" onClick={() => setDeleteTarget(viewer)}>
                <Trash2 size={17} /> حذف
              </button>
            </div>
          </>
        )}
      </Dialog>

      <ConfirmDialog
        open={deleteTarget !== null}
        onClose={() => setDeleteTarget(null)}
        title="حذف طرح"
        message={`طرح «${deleteTarget?.title || 'بدون عنوان'}» برای همیشه حذف می‌شود. مطمئنید؟`}
        confirmLabel="حذف کن"
        danger
        busy={busy}
        onConfirm={confirmDelete}
      />
    </div>
  );
}
