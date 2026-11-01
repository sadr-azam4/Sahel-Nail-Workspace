// ---------------------------------------------------------------------------
// SVG export validity — the exported file must be a standalone, self-contained
// SVG: XML prolog + <svg> root, no foreignObject, no external references
// (href/src pointing to the network), and it must render all ten nails.
// PNG rasterization itself needs a real browser canvas and is covered by the
// manual/browser smoke test, not by this Node-based suite.
// ---------------------------------------------------------------------------
import { describe, expect, it } from 'vitest';
import { createDesign, updateNail, addDecoration } from '../../src/features/nail-designer/designerLogic';
import { designToSvgString } from '../../src/features/nail-designer/exportDesign';

function richDesign() {
  let d = createDesign();
  d.title = 'طرح آزمایشی';
  d = updateNail(d, 'L1', { shape: 'almond', baseColor: '#123456' });
  d = updateNail(d, 'R3', { pattern: { type: 'french', color: '#FFFFFF', accent: '#FFFFFF', density: 3 } });
  d = addDecoration(d, 'R3', 'rhinestone', '#FFFFFF');
  return d;
}

describe('designToSvgString', () => {
  const svg = designToSvgString(richDesign());

  it('starts with an XML prolog and contains exactly one svg root', () => {
    expect(svg.startsWith('<?xml version="1.0" encoding="UTF-8"?>')).toBe(true);
    expect(svg.match(/<svg\b/g)?.length).toBe(1);
    expect(svg.includes('</svg>')).toBe(true);
    expect(svg.includes('xmlns="http://www.w3.org/2000/svg"')).toBe(true);
  });

  it('contains no foreignObject (iOS-safe rasterization)', () => {
    expect(svg.toLowerCase()).not.toContain('foreignobject');
  });

  it('references no external resources (fully offline-safe)', () => {
    // Any href/src attribute (if present) must not point at the network.
    const refs = [...svg.matchAll(/(?:href|src)="([^"]*)"/g)].map((m) => m[1]);
    for (const r of refs) {
      expect(r.startsWith('#') || r.startsWith('data:')).toBe(true);
    }
    expect(svg).not.toMatch(/https?:\/\/(?!www\.w3\.org)/);
    // Fill references are internal-only: url(#…) never url(http…)
    expect(svg).not.toContain('url(http');
  });

  it('embeds the design title text', () => {
    expect(svg).toContain('طرح آزمایشی');
  });

  it('renders nail geometry (path elements) for the hands', () => {
    expect((svg.match(/<path\b/g) ?? []).length).toBeGreaterThanOrEqual(10);
    expect(svg).not.toContain('NaN');
    expect(svg).not.toContain('undefined');
  });

  it('output differs when the design differs (no stale caching)', () => {
    const other = designToSvgString(updateNail(richDesign(), 'L5', { baseColor: '#000000' }));
    expect(other).not.toBe(svg);
  });
});
