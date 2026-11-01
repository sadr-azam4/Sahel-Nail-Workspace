import type { Nail } from '../../types';
import { hashCode, seededRandom } from '../../utils/misc';
import { nailPlatePath } from './nailGeometry';

/**
 * One nail plate with base color, pattern, finish and decorations.
 * Pure SVG (no foreignObject, no external URLs) so it exports cleanly.
 */
export function NailPlate({ nail, w, l, uid }: { nail: Nail; w: number; l: number; uid: string }) {
  const d = nailPlatePath(nail.shape, w, l);
  const pat = nail.pattern;
  const clipId = `c-${uid}`;
  const gradId = `g-${uid}`;
  const chromeId = `ch-${uid}`;
  const rnd = seededRandom(hashCode(uid));

  const elements: React.ReactNode[] = [];

  if (pat.type === 'french') {
    const t = l * 0.28;
    elements.push(
      <path
        key="fr"
        d={`M0 0 L${w} 0 L${w} ${t} Q${w / 2} ${t + l * 0.12} 0 ${t} Z`}
        fill={pat.color}
      />,
    );
  } else if (pat.type === 'stripes') {
    const count = 2 + pat.density;
    const top = l * 0.1;
    const span = l * 0.78;
    const sw = Math.max(0.8, w * 0.05);
    for (let i = 0; i < count; i++) {
      const y = top + (span * i) / (count - 1);
      elements.push(<line key={`s${i}`} x1={0} y1={y} x2={w} y2={y} stroke={pat.color} strokeWidth={sw} />);
    }
  } else if (pat.type === 'dots') {
    const rows = 1 + pat.density;
    const r = w * 0.075;
    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < 3; col++) {
        const cx = w * (0.22 + 0.28 * col) + (row % 2 === 1 ? w * 0.12 : 0);
        const cy = l * (0.12 + (0.72 * row) / Math.max(1, rows - 1));
        elements.push(<circle key={`d${row}-${col}`} cx={cx} cy={cy} r={r} fill={pat.color} />);
      }
    }
  } else if (pat.type === 'marble') {
    for (let i = 0; i < 3; i++) {
      const y0 = l * (0.15 + 0.3 * i);
      const y1 = y0 + l * (0.12 + rnd() * 0.15);
      const stroke = i % 2 === 0 ? pat.color : pat.accent;
      elements.push(
        <path
          key={`m${i}`}
          d={`M${-w * 0.1} ${y0} C${w * 0.4} ${y0 - l * 0.08} ${w * 0.6} ${y1 + l * 0.1} ${w * 1.1} ${y1}`}
          fill="none"
          stroke={stroke}
          strokeWidth={Math.max(0.8, w * 0.055)}
          opacity={0.75}
        />,
      );
    }
  }

  if (nail.finish === 'shimmer') {
    for (let i = 0; i < 9; i++) {
      elements.push(
        <circle
          key={`sh${i}`}
          cx={rnd() * w}
          cy={rnd() * l}
          r={Math.max(0.5, w * 0.028)}
          fill="#FFFFFF"
          opacity={0.85}
        />,
      );
    }
  }

  return (
    <g>
      <defs>
        <clipPath id={clipId}>
          <path d={d} />
        </clipPath>
        {pat.type === 'ombre' && (
          <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor={pat.color} />
            <stop offset="1" stopColor={nail.baseColor} />
          </linearGradient>
        )}
        {nail.finish === 'chrome' && (
          <linearGradient id={chromeId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#FFFFFF" stopOpacity="0.7" />
            <stop offset="0.45" stopColor="#FFFFFF" stopOpacity="0.05" />
            <stop offset="1" stopColor="#000000" stopOpacity="0.28" />
          </linearGradient>
        )}
      </defs>

      <path d={d} fill={pat.type === 'ombre' ? `url(#${gradId})` : nail.baseColor} />

      <g clipPath={`url(#${clipId})`}>
        {elements}
        {nail.finish === 'chrome' && <rect x={-w} y={-w} width={w * 3} height={l + w * 2} fill={`url(#${chromeId})`} />}
        {nail.finish === 'glossy' && (
          <ellipse cx={w * 0.32} cy={l * 0.34} rx={w * 0.15} ry={l * 0.18} fill="#FFFFFF" opacity={0.4} />
        )}
        <Decorations nail={nail} w={w} l={l} rnd={rnd} />
      </g>

      <path d={d} fill="none" stroke="rgba(70,30,45,0.22)" strokeWidth={Math.max(0.6, w * 0.03)} />
    </g>
  );
}

function Decorations({
  nail,
  w,
  l,
  rnd,
}: {
  nail: Nail;
  w: number;
  l: number;
  rnd: () => number;
}) {
  const out: React.ReactNode[] = [];
  nail.decorations.forEach((deco, di) => {
    if (deco.type === 'glitter') {
      for (let i = 0; i < 14; i++) {
        out.push(
          <circle
            key={`gl-${di}-${i}`}
            cx={rnd() * w}
            cy={rnd() * l}
            r={Math.max(0.5, w * (0.02 + rnd() * 0.03))}
            fill={deco.color}
            opacity={0.9}
          />,
        );
      }
    } else if (deco.type === 'rhinestone') {
      const n = deco.size + 1;
      for (let i = 0; i < n; i++) {
        const cx = w / 2 + (i % 2 === 0 ? -1 : 1) * w * 0.18 * Math.floor(i / 2);
        const cy = l * (0.2 + (0.5 * i) / Math.max(1, n - 1));
        const r = w * 0.1;
        out.push(
          <g key={`rh-${di}-${i}`}>
            <circle cx={cx} cy={cy} r={r} fill={deco.color} stroke="rgba(255,255,255,0.8)" strokeWidth={r * 0.18} />
            <circle cx={cx - r * 0.3} cy={cy - r * 0.3} r={r * 0.25} fill="#FFFFFF" opacity={0.95} />
          </g>,
        );
      }
    } else {
      const s = w * (0.14 + deco.size * 0.08);
      const cx = w * (0.3 + rnd() * 0.4);
      const cy = l * (0.25 + rnd() * 0.4);
      if (deco.type === 'heart') {
        out.push(
          <path
            key={`h-${di}`}
            d={`M0 ${0.42 * s} C ${-0.6 * s} ${-0.1 * s} ${-0.3 * s} ${-0.62 * s} 0 ${-0.22 * s} C ${0.3 * s} ${-0.62 * s} ${0.6 * s} ${-0.1 * s} 0 ${0.42 * s} Z`}
            transform={`translate(${cx} ${cy})`}
            fill={deco.color}
          />,
        );
      } else {
        const pts: string[] = [];
        for (let i = 0; i < 10; i++) {
          const rad = i % 2 === 0 ? s : s * 0.45;
          const ang = (Math.PI / 5) * i - Math.PI / 2;
          pts.push(`${Math.cos(ang) * rad},${Math.sin(ang) * rad}`);
        }
        out.push(
          <polygon
            key={`st-${di}`}
            points={pts.join(' ')}
            transform={`translate(${cx} ${cy})`}
            fill={deco.color}
          />,
        );
      }
    }
  });
  return <>{out}</>;
}
