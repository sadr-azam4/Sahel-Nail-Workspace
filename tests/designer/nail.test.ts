import { describe, expect, it } from 'vitest';
import {
  createDesign, updateNail, applyColorToAll, applyStyleToAll, resetNail,
  cloneDesign, addDecoration, removeDecoration, createNail, FINGERS, parseTags,
  pasteNail,
} from '../../src/features/nail-designer/designerLogic';
import { createHistory } from '../../src/hooks/history';
import { nailPlatePath } from '../../src/features/nail-designer/nailGeometry';

describe('per-nail isolation', () => {
  it('createDesign embeds exactly ten nails', () => {
    const d = createDesign();
    expect(Object.keys(d.nails).sort()).toEqual([...FINGERS].sort());
  });

  it('updating one nail never mutates the original nor other nails', () => {
    const d = createDesign();
    const before = JSON.stringify(d);
    const d2 = updateNail(d, 'L3', { baseColor: '#111111', shape: 'almond' });
    expect(JSON.stringify(d)).toBe(before); // original untouched
    expect(d2.nails.L3.baseColor).toBe('#111111');
    expect(d.nails.L3.baseColor).not.toBe('#111111');
    // untouched nail keeps object identity (no accidental copies/mutations)
    expect(d2.nails.L2).toBe(d.nails.L2);
    expect(d2.nails.R5).toBe(d.nails.R5);
  });

  it('resetNail returns the nail to defaults', () => {
    const d = updateNail(createDesign(), 'R1', { baseColor: '#000000' });
    const d2 = resetNail(d, 'R1');
    expect(d2.nails.R1).toEqual(createNail('R1'));
  });
});

describe('apply-to-all (explicit user actions)', () => {
  it('applyColorToAll sets color on all ten nails', () => {
    const d = applyColorToAll(createDesign(), '#FF0000');
    for (const f of FINGERS) expect(d.nails[f].baseColor).toBe('#FF0000');
  });

  it('applyStyleToAll copies shape/length/finish/pattern but not decorations', () => {
    let d = createDesign();
    d = updateNail(d, 'L1', {
      shape: 'coffin',
      length: 'xl',
      finish: 'matte',
      pattern: { type: 'french', color: '#FFFFFF', accent: '#FFFFFF', density: 3 },
      decorations: [{ id: 'x', type: 'heart', color: '#FF0000', size: 2 }],
    });
    d = applyStyleToAll(d, 'L1');
    for (const f of FINGERS) {
      expect(d.nails[f].shape).toBe('coffin');
      expect(d.nails[f].length).toBe('xl');
      expect(d.nails[f].finish).toBe('matte');
      expect(d.nails[f].pattern.type).toBe('french');
    }
    // only L1 has the heart
    expect(d.nails.L1.decorations).toHaveLength(1);
    expect(d.nails.R3.decorations).toHaveLength(0);
  });
});

describe('decorations', () => {
  it('adds and removes by id', () => {
    let d = addDecoration(createDesign(), 'L5', 'star', '#FFFFFF');
    expect(d.nails.L5.decorations).toHaveLength(1);
    const id = d.nails.L5.decorations[0].id;
    d = removeDecoration(d, 'L5', id);
    expect(d.nails.L5.decorations).toHaveLength(0);
  });

  it('caps decorations at 8 per nail', () => {
    let d = createDesign();
    for (let i = 0; i < 12; i++) d = addDecoration(d, 'R2', 'glitter', '#FFFFFF');
    expect(d.nails.R2.decorations).toHaveLength(8);
  });
});

