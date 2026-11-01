import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '../../src/database/db';
import {
  backupFileName, exportBackup, replaceAll, restoreBackup, validateBackupFile,
  type BackupFile,
} from '../../src/features/backup/backup';
import { createDesign, updateNail } from '../../src/features/nail-designer/designerLogic';

beforeEach(async () => {
  await Promise.all(db.tables.map((t) => t.clear()));
});

async function seed() {
  await saveSettingsDirect();
  await db.clients.bulkAdd([
    { name: 'مریم', createdAt: '2025-01-01T00:00:00.000Z', updatedAt: '2025-01-01T00:00:00.000Z' },
  ]);
  const clientId = (await db.clients.toArray())[0].id;
  await db.services.bulkAdd([
    {
      name: 'ژلیش',
      category: 'لاک',
      defaultPrice: 600000,
      defaultDuration: 90,
      active: true,
      createdAt: 'x',
      updatedAt: 'x',
    },
  ]);
  await db.appointments.add({
    customerId: clientId,
    customerName: 'مریم',
    dateKey: '2025-08-07',
    startTime: '10:00',
    durationMinutes: 90,
    services: [{ name: 'ژلیش', price: 600000, duration: 90 }],
    priceSnapshot: 600000,
    status: 'scheduled',
    createdAt: 'x',
    updatedAt: 'x',
  });
  const design = updateNail(createDesign(), 'L3', { baseColor: '#123456', shape: 'almond' });
  design.title = 'طرح آبی';
  design.customerId = clientId;
  await db.designs.add(design);
  await db.quotes.add({
    customerId: clientId,
    customerName: 'مریم',
    lines: [{ name: 'ژلیش', unitPrice: 600000, quantity: 1 }],
    subtotal: 600000,
    discount: 0,
    finalPrice: 600000,
    currencyLabel: 'تومان',
    createdAt: '2025-08-07T00:00:00.000Z',
  });
  return clientId;
}

async function saveSettingsDirect() {
  await db.settings.put({
    key: 'app',
    artistName: 'ساحل',
    salonName: 'استودیو',
    currencyLabel: 'تومان',
    theme: 'light',
    onboardingDone: true,
    prefs: { defaultAppointmentMinutes: 60, showArchivedClients: false },
  });
}

describe('exportBackup', () => {
  it('exports all stores with app id and schema version', async () => {
    await seed();
    const file = await exportBackup();
    expect(file.app).toBe('naildesk');
    expect(file.schemaVersion).toBe(1);
    expect(file.exportedAt).toBeTruthy();
    expect(file.data.clients).toHaveLength(1);
    expect(file.data.services).toHaveLength(1);
    expect(file.data.appointments).toHaveLength(1);
    expect(file.data.designs).toHaveLength(1);
    expect(file.data.quotes).toHaveLength(1);
    expect(file.data.settings[0].artistName).toBe('ساحل');
  });

  it('produces a dated filename', () => {
    expect(backupFileName('2025-08-07T10:00:00.000Z')).toBe('naildesk-backup-2025-08-07.json');
    expect(backupFileName()).toMatch(/^naildesk-backup-\d{4}-\d{2}-\d{2}\.json$/);
  });
});

