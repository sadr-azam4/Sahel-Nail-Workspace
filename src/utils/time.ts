// ---------------------------------------------------------------------------
// Time-of-day utilities — local wall-clock "HH:mm" strings only.
// ---------------------------------------------------------------------------

import { pad2, toPersianDigits } from './jalali';

/** "10:30" → 630. Returns null for invalid times. */
export function timeToMinutes(t: string): number | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec(t.trim());
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (h > 23 || min > 59) return null;
  return h * 60 + min;
}

export function minutesToTime(mins: number): string {
  const m = ((mins % 1440) + 1440) % 1440;
  return `${pad2(Math.floor(m / 60))}:${pad2(m % 60)}`;
}

/** End time may pass midnight; wrapped for display only. */
export function endTime(start: string, durationMinutes: number): string {
  const s = timeToMinutes(start);
  if (s === null) return '--:--';
  return minutesToTime(s + Math.max(0, Math.round(durationMinutes)));
}

export function isValidTime(t: string): boolean {
  return timeToMinutes(t) !== null;
}

/** Persian digits time for display: "۱۰:۳۰" */
export function formatTimeFa(t: string): string {
  return toPersianDigits(t);
}

export function formatTimeRangeFa(start: string, durationMinutes: number): string {
  return `${formatTimeFa(start)} تا ${formatTimeFa(endTime(start, durationMinutes))}`;
}
