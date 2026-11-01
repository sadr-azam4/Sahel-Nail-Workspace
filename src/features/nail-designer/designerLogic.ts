// ---------------------------------------------------------------------------
// Pure nail-design logic. Every function returns a NEW design object and
// never mutates its input — changing one nail must never affect another.
// Saved designs and gallery presets are never touched by these functions.
// ---------------------------------------------------------------------------

import type {
  DecorationType,
  Design,
  FingerId,
  Nail,
  NailFinish,
  NailLength,
  NailShape,
  NailsMap,
  PatternType,
} from '../../types';
import { nowIso, uid } from '../../utils/misc';

export const FINGERS: FingerId[] = ['L1', 'L2', 'L3', 'L4', 'L5', 'R1', 'R2', 'R3', 'R4', 'R5'];

/** L1..L5 = شست، اشاره، وسط، حلقه، کوچک (same for R). */
export const FINGER_LABELS: Record<FingerId, string> = {
  L1: 'شست چپ', L2: 'اشاره چپ', L3: 'وسط چپ', L4: 'حلقه چپ', L5: 'کوچک چپ',
  R1: 'شست راست', R2: 'اشاره راست', R3: 'وسط راست', R4: 'حلقه راست', R5: 'کوچک راست',
};

export const SHAPES: Array<{ id: NailShape; label: string }> = [
  { id: 'square', label: 'چهارگوش' },
  { id: 'round', label: 'گرد' },
  { id: 'almond', label: 'بادامی' },
  { id: 'coffin', label: 'بالرینا' },
  { id: 'oval', label: 'بیضی' },
];

export const LENGTHS: Array<{ id: NailLength; label: string; scale: number }> = [
  { id: 'short', label: 'کوتاه', scale: 0.8 },
  { id: 'medium', label: 'متوسط', scale: 1.05 },
  { id: 'long', label: 'بلند', scale: 1.3 },
  { id: 'xl', label: 'خیلی بلند', scale: 1.6 },
];

export const FINISHES: Array<{ id: NailFinish; label: string }> = [
  { id: 'glossy', label: 'براق' },
  { id: 'matte', label: 'مات' },
  { id: 'shimmer', label: 'شیمر' },
  { id: 'chrome', label: 'کروم' },
];

export const PATTERNS: Array<{ id: PatternType; label: string }> = [
  { id: 'solid', label: 'ساده' },
  { id: 'french', label: 'فرنچ' },
  { id: 'ombre', label: 'امبره' },
  { id: 'stripes', label: 'خط‌دار' },
  { id: 'dots', label: 'خال‌خالی' },
  { id: 'marble', label: 'مرمری' },
];

export const DECOR_TYPES: Array<{ id: DecorationType; label: string }> = [
  { id: 'glitter', label: 'گلیتر' },
  { id: 'rhinestone', label: 'سنگ' },
  { id: 'heart', label: 'قلب' },
  { id: 'star', label: 'ستاره' },
];

export const PALETTE: string[] = [
  '#FFFFFF', '#FCE4EC', '#F8BBD0', '#F48FB1',
  '#E75A8B', '#D81B60', '#C2185B', '#880E4F',
  '#E8C4A0', '#D7A583', '#C68642', '#8D5524',
  '#FFD54F', '#FF8F00', '#FF7043', '#E65100',
  '#A5D6A7', '#66BB6A', '#2E7D32', '#1B5E20',
  '#90CAF9', '#1E88E5', '#3949AB', '#7E57C2',
  '#B39DDB', '#B0BEC5', '#546E7A', '#212121',
];

export function lengthScale(l: NailLength): number {
  return LENGTHS.find((x) => x.id === l)?.scale ?? 1;
}

export function createNail(finger: FingerId): Nail {
  return {
    finger,
    shape: 'square',
    length: 'medium',
    baseColor: '#E75A8B',
    finish: 'glossy',
    pattern: { type: 'solid', color: '#FFFFFF', accent: '#FFFFFF', density: 3 },
    decorations: [],
    notes: '',
  };
}

