import { describe, expect, it } from 'vitest';
import {
  formatJalali, formatJalaliMonth, formatNumberFa, fromJalali, isoToLocalDateKey,
  jalaliMonthLength, monthStartEndKeys, normalizeDigits, shiftDays, shiftJalaliMonth,
  toJalali, todayKey, toPersianDigits, weekdayIndexSat0, isDateKey,
} from '../../src/utils/jalali';

describe('Jalali ↔ Gregorian conversions', () => {
  it('Nowruz 1403 is 2024-03-20', () => {
    expect(fromJalali(1403, 1, 1)).toBe('2024-03-20');
  });

  it('2024-03-20 converts to 1403/01/01', () => {
    expect(toJalali('2024-03-20')).toEqual({ jy: 1403, jm: 1, jd: 1 });
  });

  it('Nowruz 1404 is 2025-03-21', () => {
    expect(fromJalali(1404, 1, 1)).toBe('2025-03-21');
  });

  it('Esfand 1403 (leap year) has 30 days ending 2025-03-20', () => {
    expect(jalaliMonthLength(1403, 12)).toBe(30);
    expect(fromJalali(1403, 12, 30)).toBe('2025-03-20');
    expect(toJalali('2025-03-20')).toEqual({ jy: 1403, jm: 12, jd: 30 });
  });

  it('Esfand 1402 has 29 days', () => {
    expect(jalaliMonthLength(1402, 12)).toBe(29);
  });

  it('Farvardin has 31 days', () => {
    expect(jalaliMonthLength(1403, 1)).toBe(31);
  });
});

describe('date keys', () => {
  it('todayKey matches YYYY-MM-DD (local)', () => {
    expect(todayKey()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(isDateKey(todayKey())).toBe(true);
  });

  it('isoToLocalDateKey converts a UTC ISO stamp to the LOCAL date key', () => {
    // Contract: the result always equals the calendar date in the RUNNER'S
    // local timezone (Date local getters) — never the UTC string prefix.
    // The old buggy implementation sliced the ISO string, which shifted the
    // day for records saved between local midnight and the UTC offset.
    const cases = [
      '2025-08-07T22:00:00.000Z', // next day anywhere east of UTC (e.g. Tehran)
      '2025-01-01T00:30:00.000Z',
      '2024-12-31T23:00:00.000Z',
      '2025-06-15T10:00:00.000Z', // mid-day UTC — same local day in Tehran
    ];
    for (const iso of cases) {
      const d = new Date(iso);
      const expected = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      expect(isoToLocalDateKey(iso)).toBe(expected);
      expect(isoToLocalDateKey(iso)).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    }
  });

  it('isoToLocalDateKey falls back to today for garbage input', () => {
    expect(isoToLocalDateKey('not-a-date')).toBe(todayKey());
  });

  it('shifts across month boundaries (leap day included)', () => {
    expect(shiftDays('2024-02-28', 1)).toBe('2024-02-29'); // 2024 is leap
    expect(shiftDays('2024-02-29', 1)).toBe('2024-03-01');
    expect(shiftDays('2024-03-19', 1)).toBe('2024-03-20'); // Nowruz
    expect(shiftDays('2024-03-20', -1)).toBe('2024-03-19');
    expect(shiftDays('2024-12-31', 1)).toBe('2025-01-01'); // year boundary
  });

  it('weekday index is Saturday-first', () => {
    // 2024-03-23 is a Saturday
    expect(weekdayIndexSat0('2024-03-23')).toBe(0);
    // 2024-03-29 is a Friday
    expect(weekdayIndexSat0('2024-03-29')).toBe(6);
  });

  it('month range keys match month length', () => {
    const [s, e] = monthStartEndKeys(1403, 1);
    expect(s).toBe('2024-03-20');
    expect(e).toBe('2024-04-19'); // 31 days of Farvardin
  });

  it('shifts month across Nowruz', () => {
    expect(shiftJalaliMonth(1403, 12, 1)).toEqual({ jy: 1404, jm: 1, jd: 1 });
    expect(shiftJalaliMonth(1404, 1, -1)).toEqual({ jy: 1403, jm: 12, jd: 1 });
  });
});

describe('formatting', () => {
  it('formats Jalali date in Persian digits', () => {
    expect(formatJalali('2024-03-20')).toBe('۱ فروردین ۱۴۰۳');
  });

  it('formats with weekday', () => {
    // 2024-03-23 = Saturday = 4 Farvardin 1403
    expect(formatJalali('2024-03-23', { withWeekday: true })).toBe('شنبه ۴ فروردین ۱۴۰۳');
  });

  it('formats month names', () => {
    expect(formatJalaliMonth(1403, 7)).toBe('مهر ۱۴۰۳');
  });

  it('groups thousands with Persian separator', () => {
    expect(formatNumberFa(450000)).toBe('۴۵۰٬۰۰۰');
    expect(formatNumberFa(1234567)).toBe('۱٬۲۳۴٬۵۶۷');
  });

  it('converts digits both ways', () => {
    expect(toPersianDigits('45')).toBe('۴۵');
    expect(normalizeDigits('۴۵')).toBe('45');
    expect(normalizeDigits('٠٩١٢')).toBe('0912');
  });
});
