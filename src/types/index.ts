// ---------------------------------------------------------------------------
// NailDesk domain types — single source of truth.
// All monetary values are integer Toman. All dates are LOCAL Gregorian
// date keys "YYYY-MM-DD"; all times are local wall-clock "HH:mm".
// ---------------------------------------------------------------------------

export type ThemeMode = 'light' | 'dark' | 'system';
export type AppointmentStatus = 'scheduled' | 'done' | 'cancelled';
export type DesignStatus = 'idea' | 'proposed' | 'approved';

export interface Settings {
  key: 'app';
  artistName: string;
  salonName: string;
  currencyLabel: string;
  theme: ThemeMode;
  onboardingDone: boolean;
  lastBackupAt?: string;
  prefs: {
    defaultAppointmentMinutes: number;
    showArchivedClients: boolean;
  };
}

export type SettingsRow = Settings;

export interface Client {
  id?: number;
  name: string;
  phone?: string;
  notes?: string;
  preferredShape?: string;
  preferredColors?: string;
  preferredLength?: string;
  createdAt: string; // ISO
  updatedAt: string; // ISO
  archivedAt?: string; // ISO — presence means archived
}

export interface Service {
  id?: number;
  name: string;
  category: string;
  defaultPrice: number; // integer Toman
  defaultDuration: number; // minutes
  description?: string;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

/** Immutable snapshot of a service at booking/quoting time. */
export interface AppointmentServiceLine {
  serviceId?: number;
  name: string;
  price: number; // integer Toman
  duration: number; // minutes
}

export interface Appointment {
  id?: number;
  customerId?: number;
  /** Snapshot of the customer name — survives client deletion. */
  customerName: string;
  /** Local Gregorian date key, e.g. "2025-08-07". Never a UTC timestamp. */
  dateKey: string;
  /** Local wall-clock time, e.g. "10:30". */
  startTime: string;
  durationMinutes: number;
  /** Immutable service snapshots. */
  services: AppointmentServiceLine[];
  /** Immutable final price snapshot (integer Toman). */
  priceSnapshot: number;
  status: AppointmentStatus;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

// ---------------------------------------------------------------------------
// Nail design
// ---------------------------------------------------------------------------

export type FingerId = 'L1' | 'L2' | 'L3' | 'L4' | 'L5' | 'R1' | 'R2' | 'R3' | 'R4' | 'R5';

export type NailShape = 'square' | 'round' | 'almond' | 'coffin' | 'oval';
export type NailLength = 'short' | 'medium' | 'long' | 'xl';
export type NailFinish = 'glossy' | 'matte' | 'shimmer' | 'chrome';
export type PatternType = 'solid' | 'french' | 'ombre' | 'stripes' | 'dots' | 'marble';
export type DecorationType = 'glitter' | 'rhinestone' | 'heart' | 'star';

export interface PatternConfig {
  type: PatternType;
  /** Secondary pattern color. */
  color: string;
  /** Third accent color (ombre end / marble vein). */
  accent: string;
  /** 1..5 — density for stripes/dots. */
  density: number;
}

export interface DecorationItem {
  id: string;
  type: DecorationType;
  color: string;
  /** 1..3 */
  size: number;
}

export interface Nail {
  finger: FingerId;
  shape: NailShape;
  length: NailLength;
  baseColor: string;
  finish: NailFinish;
  pattern: PatternConfig;
  decorations: DecorationItem[];
  notes: string;
}

/** All ten nail objects embedded in the design record. */
export type NailsMap = Record<FingerId, Nail>;

export interface Design {
  id?: number;
  title: string;
  customerId?: number;
  status: DesignStatus;
  category: string;
  tags: string[];
  nails: NailsMap;
  favorite: boolean;
  createdAt: string;
  updatedAt: string;
}

// ---------------------------------------------------------------------------
// Quotes (price calculator output)
// ---------------------------------------------------------------------------

export interface QuoteLine {
  serviceId?: number;
  name: string;
  unitPrice: number; // integer Toman
  quantity: number;
}

export interface Quote {
  id?: number;
  customerId?: number;
  customerName?: string;
  lines: QuoteLine[];
  subtotal: number;
  /** Absolute discount value in Toman (already resolved from % or amount). */
  discount: number;
  finalPrice: number;
  currencyLabel: string;
  createdAt: string;
}

/** Autosaved designer draft — a single record under fixed key. */
export interface Draft {
  key: 'designer';
  design: Design;
  savedAt: string;
}