describe('validateBackupFile', () => {
  it('accepts a valid export and returns counts', async () => {
    await seed();
    const file = await exportBackup();
    const res = validateBackupFile(JSON.parse(JSON.stringify(file)));
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.summary.clients).toBe(1);
      expect(res.summary.appointments).toBe(1);
    }
  });

  it('rejects a foreign app identifier', () => {
    const res = validateBackupFile({ app: 'other-app', schemaVersion: 1, data: {} });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.errors.join(' ')).toContain('NailDesk');
  });

  it('rejects unsupported schema versions', () => {
    const res = validateBackupFile({ app: 'naildesk', schemaVersion: 99, data: {} });
    expect(res.ok).toBe(false);
  });

  it('rejects non-JSON-able garbage', () => {
    expect(validateBackupFile('hello').ok).toBe(false);
    expect(validateBackupFile(null).ok).toBe(false);
  });

  it('rejects broken monetary values', () => {
    const file = {
      app: 'naildesk',
      schemaVersion: 1,
      appVersion: '1.0.0',
      exportedAt: '2025-08-07T00:00:00.000Z',
      data: {
        settings: [],
        clients: [],
        services: [
          { name: 'x', category: 'c', defaultPrice: -5, defaultDuration: 30, active: true, createdAt: 'x', updatedAt: 'x' },
        ],
        appointments: [],
        designs: [],
        quotes: [],
        drafts: [],
      },
    };
    const res = validateBackupFile(file);
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.errors.join(' ')).toContain('قیمت');
  });

  it('rejects broken date/time keys', () => {
    const file = {
      app: 'naildesk',
      schemaVersion: 1,
      appVersion: '1.0.0',
      exportedAt: '2025-08-07T00:00:00.000Z',
      data: {
        settings: [],
        clients: [],
        services: [],
        appointments: [
          {
            customerName: 'م',
            dateKey: '2025/08/07',
            startTime: '25:99',
            durationMinutes: 60,
            services: [],
            priceSnapshot: 100,
            status: 'scheduled',
            createdAt: 'x',
            updatedAt: 'x',
          },
        ],
        designs: [],
        quotes: [],
        drafts: [],
      },
    };
    expect(validateBackupFile(file).ok).toBe(false);
  });

  it('rejects broken design nail structure', async () => {
    await seed();
    const file = (await exportBackup()) as BackupFile;
    file.data.designs[0].nails = {} as never;
    expect(validateBackupFile(file).ok).toBe(false);
  });

  it('rejects dangling customer references', async () => {
    await seed();
    const file = await exportBackup();
    file.data.appointments[0].customerId = 9999;
    const res = validateBackupFile(file);
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.errors.join(' ')).toContain('مشتری');
  });
});

describe('restore (full replacement, transactional)', () => {
  it('restores all records preserving ids and relationships', async () => {
    const clientId = await seed();
    const file = await exportBackup();

    // wipe everything, then restore
    await Promise.all(db.tables.map((t) => t.clear()));
    await restoreBackup(file);

    const clients = await db.clients.toArray();
    expect(clients.map((c) => c.id)).toContain(clientId);

    const appts = await db.appointments.toArray();
    expect(appts).toHaveLength(1);
    expect(appts[0].customerId).toBe(clientId);
    expect(appts[0].priceSnapshot).toBe(600000);

    const settingsRow = await db.settings.get('app');
    expect(settingsRow?.artistName).toBe('ساحل');

    const designs = await db.designs.toArray();
    expect(designs[0].nails.L3.baseColor).toBe('#123456');
  });

  it('leaves existing data untouched when the transaction fails mid-way', async () => {
    await seed();
    const before = {
      clients: await db.clients.toArray(),
      appointments: await db.appointments.toArray(),
    };

    const bogus = await exportBackup();
    const badFile = JSON.parse(JSON.stringify(bogus)) as BackupFile;
    // Force a genuine transaction failure: an object is not a valid IndexedDB
    // key, so bulkPut aborts and the whole transaction rolls back.
    (badFile.data.settings as unknown[]).push({ key: { invalid: true } } as never);

    let threw = false;
    try {
      await restoreBackup(badFile);
    } catch {
      threw = true;
    }
    expect(threw).toBe(true);

    const afterClients = await db.clients.toArray();
    const afterAppts = await db.appointments.toArray();
    expect(afterClients.map((c) => c.id)).toEqual(before.clients.map((c) => c.id));
    expect(afterAppts).toHaveLength(before.appointments.length);
  });

  it('replaceAll restores an empty dataset (fresh install backup)', async () => {
    await seed();
    await replaceAll({
      settings: [],
      clients: [],
      services: [],
      appointments: [],
      designs: [],
      quotes: [],
      drafts: [],
    });
    expect(await db.clients.count()).toBe(0);
    const s = await db.settings.get('app');
    expect(s?.key).toBe('app'); // default settings row ensured
  });
});
