// Pure backup/restore serialisation. Builds and validates a versioned JSON
// snapshot of everything stored for one baby, so it can round-trip losslessly
// across a reinstall (unlike the CSV export, which drops sleep + pump duration).
// No DB/IO here — the lib layer (src/lib/backup.ts) does the file work.
//
// The snapshot stores *Input* shapes (no ids / timestamps) so it re-inserts
// cleanly through the normal repo create* functions.
import type {
  Baby,
  BabyInput,
  DiaperEvent,
  DiaperInput,
  FeedEvent,
  FeedInput,
  GrowthInput,
  GrowthMeasurement,
  Settings,
  SleepEvent,
  SleepInput,
  UnitLength,
  UnitMass,
  UnitVolume,
} from '@/src/db/types';

/** Tag that identifies our file, so we can reject unrelated JSON early. */
export const BACKUP_FORMAT = 'navam-backup';
/** Bump when the snapshot shape changes in a non-additive way. */
export const BACKUP_VERSION = 1;

/** Preferences worth restoring so a reinstall rebuilds the same setup. */
export interface BackupSettings {
  unit_volume: UnitVolume;
  unit_mass: UnitMass;
  unit_length: UnitLength;
  track_sleep: number;
  night_start_min: number;
  night_end_min: number;
}
export interface BackupReminder {
  enabled: number; // 0 | 1
  interval_minutes: number;
}

export interface BackupData {
  baby: BabyInput;
  feeds: FeedInput[];
  diapers: DiaperInput[];
  sleeps: SleepInput[];
  growth: GrowthInput[];
  /** Optional — absent in older backups; restore falls back to defaults. */
  settings: BackupSettings | null;
  reminder: BackupReminder | null;
}

export interface BackupFile extends BackupData {
  format: typeof BACKUP_FORMAT;
  version: number;
  app_version: string | null;
  exported_at: string; // UTC ISO
}

// --- Row → Input (strip ids/timestamps for a portable, re-insertable shape) ---

function feedToInput(f: FeedEvent): FeedInput {
  return {
    type: f.type,
    start_time: f.start_time,
    end_time: f.end_time,
    side: f.side,
    duration_left_s: f.duration_left_s,
    duration_right_s: f.duration_right_s,
    volume_ml: f.volume_ml,
    contents: f.contents,
    notes: f.notes,
  };
}
function diaperToInput(d: DiaperEvent): DiaperInput {
  return { time: d.time, type: d.type, color: d.color, consistency: d.consistency, notes: d.notes, flagged: d.flagged };
}
function sleepToInput(s: SleepEvent): SleepInput {
  return {
    start_time: s.start_time,
    end_time: s.end_time,
    kind: s.kind,
    location: s.location,
    how: s.how,
    notes: s.notes,
    flagged: s.flagged,
  };
}
function growthToInput(g: GrowthMeasurement): GrowthInput {
  return {
    measured_at: g.measured_at,
    weight_g: g.weight_g,
    length_cm: g.length_cm,
    head_circumference_cm: g.head_circumference_cm,
    notes: g.notes,
  };
}

/** Assemble the JSON string for a backup (pretty-printed for inspectability). */
export function buildBackupJson(
  input: {
    baby: Baby;
    feeds: FeedEvent[];
    diapers: DiaperEvent[];
    sleeps: SleepEvent[];
    growth: GrowthMeasurement[];
    settings: Settings;
    reminder: { enabled: boolean; intervalMinutes: number } | null;
  },
  appVersion: string | null
): string {
  const file: BackupFile = {
    format: BACKUP_FORMAT,
    version: BACKUP_VERSION,
    app_version: appVersion,
    exported_at: new Date().toISOString(),
    baby: {
      first_name: input.baby.first_name ?? input.baby.name,
      middle_name: input.baby.middle_name,
      last_name: input.baby.last_name,
      sex: input.baby.sex,
      date_of_birth: input.baby.date_of_birth,
    },
    feeds: input.feeds.map(feedToInput),
    diapers: input.diapers.map(diaperToInput),
    sleeps: input.sleeps.map(sleepToInput),
    growth: input.growth.map(growthToInput),
    settings: {
      unit_volume: input.settings.unit_volume,
      unit_mass: input.settings.unit_mass,
      unit_length: input.settings.unit_length,
      track_sleep: input.settings.track_sleep,
      night_start_min: input.settings.night_start_min,
      night_end_min: input.settings.night_end_min,
    },
    reminder: input.reminder
      ? { enabled: input.reminder.enabled ? 1 : 0, interval_minutes: input.reminder.intervalMinutes }
      : null,
  };
  return JSON.stringify(file, null, 2);
}

