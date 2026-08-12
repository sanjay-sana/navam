// Navam — database open + migration runner (expo-sqlite, modern async API).
// Versioned via PRAGMA user_version. Add a new migration block per schema change;
// never edit an already-shipped migration.
import * as SQLite from 'expo-sqlite';

const nowUtc = () => new Date().toISOString(); // UTC ISO-8601

const MIGRATION_1 = `
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS babies (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  sex TEXT NOT NULL CHECK (sex IN ('male','female')),
  date_of_birth TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS feed_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  baby_id INTEGER NOT NULL REFERENCES babies(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('breast','bottle','pump')),
  start_time TEXT NOT NULL,
  end_time TEXT,
  side TEXT CHECK (side IN ('left','right','both')),
  duration_left_s INTEGER,
  duration_right_s INTEGER,
  volume_ml REAL,
  contents TEXT CHECK (contents IN ('breast_milk','formula','mixed')),
  notes TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_feed_baby_start ON feed_events(baby_id, start_time);

CREATE TABLE IF NOT EXISTS diaper_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  baby_id INTEGER NOT NULL REFERENCES babies(id) ON DELETE CASCADE,
  time TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('wet','dirty','both')),
  color TEXT,
  consistency TEXT,
  notes TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_diaper_baby_time ON diaper_events(baby_id, time);

CREATE TABLE IF NOT EXISTS growth_measurements (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  baby_id INTEGER NOT NULL REFERENCES babies(id) ON DELETE CASCADE,
  measured_at TEXT NOT NULL,
  weight_g REAL,
  length_cm REAL,
  head_circumference_cm REAL,
  notes TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_growth_baby_at ON growth_measurements(baby_id, measured_at);

CREATE TABLE IF NOT EXISTS reminder_configs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  baby_id INTEGER NOT NULL REFERENCES babies(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('feed')),
  enabled INTEGER NOT NULL DEFAULT 0,
  interval_minutes INTEGER NOT NULL DEFAULT 180,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS settings (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  unit_volume TEXT NOT NULL DEFAULT 'ml' CHECK (unit_volume IN ('ml','oz')),
  unit_mass TEXT NOT NULL DEFAULT 'g' CHECK (unit_mass IN ('g','lb_oz')),
  unit_length TEXT NOT NULL DEFAULT 'cm' CHECK (unit_length IN ('cm','in')),
  active_baby_id INTEGER REFERENCES babies(id),
  theme TEXT NOT NULL DEFAULT 'dark',
  updated_at TEXT NOT NULL
);
`;

// v2: split name into first/middle/last. Keep `name` as the full display name
// (kept in sync by the repo); backfill first_name from the existing name.
const MIGRATION_2 = `
ALTER TABLE babies ADD COLUMN first_name TEXT;
ALTER TABLE babies ADD COLUMN middle_name TEXT;
ALTER TABLE babies ADD COLUMN last_name TEXT;
UPDATE babies SET first_name = name WHERE first_name IS NULL;
`;

// v3: sleep tracking. A row with end_time NULL is an in-progress sleep.
const MIGRATION_3 = `
CREATE TABLE IF NOT EXISTS sleep_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  baby_id INTEGER NOT NULL REFERENCES babies(id) ON DELETE CASCADE,
  start_time TEXT NOT NULL,
  end_time TEXT,
  kind TEXT NOT NULL CHECK (kind IN ('nap','night')),
  location TEXT,
  how TEXT,
  notes TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_sleep_baby_start ON sleep_events(baby_id, start_time);
`;

// v4: per-user toggle to show/hide sleep tracking.
const MIGRATION_4 = `ALTER TABLE settings ADD COLUMN track_sleep INTEGER NOT NULL DEFAULT 1;`;

// v5: configurable night-sleep window, stored as minutes-since-midnight
// (30-min granularity). Default 20:00 (1200) – 06:00 (360).
const MIGRATION_5 = `
ALTER TABLE settings ADD COLUMN night_start_min INTEGER NOT NULL DEFAULT 1200;
ALTER TABLE settings ADD COLUMN night_end_min INTEGER NOT NULL DEFAULT 360;
`;

// v6: flag so region-based unit defaults are applied exactly once on first
// launch (0 = not yet applied). Never overrides a later manual choice.
const MIGRATION_6 = `ALTER TABLE settings ADD COLUMN units_auto_set INTEGER NOT NULL DEFAULT 0;`;

// v7: "flag for review" on note-bearing events (diaper + sleep).
const MIGRATION_7 = `
ALTER TABLE diaper_events ADD COLUMN flagged INTEGER NOT NULL DEFAULT 0;
ALTER TABLE sleep_events ADD COLUMN flagged INTEGER NOT NULL DEFAULT 0;
`;

export async function openDatabase(): Promise<SQLite.SQLiteDatabase> {
  const db = await SQLite.openDatabaseAsync('navam.db');
  await db.execAsync('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;');
  await migrate(db);
  return db;
}

async function migrate(db: SQLite.SQLiteDatabase): Promise<void> {
  const row = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
  const version = row?.user_version ?? 0;

  if (version < 1) {
    await db.withTransactionAsync(async () => {
      await db.execAsync(MIGRATION_1);
      await db.runAsync(
        `INSERT OR IGNORE INTO settings (id, updated_at) VALUES (1, ?)`,
        [nowUtc()]
      );
    });
    await db.execAsync('PRAGMA user_version = 1');
  }

  if (version < 2) {
    await db.withTransactionAsync(async () => {
      await db.execAsync(MIGRATION_2);
    });
    await db.execAsync('PRAGMA user_version = 2');
  }

  if (version < 3) {
    await db.withTransactionAsync(async () => {
      await db.execAsync(MIGRATION_3);
    });
    await db.execAsync('PRAGMA user_version = 3');
  }

  if (version < 4) {
    await db.withTransactionAsync(async () => {
      await db.execAsync(MIGRATION_4);
    });
    await db.execAsync('PRAGMA user_version = 4');
  }

  if (version < 5) {
    await db.withTransactionAsync(async () => {
      await db.execAsync(MIGRATION_5);
    });
    await db.execAsync('PRAGMA user_version = 5');
  }

  if (version < 6) {
    await db.withTransactionAsync(async () => {
      await db.execAsync(MIGRATION_6);
    });
    await db.execAsync('PRAGMA user_version = 6');
  }

  if (version < 7) {
    await db.withTransactionAsync(async () => {
      await db.execAsync(MIGRATION_7);
    });
    await db.execAsync('PRAGMA user_version = 7');
  }
}
