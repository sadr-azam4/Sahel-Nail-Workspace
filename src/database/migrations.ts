// ---------------------------------------------------------------------------
// Schema migration infrastructure.
//
// Dexie applies versions declaratively; this module adds runtime detection
// and reporting so the app (and restore flow) can verify the database is
// usable before any UI is shown. Future versions must be added in db.ts with
// explicit .upgrade() blocks; bump LATEST_VERSION here to match.
// ---------------------------------------------------------------------------

import { db } from './db';

export const LATEST_VERSION = 1;

export interface MigrationReport {
  fromVersion: number;
  toVersion: number;
  ok: boolean;
  tables: string[];
  error?: string;
}

const EXPECTED_TABLES = [
  'settings',
  'clients',
  'services',
  'appointments',
  'designs',
  'quotes',
  'drafts',
];

/**
 * Opens the database, verifies version and table presence.
 * Never throws — always returns a report. On failure the DB is left as-is.
 */
export async function ensureDatabase(): Promise<MigrationReport> {
  const from = db.verno;
  try {
    await db.open();
    const tables = db.tables.map((t) => t.name);
    const missing = EXPECTED_TABLES.filter((t) => !tables.includes(t));
    if (missing.length > 0) {
      return {
        fromVersion: from,
        toVersion: db.verno,
        ok: false,
        tables,
        error: `جداول یافت نشدند: ${missing.join('، ')}`,
      };
    }
    return { fromVersion: from, toVersion: db.verno, ok: true, tables };
  } catch (err) {
    return {
      fromVersion: from,
      toVersion: LATEST_VERSION,
      ok: false,
      tables: [],
      error: err instanceof Error ? err.message : String(err),
    };
  }
}
