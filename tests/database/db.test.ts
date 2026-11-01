import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '../../src/database/db';
import { ensureDatabase } from '../../src/database/migrations';
import { appointmentsInMonth, getSettings, saveSettings } from '../../src/database/repositories';
import { createDesign } from '../../src/features/nail-designer/designerLogic';

beforeEach(async () => {
  await Promise.all(db.tables.map((t) => t.clear()));
});

describe('NailDeskDB schema', () => {
  it('opens with all seven stores', async () => {
    const report = await ensureDatabase();
    expect(report.ok).toBe(true);
    expect(report.tables).toEqual(
      expect.arrayContaining([
        'settings', 'clients', 'services', 'appointments', 'designs', 'quotes', 'drafts',
      ]),
    );
    expect(db.verno).toBeGreaterThanOrEqual(1);
  });
});

describe('settings singleton', () => {
  it('creates defaults on first read', async () => {
    const s = await getSettings();
    expect(s.key).toBe('app');
    expect(s.onboardingDone).toBe(false);
    expect(s.currencyLabel).toBe('تومان');
  });

  it('persists patches', async () => {
    await getSettings();
    const saved = await saveSettings({ artistName: 'ساحل', onboardingDone: true });
    expect(saved.artistName).toBe('ساحل');
    const again = await getSettings();
    expect(again.artistName).toBe('ساحل');
    expect(again.onboardingDone).toBe(true);
  });
});

describe('appointment queries', () => {
  it('queries by dateKey index within a Jalali month', async () => {
    await db.appointments.bulkAdd([
      {
        customerName: 'الف',
        dateKey: '2024-03-20', // 1403-01-01
        startTime: '09:00',
        durationMinutes: 60,
        services: [],
        priceSnapshot: 100000,
        status: 'scheduled',
        createdAt: 'x',
        updatedAt: 'x',
      },
      {
        customerName: 'ب',
        dateKey: '2024-04-19', // 1403-01-31 (last day of Farvardin)
        startTime: '11:00',
        durationMinutes: 60,
        services: [],
        priceSnapshot: 200000,
        status: 'done',
        createdAt: 'x',
        updatedAt: 'x',
      },
      {
        customerName: 'پ',
        dateKey: '2024-04-20', // next month — must be excluded
        startTime: '11:00',
        durationMinutes: 60,
        services: [],
        priceSnapshot: 300000,
        status: 'scheduled',
        createdAt: 'x',
        updatedAt: 'x',
      },
    ]);
    const list = await appointmentsInMonth(1403, 1);
    expect(list.map((a) => a.customerName).sort()).toEqual(['الف', 'ب']);
  });
});

describe('indexes', () => {
  it('clients name index finds records', async () => {
    await db.clients.bulkAdd([
      { name: 'مریم', createdAt: 'x', updatedAt: 'x' },
      { name: 'زهرا', createdAt: 'x', updatedAt: 'x', archivedAt: '2025-01-01T00:00:00.000Z' },
    ]);
    const zohreh = await db.clients.where('name').equals('زهرا').first();
    expect(zohreh?.archivedAt).toBeDefined();
  });

  it('designs query by category', async () => {
    const base = {
      title: 'طرح',
      status: 'idea' as const,
      category: 'عروس',
      tags: [],
      favorite: false,
      createdAt: 'x',
      updatedAt: 'x',
    };
    const nails = createDesign().nails;
    await db.designs.bulkAdd([
      { ...base, nails },
      { ...base, category: 'فرنچ', nails },
    ]);
    const bridal = await db.designs.where('category').equals('عروس').toArray();
    expect(bridal).toHaveLength(1);
  });
});
