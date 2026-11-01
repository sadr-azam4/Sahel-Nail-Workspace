// ---------------------------------------------------------------------------
// Repository helpers — settings + designer draft + common queries.
// ---------------------------------------------------------------------------

import { db } from './db';
import type { Appointment, Design, Draft, Settings, SettingsRow } from '../types';
import { nowIso } from '../utils/misc';
import { monthStartEndKeys } from '../utils/jalali';

export const DEFAULT_SETTINGS: Settings = {
  key: 'app',
  artistName: '',
  salonName: '',
  currencyLabel: 'تومان',
  theme: 'system',
  onboardingDone: false,
  prefs: {
    defaultAppointmentMinutes: 60,
    showArchivedClients: false,
  },
};

export async function getSettings(): Promise<SettingsRow> {
  const row = await db.settings.get('app');
  if (row) return row;
  // First run: create the singleton row so callers always see a record.
  const fresh: SettingsRow = { ...DEFAULT_SETTINGS };
  await db.settings.put(fresh);
  return fresh;
}

export async function saveSettings(patch: Partial<Settings>): Promise<SettingsRow> {
  const current = await getSettings();
  const next: SettingsRow = { ...current, ...patch, key: 'app' };
  await db.settings.put(next);
  return next;
}

// --- designer draft ---------------------------------------------------------

export async function saveDraft(design: Design): Promise<void> {
  const draft: Draft = { key: 'designer', design, savedAt: nowIso() };
  await db.drafts.put(draft);
}

export async function loadDraft(): Promise<Design | null> {
  const draft = await db.drafts.get('designer');
  return draft ? draft.design : null;
}

export async function clearDraft(): Promise<void> {
  await db.drafts.delete('designer');
}

// --- appointment queries -----------------------------------------------------

export async function appointmentsInMonth(jy: number, jm: number): Promise<Appointment[]> {
  const [start, end] = monthStartEndKeys(jy, jm);
  return db.appointments.where('dateKey').between(start, end, true, true).toArray();
}

export async function appointmentsOn(dateKey: string): Promise<Appointment[]> {
  return db.appointments.where('dateKey').equals(dateKey).toArray();
}
