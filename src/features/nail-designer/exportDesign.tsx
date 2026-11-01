import { renderToStaticMarkup } from 'react-dom/server';
import type { Design } from '../../types';
import { todayKey } from '../../utils/jalali';
import { HandContent } from './HandSvg';

/** Self-contained SVG (no external URLs, no foreignObject). */
export function DesignExportSvg({ design }: { design: Design }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="1080" height="640" viewBox="0 0 540 320">
      <rect width="540" height="320" fill="#FFF7F9" />
      <g transform="translate(8,4)">
        <HandContent side="left" nails={design.nails} prefix="exp-l" />
      </g>
      <g transform="translate(272,4)">
        <HandContent side="right" nails={design.nails} prefix="exp-r" />
      </g>
      <text
        x="270"
        y="306"
        textAnchor="middle"
        fontSize="16"
        fontWeight="bold"
        fill="#3B2430"
        fontFamily="Vazirmatn, Tahoma, sans-serif"
      >
        {design.title || 'NailDesk'}
      </text>
    </svg>
  );
}

export function designToSvgString(design: Design): string {
  const markup = renderToStaticMarkup(<DesignExportSvg design={design} />);
  return `<?xml version="1.0" encoding="UTF-8"?>\n${markup}`;
}

export function downloadBlob(filename: string, blob: Blob): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

export async function svgStringToPngBlob(svgString: string): Promise<Blob> {
  const svgBlob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
  const url = URL.createObjectURL(svgBlob);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = () => reject(new Error('SVG render failed'));
      image.src = url;
    });
    const canvas = document.createElement('canvas');
    canvas.width = 1080;
    canvas.height = 640;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas unavailable');
    ctx.fillStyle = '#FFF7F9';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob | null>((res) => canvas.toBlob(res, 'image/png'));
    if (!blob) throw new Error('PNG encode failed');
    return blob;
  } finally {
    URL.revokeObjectURL(url);
  }
}

export type ShareResult = 'shared' | 'downloaded';

/** iOS Web Share API with graceful Blob-download fallback. */
export async function shareOrDownloadDesign(design: Design): Promise<ShareResult> {
  const png = await svgStringToPngBlob(designToSvgString(design));
  const file = new File([png], `naildesk-design-${todayKey()}.png`, { type: 'image/png' });
  const nav = navigator as Navigator & { canShare?: (data: ShareData) => boolean };
  if (typeof nav.share === 'function' && typeof nav.canShare === 'function' && nav.canShare({ files: [file] })) {
    await nav.share({ files: [file], title: design.title || 'NailDesk' });
    return 'shared';
  }
  downloadBlob(file.name, png);
  return 'downloaded';
}

export function downloadDesignSvg(design: Design): void {
  const svg = designToSvgString(design);
  const blob = new Blob([svg], { type: 'image/svg+xml;charset=utf-8' });
  downloadBlob(`naildesk-design-${todayKey()}.svg`, blob);
}
