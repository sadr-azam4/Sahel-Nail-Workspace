import type { NailShape } from '../../types';

/**
 * Nail-plate outline in local coordinates: origin at top-left of the plate,
 * tip at y=0, cuticle at y=l. Generated from parameters so it scales for
 * previews, the editor and SVG/PNG export alike.
 */
export function nailPlatePath(shape: NailShape, w: number, l: number): string {
  // 'round' needs at least a half-circle of length
  const len = shape === 'round' ? Math.max(l, w * 0.55) : Math.max(l, w * 0.35);
  const r = w * 0.18;
  switch (shape) {
    case 'square':
      return `M0 ${len} L0 ${r} Q0 0 ${r} 0 L${w - r} 0 Q${w} 0 ${w} ${r} L${w} ${len} Z`;
    case 'round': {
      const rad = w / 2;
      return `M0 ${len} L0 ${rad} A${rad} ${rad} 0 0 1 ${w} ${rad} L${w} ${len} Z`;
    }
    case 'oval':
      return (
        `M0 ${len} L0 ${len * 0.45} ` +
        `C0 ${w * 0.14} ${w * 0.2} 0 ${w / 2} 0 ` +
        `C${w * 0.8} 0 ${w} ${w * 0.14} ${w} ${len * 0.45} ` +
        `L${w} ${len} Z`
      );
    case 'almond':
      return (
        `M0 ${len} L0 ${len * 0.52} ` +
        `C0 ${len * 0.1} ${w * 0.3} ${len * 0.03} ${w / 2} 0 ` +
        `C${w * 0.7} ${len * 0.03} ${w} ${len * 0.1} ${w} ${len * 0.52} ` +
        `L${w} ${len} Z`
      );
    case 'coffin': {
      const tip = w * 0.42;
      return (
        `M0 ${len} L0 ${len * 0.55} ` +
        `L${(w - tip) / 2} ${w * 0.03} L${(w + tip) / 2} ${w * 0.03} ` +
        `L${w} ${len * 0.55} L${w} ${len} Z`
      );
    }
  }
}