describe('copy & paste between nails', () => {
  it('pasteNail copies visual properties but never the notes', () => {
    let d = createDesign();
    d = updateNail(d, 'L1', {
      shape: 'coffin',
      length: 'xl',
      baseColor: '#101010',
      finish: 'matte',
      pattern: { type: 'marble', color: '#FFAAAA', accent: '#FFFFFF', density: 4 },
      decorations: [{ id: 'src-1', type: 'rhinestone', color: '#FFFFFF', size: 3 }],
      notes: 'یادداشت ناخن مبدا',
    });
    d = updateNail(d, 'R4', { notes: 'یادداشت شخصی ناخن مقصد' });

    const out = pasteNail(d, 'R4', d.nails.L1);

    expect(out.nails.R4.shape).toBe('coffin');
    expect(out.nails.R4.length).toBe('xl');
    expect(out.nails.R4.baseColor).toBe('#101010');
    expect(out.nails.R4.finish).toBe('matte');
    expect(out.nails.R4.pattern.type).toBe('marble');
    expect(out.nails.R4.decorations).toHaveLength(1);
    // notes belong to the finger and are never overwritten by paste
    expect(out.nails.R4.notes).toBe('یادداشت شخصی ناخن مقصد');
    // source nail untouched
    expect(out.nails.L1.notes).toBe('یادداشت ناخن مبدا');
  });

  it('pasteNail regenerates decoration ids so both nails stay independent', () => {
    let d = createDesign();
    d = addDecoration(d, 'L2', 'star', '#FFFFFF');
    const src = d.nails.L2;

    const out = pasteNail(d, 'R5', src);
    const pastedId = out.nails.R5.decorations[0].id;
    expect(pastedId).not.toBe(src.decorations[0].id);

    // removing the decoration on the pasted nail leaves the source intact
    const pruned = removeDecoration(out, 'R5', pastedId);
    expect(pruned.nails.R5.decorations).toHaveLength(0);
    expect(pruned.nails.L2.decorations).toHaveLength(1);
  });

  it('pasting never mutates the input design', () => {
    const d = updateNail(createDesign(), 'L3', { baseColor: '#432100' });
    const before = JSON.stringify(d);
    pasteNail(d, 'R1', d.nails.L3);
    expect(JSON.stringify(d)).toBe(before);
  });
});

describe('cloneDesign', () => {
  it('creates an independent new record, never mutating the source', () => {
    const d = updateNail(createDesign(), 'L3', { baseColor: '#222222' });
    d.id = 7;
    d.title = 'اصلی';
    const copy = cloneDesign(d);
    expect(copy.id).toBeUndefined();
    expect(copy.title).toBe('اصلی (کپی)');
    expect(copy.nails.L3.baseColor).toBe('#222222');
    expect(copy.nails).not.toBe(d.nails);
    // mutate copy freely — source unchanged
    copy.nails.L3.baseColor = '#333333';
    expect(d.nails.L3.baseColor).toBe('#222222');
  });
});

describe('undo/redo history (bounded 50, deep-cloned)', () => {
  it('push/undo/redo round-trips', () => {
    const h = createHistory<{ v: number }>({ v: 0 });
    h.push({ v: 1 });
    h.push({ v: 2 });
    expect(h.get().v).toBe(2);
    expect(h.undo()?.v).toBe(1);
    expect(h.undo()?.v).toBe(0);
    expect(h.undo()).toBeUndefined();
    expect(h.redo()?.v).toBe(1);
    expect(h.redo()?.v).toBe(2);
    expect(h.redo()).toBeUndefined();
  });

  it('push clears the redo stack', () => {
    const h = createHistory<{ v: number }>({ v: 0 });
    h.push({ v: 1 });
    h.undo();
    expect(h.canRedo()).toBe(true);
    h.push({ v: 5 });
    expect(h.canRedo()).toBe(false);
    expect(h.undo()?.v).toBe(0);
  });

  it('is bounded at 50 entries', () => {
    const h = createHistory<{ v: number }>({ v: 0 });
    for (let i = 1; i <= 60; i++) h.push({ v: i });
    expect(h.undoCount()).toBe(50);
    // oldest reachable state is v=10 (60 − 50)
    let last = -1;
    while (h.canUndo()) last = h.undo()?.v ?? -1;
    expect(last).toBe(10);
  });

  it('deep-clones so later mutations never leak into history', () => {
    const h = createHistory<{ nested: { v: number } }>({ nested: { v: 0 } });
    const state = { nested: { v: 1 } };
    h.push(state);
    state.nested.v = 999; // mutate after push
    expect(h.get().nested.v).toBe(1);
  });

  it('reset clears both stacks; patchSilent keeps them', () => {
    const h = createHistory<{ v: number }>({ v: 0 });
    h.push({ v: 1 });
    h.reset({ v: 9 });
    expect(h.canUndo()).toBe(false);
    h.push({ v: 10 });
    h.patchSilent({ v: 11 });
    expect(h.canUndo()).toBe(true);
    expect(h.undo()?.v).toBe(9);
  });
});

describe('nail geometry', () => {
  it('generates valid plate paths for every shape', () => {
    for (const shape of ['square', 'round', 'almond', 'coffin', 'oval'] as const) {
      const path = nailPlatePath(shape, 20, 26);
      expect(path).toMatch(/^M0 /);
      expect(path).toContain('Z');
      // no NaN
      expect(path).not.toContain('NaN');
    }
  });
});

describe('parseTags', () => {
  it('splits on Persian and Latin commas', () => {
    expect(parseTags('صورتی، تابستانی, ساده')).toEqual(['صورتی', 'تابستانی', 'ساده']);
  });

  it('drops empties', () => {
    expect(parseTags('  ،  , x ')).toEqual(['x']);
  });
});
