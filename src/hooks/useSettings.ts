import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../database/db';
import { DEFAULT_SETTINGS } from '../database/repositories';
import type { SettingsRow } from '../types';

/** Live settings row; falls back to defaults until DB responds. */
export function useSettings(): SettingsRow {
  const row = useLiveQuery(() => db.settings.get('app'), []);
  return row ?? { ...DEFAULT_SETTINGS };
}