export function createDesign(): Design {
  const nails = {} as NailsMap;
  for (const f of FINGERS) nails[f] = createNail(f);
  return {
    title: '',
    status: 'idea',
    category: 'کلاسیک',
    tags: [],
    nails,
    favorite: false,
    createdAt: nowIso(),
    updatedAt: nowIso(),
  };
}

/** Patch ONE nail. All other nails keep both value AND object identity. */
export function updateNail(
  design: Design,
  finger: FingerId,
  patch: Partial<Omit<Nail, 'finger'>>,
): Design {
  const prev = design.nails[finger];
  const next: Nail = { ...prev, ...patch, finger };
  return { ...design, nails: { ...design.nails, [finger]: next } };
}

export function applyColorToAll(design: Design, color: string): Design {
  const nails = {} as NailsMap;
  for (const f of FINGERS) {
    nails[f] = { ...design.nails[f], baseColor: color };
  }
  return { ...design, nails };
}

/** Copies shape/length/finish/pattern (NOT decorations/notes) to all nails. */
export function applyStyleToAll(design: Design, from: FingerId): Design {
  const src = design.nails[from];
  const nails = {} as NailsMap;
  for (const f of FINGERS) {
    nails[f] = {
      ...design.nails[f],
      shape: src.shape,
      length: src.length,
      finish: src.finish,
      pattern: { ...src.pattern },
    };
  }
  return { ...design, nails };
}

export function resetNail(design: Design, finger: FingerId): Design {
  const fresh = createNail(finger);
  return updateNail(design, finger, {
    shape: fresh.shape,
    length: fresh.length,
    baseColor: fresh.baseColor,
    finish: fresh.finish,
    pattern: fresh.pattern,
    decorations: fresh.decorations,
    notes: fresh.notes,
  });
}

/**
 * Pastes a copied nail onto another finger. Copies every visual property
 * (shape, length, color, finish, pattern, decorations) while keeping the
 * target's own notes. Decoration ids are regenerated so both nails stay
 * independently editable afterwards.
 */
export function pasteNail(design: Design, target: FingerId, source: Nail): Design {
  return updateNail(design, target, {
    shape: source.shape,
    length: source.length,
    baseColor: source.baseColor,
    finish: source.finish,
    pattern: { ...source.pattern },
    decorations: source.decorations.map((dc) => ({ ...dc, id: uid() })),
    // notes intentionally NOT copied — they belong to the specific finger
  });
}

export function clearAllDecorations(design: Design, finger: FingerId): Design {
  return updateNail(design, finger, { decorations: [] });
}

export function addDecoration(
  design: Design,
  finger: FingerId,
  type: DecorationType,
  color: string,
): Design {
  const nail = design.nails[finger];
  if (nail.decorations.length >= 8) return design;
  const item = { id: uid(), type, color, size: 2 };
  return updateNail(design, finger, { decorations: [...nail.decorations, item] });
}

export function removeDecoration(design: Design, finger: FingerId, decoId: string): Design {
  const nail = design.nails[finger];
  return updateNail(design, finger, {
    decorations: nail.decorations.filter((d) => d.id !== decoId),
  });
}

/** Duplicates a saved design as a NEW record (never mutates the original). */
export function cloneDesign(design: Design): Design {
  return {
    ...cloneDesignData(design),
    id: undefined,
    title: design.title ? `${design.title} (کپی)` : 'طرح بدون عنوان (کپی)',
    createdAt: nowIso(),
    updatedAt: nowIso(),
  };
}

export function cloneDesignData(design: Design): Design {
  return JSON.parse(JSON.stringify(design)) as Design;
}

export function parseTags(input: string): string[] {
  return input
    .split(/[،,]/)
    .map((t) => t.trim())
    .filter((t) => t.length > 0)
    .slice(0, 12);
}

export const DESIGN_STATUS_LABELS: Record<Design['status'], string> = {
  idea: 'ایده',
  proposed: 'پیشنهاد به مشتری',
  approved: 'تأیید شده',
};
