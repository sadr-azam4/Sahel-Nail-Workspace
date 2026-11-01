// ---------------------------------------------------------------------------
// Date & number localization utilities.
//
// CRITICAL RULES
// - Appointments are stored as LOCAL Gregorian date keys "YYYY-MM-DD"
//   plus a separate local wall-clock time "HH:mm". We never derive date
//   keys from UTC-based ISO strings (no toISOString() for keys), so DST,
//   midnight and month boundaries are safe.
// - Jalali (Solar Hijri) conversion goes through jalaali-js, which handles
//   leap years correctly.
// - All user-facing numbers use Persian digits with the "٬" separator.
// ---------------------------------------------------------------------------

import jalaali from 'jalaali-js';
import { cloneDeep } from './misc';

export const PERSIAN_MONTHS = [
  'فروردین', 'اردیبهشت', 'خرداد', 'تیر', 'مرداد', 'شهریور',
  'مهر', 'آبان', 'آذر', 'دی', 'بهمن', 'اسفند',
] as const;

/** Saturday-first compact weekday header. */
export const WEEKDAYS_SHORT = ['ش', 'ی', 'د', 'س', 'چ', 'پ', 'ج'] as const;

/** JS getDay(): 0 = Sunday … 6 = Saturday. */
export const WEEKDAY_NAMES = [
  'یکشنبه', 'دوشنبه', 'سه‌شنبه', 'چهارشنبه', 'پنجشنبه', 'جمعه', 'شنبه',
] as const;

const PERSIAN_DIGITS = ['۰', '۱', '۲', '۳', '۴', '۵', '۶', '۷', '۸', '۹'];

export function toPersianDigits(input: string | number): string {
  return String(input).replace(/\d/g, (d) => PERSIAN_DIGITS[Number(d)]);
}

/** Persian (۰-۹) and Arabic (٠-٩) digits → Latin. */
export function normalizeDigits(input: string): string {
  return input
    .replace(/[\u06F0-\u06F9]/g, (c) => String(c.charCodeAt(0) - 0x06f0))
    .replace(/[\u0660-\u0669]/g, (c) => String(c.charCodeAt(0) - 0x0660));
}

/** 1234567 → "۱٬۲۳۴٬۵۶۷" */
export function formatNumberFa(n: number): string {
  const sign = n < 0 ? '−' : '';
  const s = Math.abs(Math.trunc(n)).toString();
  const grouped = s.replace(/\B(?=(\d{3})+(?!\d))/g, '\u066C');
  return sign + toPersianDigits(grouped);
}

// --- local Gregorian date keys ---------------------------------------------

const KEY_RE = /^\d{4}-\d{2}-\d{2}$/;

export function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

/** Today's LOCAL date key. Never uses UTC. */
export function todayKey(): string {
  const d = new Date();
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

/**
 * Converts a UTC ISO timestamp (e.g. record updatedAt) into the LOCAL date
 * key "YYYY-MM-DD". Slicing the ISO string directly would use the UTC date
 * and shift the displayed Jalali day for records saved between local
 * midnight and the UTC offset (e.g. 00:00–03:30 in Tehran).
 */
export function isoToLocalDateKey(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return todayKey();
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

export function isDateKey(v: unknown): v is string {
  return typeof v === 'string' && KEY_RE.test(v);
}

export function dateKeyFromParts(y: number, m: number, d: number): string {
  return `${y}-${pad2(m)}-${pad2(d)}`;
}

export function parseDateKey(key: string): { y: number; m: number; d: number } {
  const [y, m, d] = key.split('-').map(Number);
  return { y, m, d };
}

/** Local Date at NOON (DST/midnight safe) for weekday arithmetic. */
export function dateFromKey(key: string): Date {
  const { y, m, d } = parseDateKey(key);
  return new Date(y, m - 1, d, 12, 0, 0, 0);
}

export function shiftDays(key: string, delta: number): string {
  const d = dateFromKey(key);
  d.setDate(d.getDate() + delta);
  return dateKeyFromParts(d.getFullYear(), d.getMonth() + 1, d.getDate());
}

/** 0 = Saturday … 6 = Friday (Persian week). */
export function weekdayIndexSat0(key: string): number {
  return (dateFromKey(key).getDay() + 1) % 7;
}

export function weekdayName(key: string): string {
  return WEEKDAY_NAMES[dateFromKey(key).getDay()];
}

// --- Jalali conversions -----------------------------------------------------

export interface JYearMonthDay {
  jy: number;
  jm: number;
  jd: number;
}

export function toJalali(key: string): JYearMonthDay {
  const { y, m, d } = parseDateKey(key);
  return jalaali.toJalaali(y, m, d);
}

export function fromJalali(jy: number, jm: number, jd: number): string {
  const g = jalaali.toGregorian(jy, jm, jd);
  return dateKeyFromParts(g.gy, g.gm, g.gd);
}

export function jalaliMonthLength(jy: number, jm: number): number {
  return jalaali.jalaaliMonthLength(jy, jm);
}

export function todayJalali(): JYearMonthDay {
  return toJalali(todayKey());
}

export function shiftJalaliMonth(jy: number, jm: number, delta: number): JYearMonthDay {
  const total = jy * 12 + (jm - 1) + delta;
  const njy = Math.floor(total / 12);
  const njm = (total % 12) + 1;
  return { jy: njy, jm: njm, jd: 1 };
}

/** [firstDayKey, lastDayKey] of a Jalali month. */
export function monthStartEndKeys(jy: number, jm: number): [string, string] {
  const start = fromJalali(jy, jm, 1);
  const end = fromJalali(jy, jm, jalaliMonthLength(jy, jm));
  return [start, end];
}

// --- formatting --------------------------------------------------------------

export interface FormatJalaliOptions {
  withWeekday?: boolean;
  withYear?: boolean;
}

/** "۱۴ مرداد ۱۴۰۳" (weekday: "شنبه ۱۴ مرداد ۱۴۰۳"). */
export function formatJalali(key: string, opts: FormatJalaliOptions = {}): string {
  const { withWeekday = false, withYear = true } = opts;
  const { jy, jm, jd } = toJalali(key);
  let out = `${toPersianDigits(jd)} ${PERSIAN_MONTHS[jm - 1]}`;
  if (withYear) out += ` ${toPersianDigits(jy)}`;
  if (withWeekday) out = `${weekdayName(key)} ${out}`;
  return out;
}

/** "مرداد ۱۴۰۳" */
export function formatJalaliMonth(jy: number, jm: number): string {
  return `${PERSIAN_MONTHS[jm - 1]} ${toPersianDigits(jy)}`;
}

/** Clone helper re-exported here so tests import from one module. */
export { cloneDeep };
