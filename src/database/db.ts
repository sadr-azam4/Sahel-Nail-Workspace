// ---------------------------------------------------------------------------
// Dexie database — the single source of truth. All ten nail objects live
// inside each design record (never 10 separate records per design).
// ---------------------------------------------------------------------------

import Dexie, { type Table } from 'dexie';
import type {
  Appointment,
  Client,
  Design,
  Draft,
  Quote,
  Service,
  SettingsRow,
} from '../types';

export class NailDeskDB extends Dexie {
  settings!: Table<SettingsRow, string>;
  clients!: Table<Client, number>;
  services!: Table<Service, number>;
  appointments!: Table<Appointment, number>;
  designs!: Table<Design, number>;
  quotes!: Table<Quote, number>;
  drafts!: Table<Draft, string>;

  constructor() {
    super('naildesk');
    // Version 1 — initial schema.
    // Future schema changes MUST be added as new explicit versions with
    // .upgrade() blocks so existing records are preserved.
    this.version(1).stores({
      settings: 'key',
      clients: '++id, name, archivedAt',
      services: '++id, name, active',
      appointments: '++id, dateKey, status, customerId',
      designs: '++id, customerId, status, category',
      quotes: '++id, customerId, createdAt',
      drafts: 'key',
    });
  }
}

export const db = new NailDeskDB();
