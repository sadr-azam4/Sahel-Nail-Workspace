import type { FingerId, NailsMap } from '../../types';
import { lengthScale } from './designerLogic';
import { NailPlate } from './NailPlate';

const SKIN = '#F6D8CA';
const SKIN_EDGE = '#E8BCAB';

interface FingerDef {
  finger: FingerId;
  x: number;
  w: number;
  tip: number;
  h: number;
}

interface HandGeometry {
  fingers: FingerDef[];
  thumb: FingerDef;
  thumbAngle: number;
  thumbPivot: { x: number; y: number };
  palm: { x: number; y: number; w: number; h: number };
}

const LEFT: HandGeometry = {
  fingers: [
    { finger: 'L5', x: 8, w: 30, tip: 74, h: 121 },
    { finger: 'L4', x: 42, w: 33, tip: 44, h: 151 },
    { finger: 'L3', x: 79, w: 35, tip: 32, h: 163 },
    { finger: 'L2', x: 118, w: 33, tip: 46, h: 149 },
  ],
  thumb: { finger: 'L1', x: 132, w: 38, tip: 70, h: 135 },
  thumbAngle: 32,
  thumbPivot: { x: 150, y: 200 },
  palm: { x: 8, y: 158, w: 143, h: 72 },
};

function mirror(g: HandGeometry): HandGeometry {
  const mx = (x: number, w: number) => 260 - x - w;
  return {
    fingers: g.fingers.map((f) => ({ ...f, x: mx(f.x, f.w) })),
    thumb: { ...g.thumb, x: mx(g.thumb.x, g.thumb.w) },
    thumbAngle: -g.thumbAngle,
    thumbPivot: { x: 260 - g.thumbPivot.x, y: g.thumbPivot.y },
    palm: { ...g.palm, x: mx(g.palm.x, g.palm.w) },
  };
}

const RIGHT: HandGeometry = mirror(LEFT);

export interface HandContentProps {
  side: 'left' | 'right';
  nails: NailsMap;
  selected?: FingerId | null;
  onSelect?: (f: FingerId) => void;
  prefix: string;
}

/**
 * Hand geometry WITHOUT the <svg> wrapper — reused by the editor, gallery
 * thumbnails and the SVG/PNG exporter (which provides its own root svg).
 */
export function HandContent({ side, nails, selected, onSelect, prefix }: HandContentProps) {
  const g = side === 'left' ? LEFT : RIGHT;
  return (
    <>
      <rect
        x={g.palm.x}
        y={g.palm.y}
        width={g.palm.w}
        height={g.palm.h}
        rx={26}
        fill={SKIN}
        stroke={SKIN_EDGE}
        strokeWidth={1.5}
      />
      {g.fingers.map((f) => (
        <Finger
          key={f.finger}
          def={f}
          nail={nails[f.finger]}
          selected={selected === f.finger}
          onSelect={onSelect}
          prefix={prefix}
        />
      ))}
      <g transform={`rotate(${g.thumbAngle} ${g.thumbPivot.x} ${g.thumbPivot.y})`}>
        <Finger
          def={g.thumb}
          nail={nails[g.thumb.finger]}
          selected={selected === g.thumb.finger}
          onSelect={onSelect}
          prefix={prefix}
        />
      </g>
    </>
  );
}

function Finger({
  def,
  nail,
  selected,
  onSelect,
  prefix,
}: {
  def: FingerDef;
  nail: NailsMap[FingerId];
  selected: boolean;
  onSelect?: (f: FingerId) => void;
  prefix: string;
}) {
  const nw = def.w * 0.6;
  const nl = Math.min(nw * 0.95 * lengthScale(nail.length), def.h * 0.5);
  const nx = def.x + (def.w - nw) / 2;
  const ny = def.tip + 6;
  return (
    <g
      onClick={onSelect ? () => onSelect(def.finger) : undefined}
      style={onSelect ? { cursor: 'pointer' } : undefined}
    >
      <rect
        x={def.x}
        y={def.tip}
        width={def.w}
        height={def.h}
        rx={def.w / 2}
        fill={SKIN}
        stroke={selected ? 'var(--primary)' : SKIN_EDGE}
        strokeWidth={selected ? 2.4 : 1.5}
      />
      <g transform={`translate(${nx} ${ny})`}>
        {selected && (
          <rect
            x={-4}
            y={-4}
            width={nw + 8}
            height={nl + 8}
            rx={(nw + 8) / 3}
            fill="none"
            stroke="var(--primary)"
            strokeWidth={2.2}
          />
        )}
        <NailPlate nail={nail} w={nw} l={nl} uid={`${prefix}-${nail.finger}`} />
      </g>
    </g>
  );
}

export function HandSvg(props: HandContentProps) {
  return (
    <svg
      viewBox="0 0 260 250"
      style={{ display: 'block', width: '100%', height: 'auto' }}
      role="img"
      aria-label={props.side === 'left' ? 'دست چپ' : 'دست راست'}
    >
      <HandContent {...props} />
    </svg>
  );
}
