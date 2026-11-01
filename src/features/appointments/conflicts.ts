// ---------------------------------------------------------------------------
// Appointment overlap detection (pure logic, fully unit-tested).
// Only ACTIVE appointments conflict — cancelled ones never block a slot.
// Appointments may span midnight; overlap is computed in minutes.
// ---------------------------------------------------------------------------

import type { Appointment, AppointmentStatus } from '../../types';
import { endTime, formatTimeRangeFa, timeToMinutes } from '../../utils/time';

export interface ConflictLike {
  id?: number;
  dateKey: string;
  startTime: string;
  durationMinutes: number;
  status: AppointmentStatus;
  customerName?: string;
}

export interface ConflictCandidate {
  dateKey: string;
  startTime: string;
  durationMinutes: number;
}

export function overlaps(
  startA: string,
  durationA: number,
  startB: string,
  durationB: number,
): boolean {
  const a1 = timeToMinutes(startA);
  const b1 = timeToMinutes(startB);
  if (a1 === null || b1 === null) return false;
  const a2 = a1 + Math.max(0, durationA);
  const b2 = b1 + Math.max(0, durationB);
  // Half-open intervals: [start, end) — touching edges do NOT overlap.
  return a1 < b2 && b1 < a2;
}

export function findConflicts(
  candidate: ConflictCandidate,
  all: ConflictLike[],
  ignoreId?: number,
): ConflictLike[] {
  return all.filter(
    (a) =>
      a.dateKey === candidate.dateKey &&
      a.status !== 'cancelled' &&
      a.id !== undefined &&
      a.id !== ignoreId &&
      overlaps(candidate.startTime, candidate.durationMinutes, a.startTime, a.durationMinutes),
  );
}

/** Human-readable Persian description of one conflicting appointment. */
export function describeConflict(a: ConflictLike): string {
  const name = a.customerName && a.customerName.trim() ? a.customerName : 'نوبت بدون نام';
  return `${name} — ${formatTimeRangeFa(a.startTime, a.durationMinutes)}`;
}

export function sortAppointmentsByTime(list: Appointment[]): Appointment[] {
  return [...list].sort((x, y) => {
    const tx = timeToMinutes(x.startTime) ?? 0;
    const ty = timeToMinutes(y.startTime) ?? 0;
    return tx - ty;
  });
}

export { endTime };
