import type { Service } from '../../types';

/** Optional starter catalog offered during onboarding (editable later). */
export const DEFAULT_SERVICES: Array<Omit<Service, 'id' | 'createdAt' | 'updatedAt'>> = [
  { name: 'مانیکور کلاسیک', category: 'مانیکور', defaultPrice: 300000, defaultDuration: 45, active: true },
  { name: 'پدیکور کلاسیک', category: 'پدیکور', defaultPrice: 400000, defaultDuration: 60, active: true },
  { name: 'ژلیش', category: 'لاک', defaultPrice: 600000, defaultDuration: 90, active: true },
  { name: 'کاشت پودر', category: 'کاشت', defaultPrice: 900000, defaultDuration: 120, active: true },
  { name: 'لاک ساده', category: 'لاک', defaultPrice: 250000, defaultDuration: 30, active: true },
  { name: 'فرنچ', category: 'دیزاین', defaultPrice: 450000, defaultDuration: 75, active: true },
  { name: 'رمپل UV', category: 'کاشت', defaultPrice: 500000, defaultDuration: 90, active: true },
  { name: 'دیزاین ناخن', category: 'دیزاین', defaultPrice: 350000, defaultDuration: 30, active: true },
];