export type ParseResult = { ok: true; value: BackupData } | { ok: false; error: string };

/** Parse + validate a backup file's text. Tolerant of missing event arrays. */
export function parseBackup(text: string): ParseResult {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return { ok: false, error: 'This file isn’t a valid Navam backup.' };
  }
  if (!raw || typeof raw !== 'object') {
    return { ok: false, error: 'This file isn’t a valid Navam backup.' };
  }
  const f = raw as Record<string, unknown>;
  if (f.format !== BACKUP_FORMAT) {
    return { ok: false, error: 'This file isn’t a Navam backup.' };
  }
  if (typeof f.version !== 'number' || f.version > BACKUP_VERSION) {
    return {
      ok: false,
      error: 'This backup was made by a newer version of Navam. Update the app, then try again.',
    };
  }
  const baby = f.baby as Record<string, unknown> | undefined;
  if (!baby || typeof baby.date_of_birth !== 'string' || (baby.sex !== 'male' && baby.sex !== 'female')) {
    return { ok: false, error: 'This backup is missing its baby profile.' };
  }
  const arr = <T,>(v: unknown): T[] => (Array.isArray(v) ? (v as T[]) : []);
  return {
    ok: true,
    value: {
      baby: {
        first_name: typeof baby.first_name === 'string' && baby.first_name ? baby.first_name : 'Baby',
        middle_name: typeof baby.middle_name === 'string' ? baby.middle_name : null,
        last_name: typeof baby.last_name === 'string' ? baby.last_name : null,
        sex: baby.sex,
        date_of_birth: baby.date_of_birth,
      },
      feeds: arr<FeedInput>(f.feeds),
      diapers: arr<DiaperInput>(f.diapers),
      sleeps: arr<SleepInput>(f.sleeps),
      growth: arr<GrowthInput>(f.growth),
      settings: parseSettings(f.settings),
      reminder: parseReminder(f.reminder),
    },
  };
}

const IN = <T,>(v: unknown, allowed: readonly T[]): T | null =>
  allowed.includes(v as T) ? (v as T) : null;
const int = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? Math.round(v) : null);

/** Optional settings block — every field must be valid or the block is dropped. */
function parseSettings(v: unknown): BackupSettings | null {
  if (!v || typeof v !== 'object') return null;
  const s = v as Record<string, unknown>;
  const unit_volume = IN<UnitVolume>(s.unit_volume, ['ml', 'oz']);
  const unit_mass = IN<UnitMass>(s.unit_mass, ['g', 'lb_oz']);
  const unit_length = IN<UnitLength>(s.unit_length, ['cm', 'in']);
  const track_sleep = int(s.track_sleep);
  const night_start_min = int(s.night_start_min);
  const night_end_min = int(s.night_end_min);
  if (!unit_volume || !unit_mass || !unit_length || track_sleep == null || night_start_min == null || night_end_min == null) {
    return null;
  }
  return { unit_volume, unit_mass, unit_length, track_sleep: track_sleep ? 1 : 0, night_start_min, night_end_min };
}

function parseReminder(v: unknown): BackupReminder | null {
  if (!v || typeof v !== 'object') return null;
  const r = v as Record<string, unknown>;
  const interval = int(r.interval_minutes);
  if (interval == null || interval <= 0) return null;
  return { enabled: r.enabled ? 1 : 0, interval_minutes: interval };
}

/** Total event count in a backup (for the confirm dialog + result notice). */
export function backupCounts(d: BackupData): { feeds: number; diapers: number; sleeps: number; growth: number; total: number } {
  const feeds = d.feeds.length;
  const diapers = d.diapers.length;
  const sleeps = d.sleeps.length;
  const growth = d.growth.length;
  return { feeds, diapers, sleeps, growth, total: feeds + diapers + sleeps + growth };
}
