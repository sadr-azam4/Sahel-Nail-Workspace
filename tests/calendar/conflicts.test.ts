import { describe, expect, it } from 'vitest';
import {
  describeConflict, findConflicts, overlaps, sortAppointmentsByTime,
} from '../../src/features/appointments/conflicts';
import type { Appointment } from '../../src/types';

function appt(over: Partial<Appointment>): Appointment {
  return {
    id: over.id,
    customerId: undefined,
    customerName: over.customerName ?? 'مشتری',
    dateKey: over.dateKey ?? '2025-08-07',
    startTime: over.startTime ?? '10:00',
    durationMinutes: over.durationMinutes ?? 60,
    services: [],
    priceSnapshot: 0,
    status: over.status ?? 'scheduled',
    createdAt: '2025-08-01T00:00:00.000Z',
    updatedAt: '2025-08-01T00:00:00.000Z',
  };
}

describe('overlaps (half-open intervals)', () => {
  it('detects a real overlap: 10:00–11:30 vs 11:00–12:00', () => {
    expect(overlaps('10:00', 90, '11:00', 60)).toBe(true);
    expect(overlaps('11:00', 60, '10:00', 90)).toBe(true);
  });

  it('touching edges do NOT overlap: 10:00–11:30 vs 11:30–12:00', () => {
    expect(overlaps('10:00', 90, '11:30', 30)).toBe(false);
    expect(overlaps('11:30', 30, '10:00', 90)).toBe(false);
  });

  it('detects containment', () => {
    expect(overlaps('10:00', 180, '11:00', 30)).toBe(true);
    expect(overlaps('11:00', 30, '10:00', 180)).toBe(true);
  });

  it('invalid time never overlaps', () => {
    expect(overlaps('bad', 60, '10:00', 60)).toBe(false);
  });

  it('appointments may span midnight', () => {
    // 23:30 + 120min (ends 01:30) vs 00:30 next slot is a different dateKey,
    // so same-day logic only checks same-date entries; wrap itself is valid.
    expect(overlaps('23:30', 120, '22:00', 60)).toBe(false);
    expect(overlaps('23:30', 120, '23:00', 60)).toBe(true);
  });
});

describe('findConflicts', () => {
  const pool: Appointment[] = [
    appt({ id: 1, customerName: 'مریم', startTime: '10:00', durationMinutes: 90 }),
    appt({ id: 2, customerName: 'نازنین', startTime: '14:00', durationMinutes: 60 }),
    appt({ id: 3, customerName: 'لغوشده', startTime: '16:00', durationMinutes: 120, status: 'cancelled' }),
    appt({ id: 4, customerName: 'روز دیگر', dateKey: '2025-08-08', startTime: '10:00' }),
  ];

  it('flags overlapping active appointment', () => {
    const c = findConflicts({ dateKey: '2025-08-07', startTime: '11:00', durationMinutes: 60 }, pool);
    expect(c.map((x) => x.id)).toEqual([1]);
  });

  it('never conflicts with cancelled appointments', () => {
    const c = findConflicts({ dateKey: '2025-08-07', startTime: '16:30', durationMinutes: 60 }, pool);
    expect(c).toHaveLength(0);
  });

  it('never conflicts across different days', () => {
    const c = findConflicts({ dateKey: '2025-08-08', startTime: '10:30', durationMinutes: 60 }, pool);
    expect(c.map((x) => x.id)).toEqual([4]);
  });

  it('ignores the appointment being edited (ignoreId)', () => {
    const c = findConflicts(
      { dateKey: '2025-08-07', startTime: '10:30', durationMinutes: 30 },
      pool,
      1,
    );
    expect(c).toHaveLength(0);
  });

  it('describes conflicts in Persian with time range', () => {
    const c = findConflicts({ dateKey: '2025-08-07', startTime: '10:30', durationMinutes: 30 }, pool);
    expect(describeConflict(c[0])).toContain('مریم');
    expect(describeConflict(c[0])).toContain('۱۰:۰۰');
  });
});

describe('sortAppointmentsByTime', () => {
  it('sorts by start time regardless of input order', () => {
    const sorted = sortAppointmentsByTime([
      appt({ id: 2, startTime: '14:00' }),
      appt({ id: 1, startTime: '09:00' }),
      appt({ id: 3, startTime: '11:30' }),
    ]);
    expect(sorted.map((a) => a.id)).toEqual([1, 3, 2]);
  });
});
