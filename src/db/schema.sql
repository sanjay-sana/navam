-- Lull — canonical schema (reference copy of migration v1).
-- All timestamps stored as UTC ISO-8601 text; rendered in device-local time.
-- Canonical units: ml (volume), grams (mass), cm (length).
-- The executable copy lives in db/migrations.ts (keep the two in sync).

PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS babies (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  name          TEXT NOT NULL,                                   -- full display name (first+middle+last)
  first_name    TEXT,                                            -- v2
  middle_name   TEXT,                                            -- v2
  last_name     TEXT,                                            -- v2
  sex           TEXT NOT NULL CHECK (sex IN ('male','female')),  -- required for WHO percentiles
  date_of_birth TEXT NOT NULL,                                   -- ISO date; drives age
  created_at    TEXT NOT NULL,
  updated_at    TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS feed_events (
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
  baby_id          INTEGER NOT NULL REFERENCES babies(id) ON DELETE CASCADE,
  type             TEXT NOT NULL CHECK (type IN ('breast','bottle','pump')),
  start_time       TEXT NOT NULL,                                -- UTC ISO-8601
  end_time         TEXT,
  side             TEXT CHECK (side IN ('left','right','both')), -- breast / pump
  duration_left_s  INTEGER,                                      -- breast / pump
  duration_right_s INTEGER,
  volume_ml        REAL,                                         -- bottle / pump (canonical ml)
  contents         TEXT CHECK (contents IN ('breast_milk','formula','mixed')), -- bottle
  notes            TEXT,
  created_at       TEXT NOT NULL,
  updated_at       TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_feed_baby_start ON feed_events(baby_id, start_time);

CREATE TABLE IF NOT EXISTS diaper_events (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  baby_id     INTEGER NOT NULL REFERENCES babies(id) ON DELETE CASCADE,
  time        TEXT NOT NULL,                                     -- UTC ISO-8601
  type        TEXT NOT NULL CHECK (type IN ('wet','dirty','both')),
  color       TEXT,                                              -- optional, off fast path
  consistency TEXT,                                              -- optional, off fast path
  notes       TEXT,
  created_at  TEXT NOT NULL,
  updated_at  TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_diaper_baby_time ON diaper_events(baby_id, time);

CREATE TABLE IF NOT EXISTS growth_measurements (
  id                    INTEGER PRIMARY KEY AUTOINCREMENT,
  baby_id               INTEGER NOT NULL REFERENCES babies(id) ON DELETE CASCADE,
  measured_at           TEXT NOT NULL,                           -- ISO date
  weight_g              REAL,                                    -- canonical grams
  length_cm             REAL,                                    -- canonical cm
  head_circumference_cm REAL,                                    -- canonical cm
  notes                 TEXT,
  created_at            TEXT NOT NULL,
  updated_at            TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_growth_baby_at ON growth_measurements(baby_id, measured_at);

CREATE TABLE IF NOT EXISTS sleep_events (                          -- v3
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  baby_id     INTEGER NOT NULL REFERENCES babies(id) ON DELETE CASCADE,
  start_time  TEXT NOT NULL,                                       -- UTC ISO
  end_time    TEXT,                                                -- NULL = in progress (asleep)
  kind        TEXT NOT NULL CHECK (kind IN ('nap','night')),
  location    TEXT,                                                -- optional, off fast path
  how         TEXT,                                                -- optional
  notes       TEXT,
  created_at  TEXT NOT NULL,
  updated_at  TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_sleep_baby_start ON sleep_events(baby_id, start_time);

CREATE TABLE IF NOT EXISTS reminder_configs (
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
  baby_id          INTEGER NOT NULL REFERENCES babies(id) ON DELETE CASCADE,
  type             TEXT NOT NULL CHECK (type IN ('feed')),       -- extensible later
  enabled          INTEGER NOT NULL DEFAULT 0,                   -- bool
  interval_minutes INTEGER NOT NULL DEFAULT 180,
  created_at       TEXT NOT NULL,
  updated_at       TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS settings (
  id             INTEGER PRIMARY KEY CHECK (id = 1),             -- single row
  unit_volume    TEXT NOT NULL DEFAULT 'ml'  CHECK (unit_volume IN ('ml','oz')),
  unit_mass      TEXT NOT NULL DEFAULT 'g'   CHECK (unit_mass   IN ('g','lb_oz')),
  unit_length    TEXT NOT NULL DEFAULT 'cm'  CHECK (unit_length IN ('cm','in')),
  active_baby_id INTEGER REFERENCES babies(id),
  theme            TEXT NOT NULL DEFAULT 'dark',
  track_sleep      INTEGER NOT NULL DEFAULT 1,                     -- v4: show/hide sleep
  night_start_hour INTEGER NOT NULL DEFAULT 20,                    -- v5: night window
  night_end_hour   INTEGER NOT NULL DEFAULT 6,
  updated_at       TEXT NOT NULL
);
