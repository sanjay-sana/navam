// Lull — the single point of all database access (per CLAUDE.md conventions).
// Screens and state never touch expo-sqlite directly; they call these functions.
// The DB is opened + migrated lazily, once, and memoised.
import * as SQLite from 'expo-sqlite';

import { openDatabase } from './migrations';
import type { Baby, BabyInput, FeedInput, Settings } from './types';

let dbPromise: Promise<SQLite.SQLiteDatabase> | null = null;

function getDb(): Promise<SQLite.SQLiteDatabase> {
  if (!dbPromise) dbPromise = openDatabase();
  return dbPromise;
}

const nowUtc = () => new Date().toISOString(); // UTC ISO-8601

// --- Settings (single row, id = 1, seeded by migration) ---------------------

export async function getSettings(): Promise<Settings> {
  const db = await getDb();
  const row = await db.getFirstAsync<Settings>('SELECT * FROM settings WHERE id = 1');
  if (!row) {
    // Migration seeds this row; absence means a broken DB, surface it loudly.
    throw new Error('settings row missing — DB not initialised correctly');
  }
  return row;
}

type SettingsPatch = Partial<
  Pick<Settings, 'unit_volume' | 'unit_mass' | 'unit_length' | 'active_baby_id' | 'theme'>
>;

export async function updateSettings(patch: SettingsPatch): Promise<void> {
  const keys = Object.keys(patch) as (keyof SettingsPatch)[];
  if (keys.length === 0) return;
  const db = await getDb();
  const assignments = keys.map((k) => `${k} = ?`).join(', ');
  const values = keys.map((k) => patch[k] ?? null);
  await db.runAsync(`UPDATE settings SET ${assignments}, updated_at = ? WHERE id = 1`, [
    ...values,
    nowUtc(),
  ]);
}

// --- Babies -----------------------------------------------------------------

/**
 * The active baby = settings.active_baby_id, falling back to the most recently
 * created baby (covers the window before active_baby_id is set). Null when no
 * baby exists yet (cold start → onboarding).
 */
export async function getActiveBaby(): Promise<Baby | null> {
  const db = await getDb();
  const active = await db.getFirstAsync<Baby>(
    `SELECT b.* FROM babies b
     JOIN settings s ON s.active_baby_id = b.id
     WHERE s.id = 1`
  );
  if (active) return active;
  return (
    (await db.getFirstAsync<Baby>('SELECT * FROM babies ORDER BY created_at DESC LIMIT 1')) ??
    null
  );
}

/**
 * Create a baby, seed its default feed-reminder config, and make it active.
 * Done in one transaction so we never end up with a baby but no active id.
 */
export async function createBaby(input: BabyInput): Promise<Baby> {
  const db = await getDb();
  const ts = nowUtc();
  let id = 0;
  await db.withTransactionAsync(async () => {
    const res = await db.runAsync(
      `INSERT INTO babies (name, sex, date_of_birth, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?)`,
      [input.name, input.sex, input.date_of_birth, ts, ts]
    );
    id = res.lastInsertRowId;
    await db.runAsync(
      `INSERT INTO reminder_configs (baby_id, type, enabled, interval_minutes, created_at, updated_at)
       VALUES (?, 'feed', 0, 180, ?, ?)`,
      [id, ts, ts]
    );
    await db.runAsync(`UPDATE settings SET active_baby_id = ?, updated_at = ? WHERE id = 1`, [
      id,
      ts,
    ]);
  });
  const baby = await db.getFirstAsync<Baby>('SELECT * FROM babies WHERE id = ?', [id]);
  if (!baby) throw new Error('createBaby: row not found after insert');
  return baby;
}

export async function updateBaby(id: number, input: BabyInput): Promise<void> {
  const db = await getDb();
  await db.runAsync(
    `UPDATE babies SET name = ?, sex = ?, date_of_birth = ?, updated_at = ? WHERE id = ?`,
    [input.name, input.sex, input.date_of_birth, nowUtc(), id]
  );
}

// --- Today screen queries ---------------------------------------------------

/** Feed reminder config for a baby (interval drives the Today ring even when disabled). */
export async function getFeedReminder(
  babyId: number
): Promise<{ enabled: boolean; intervalMinutes: number } | null> {
  const db = await getDb();
  const row = await db.getFirstAsync<{ enabled: number; interval_minutes: number }>(
    `SELECT enabled, interval_minutes FROM reminder_configs
     WHERE baby_id = ? AND type = 'feed' LIMIT 1`,
    [babyId]
  );
  if (!row) return null;
  return { enabled: row.enabled === 1, intervalMinutes: row.interval_minutes };
}

/** MAX(start_time) over qualifying feeds (breast | bottle); null if none yet. */
export async function getLatestQualifyingFeedStart(babyId: number): Promise<string | null> {
  const db = await getDb();
  const row = await db.getFirstAsync<{ start: string | null }>(
    `SELECT MAX(start_time) AS start FROM feed_events
     WHERE baby_id = ? AND type IN ('breast','bottle')`,
    [babyId]
  );
  return row?.start ?? null;
}

/** Count qualifying feeds (breast | bottle, pump excluded) in [startIso, endIso). */
export async function countFeedsBetween(
  babyId: number,
  startIso: string,
  endIso: string
): Promise<number> {
  const db = await getDb();
  const row = await db.getFirstAsync<{ n: number }>(
    `SELECT COUNT(*) AS n FROM feed_events
     WHERE baby_id = ? AND type IN ('breast','bottle')
       AND start_time >= ? AND start_time < ?`,
    [babyId, startIso, endIso]
  );
  return row?.n ?? 0;
}

// --- Feed events ------------------------------------------------------------

/**
 * Insert a feed event. Returns the new id. NOTE: callers must trigger the
 * next-feed reminder recompute (§5.4) after qualifying-feed writes — that
 * scheduling lands in Phase 6.
 */
export async function createFeedEvent(babyId: number, input: FeedInput): Promise<number> {
  const db = await getDb();
  const ts = nowUtc();
  const res = await db.runAsync(
    `INSERT INTO feed_events
       (baby_id, type, start_time, end_time, side, duration_left_s, duration_right_s,
        volume_ml, contents, notes, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      babyId,
      input.type,
      input.start_time,
      input.end_time ?? null,
      input.side ?? null,
      input.duration_left_s ?? null,
      input.duration_right_s ?? null,
      input.volume_ml ?? null,
      input.contents ?? null,
      input.notes ?? null,
      ts,
      ts,
    ]
  );
  return res.lastInsertRowId;
}

/** Count diaper events in [startIso, endIso). */
export async function countDiapersBetween(
  babyId: number,
  startIso: string,
  endIso: string
): Promise<number> {
  const db = await getDb();
  const row = await db.getFirstAsync<{ n: number }>(
    `SELECT COUNT(*) AS n FROM diaper_events
     WHERE baby_id = ? AND time >= ? AND time < ?`,
    [babyId, startIso, endIso]
  );
  return row?.n ?? 0;
}
