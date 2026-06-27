// Lull — the single point of all database access (per CLAUDE.md conventions).
// Screens and state never touch expo-sqlite directly; they call these functions.
// The DB is opened + migrated lazily, once, and memoised.
import * as SQLite from 'expo-sqlite';

import { openDatabase } from './migrations';
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
  SleepKind,
} from './types';

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
  Pick<
    Settings,
    | 'unit_volume'
    | 'unit_mass'
    | 'unit_length'
    | 'active_baby_id'
    | 'theme'
    | 'track_sleep'
    | 'night_start_hour'
    | 'night_end_hour'
  >
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

/** Full display name from the parts (e.g. "Aarav Kumar Sana"). */
function composeName(input: BabyInput): string {
  return [input.first_name, input.middle_name, input.last_name]
    .map((s) => s?.trim())
    .filter(Boolean)
    .join(' ');
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
      `INSERT INTO babies (name, first_name, middle_name, last_name, sex, date_of_birth, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        composeName(input),
        input.first_name.trim(),
        input.middle_name?.trim() || null,
        input.last_name?.trim() || null,
        input.sex,
        input.date_of_birth,
        ts,
        ts,
      ]
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
    `UPDATE babies SET name = ?, first_name = ?, middle_name = ?, last_name = ?, sex = ?, date_of_birth = ?, updated_at = ?
     WHERE id = ?`,
    [
      composeName(input),
      input.first_name.trim(),
      input.middle_name?.trim() || null,
      input.last_name?.trim() || null,
      input.sex,
      input.date_of_birth,
      nowUtc(),
      id,
    ]
  );
}

/**
 * Wipe all babies (cascades to every event + reminder) and clear the active
 * baby, so the app returns to onboarding. Unit preferences are kept.
 */
export async function resetApp(): Promise<void> {
  const db = await getDb();
  await db.withTransactionAsync(async () => {
    await db.runAsync('UPDATE settings SET active_baby_id = NULL, updated_at = ? WHERE id = 1', [
      nowUtc(),
    ]);
    await db.runAsync('DELETE FROM babies'); // ON DELETE CASCADE clears events + reminders
  });
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

/** Enable/disable + interval for the feed reminder. */
export async function updateReminder(
  babyId: number,
  patch: { enabled?: boolean; intervalMinutes?: number }
): Promise<void> {
  const db = await getDb();
  const sets: string[] = [];
  const vals: (number | string)[] = [];
  if (patch.enabled !== undefined) {
    sets.push('enabled = ?');
    vals.push(patch.enabled ? 1 : 0);
  }
  if (patch.intervalMinutes !== undefined) {
    sets.push('interval_minutes = ?');
    vals.push(patch.intervalMinutes);
  }
  if (sets.length === 0) return;
  await db.runAsync(
    `UPDATE reminder_configs SET ${sets.join(', ')}, updated_at = ? WHERE baby_id = ? AND type = 'feed'`,
    [...vals, nowUtc(), babyId]
  );
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

export async function getFeedEvent(id: number): Promise<FeedEvent | null> {
  const db = await getDb();
  return (await db.getFirstAsync<FeedEvent>('SELECT * FROM feed_events WHERE id = ?', [id])) ?? null;
}

export async function updateFeedEvent(id: number, input: FeedInput): Promise<void> {
  const db = await getDb();
  await db.runAsync(
    `UPDATE feed_events SET
       type = ?, start_time = ?, end_time = ?, side = ?, duration_left_s = ?,
       duration_right_s = ?, volume_ml = ?, contents = ?, notes = ?, updated_at = ?
     WHERE id = ?`,
    [
      input.type,
      input.start_time,
      input.end_time ?? null,
      input.side ?? null,
      input.duration_left_s ?? null,
      input.duration_right_s ?? null,
      input.volume_ml ?? null,
      input.contents ?? null,
      input.notes ?? null,
      nowUtc(),
      id,
    ]
  );
}

export async function deleteFeedEvent(id: number): Promise<void> {
  const db = await getDb();
  await db.runAsync('DELETE FROM feed_events WHERE id = ?', [id]);
}

export async function getFeedEventsBetween(
  babyId: number,
  startIso: string,
  endIso: string
): Promise<FeedEvent[]> {
  const db = await getDb();
  return db.getAllAsync<FeedEvent>(
    `SELECT * FROM feed_events
     WHERE baby_id = ? AND start_time >= ? AND start_time < ?
     ORDER BY start_time DESC`,
    [babyId, startIso, endIso]
  );
}

export async function getAllFeedEvents(babyId: number): Promise<FeedEvent[]> {
  const db = await getDb();
  return db.getAllAsync<FeedEvent>(
    'SELECT * FROM feed_events WHERE baby_id = ? ORDER BY start_time ASC',
    [babyId]
  );
}

export async function getAllDiaperEvents(babyId: number): Promise<DiaperEvent[]> {
  const db = await getDb();
  return db.getAllAsync<DiaperEvent>(
    'SELECT * FROM diaper_events WHERE baby_id = ? ORDER BY time ASC',
    [babyId]
  );
}

// --- Diaper events ----------------------------------------------------------

export async function createDiaperEvent(babyId: number, input: DiaperInput): Promise<number> {
  const db = await getDb();
  const ts = nowUtc();
  const res = await db.runAsync(
    `INSERT INTO diaper_events (baby_id, time, type, color, consistency, notes, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [babyId, input.time, input.type, input.color ?? null, input.consistency ?? null, input.notes ?? null, ts, ts]
  );
  return res.lastInsertRowId;
}

export async function getDiaperEvent(id: number): Promise<DiaperEvent | null> {
  const db = await getDb();
  return (
    (await db.getFirstAsync<DiaperEvent>('SELECT * FROM diaper_events WHERE id = ?', [id])) ?? null
  );
}

export async function updateDiaperEvent(id: number, input: DiaperInput): Promise<void> {
  const db = await getDb();
  await db.runAsync(
    `UPDATE diaper_events SET time = ?, type = ?, color = ?, consistency = ?, notes = ?, updated_at = ?
     WHERE id = ?`,
    [input.time, input.type, input.color ?? null, input.consistency ?? null, input.notes ?? null, nowUtc(), id]
  );
}

export async function deleteDiaperEvent(id: number): Promise<void> {
  const db = await getDb();
  await db.runAsync('DELETE FROM diaper_events WHERE id = ?', [id]);
}

export async function getDiaperEventsBetween(
  babyId: number,
  startIso: string,
  endIso: string
): Promise<DiaperEvent[]> {
  const db = await getDb();
  return db.getAllAsync<DiaperEvent>(
    `SELECT * FROM diaper_events
     WHERE baby_id = ? AND time >= ? AND time < ?
     ORDER BY time DESC`,
    [babyId, startIso, endIso]
  );
}

// --- Growth measurements ----------------------------------------------------

export async function createGrowthMeasurement(babyId: number, input: GrowthInput): Promise<number> {
  const db = await getDb();
  const ts = nowUtc();
  const res = await db.runAsync(
    `INSERT INTO growth_measurements
       (baby_id, measured_at, weight_g, length_cm, head_circumference_cm, notes, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      babyId,
      input.measured_at,
      input.weight_g ?? null,
      input.length_cm ?? null,
      input.head_circumference_cm ?? null,
      input.notes ?? null,
      ts,
      ts,
    ]
  );
  return res.lastInsertRowId;
}

export async function getGrowthMeasurement(id: number): Promise<GrowthMeasurement | null> {
  const db = await getDb();
  return (
    (await db.getFirstAsync<GrowthMeasurement>('SELECT * FROM growth_measurements WHERE id = ?', [
      id,
    ])) ?? null
  );
}

export async function updateGrowthMeasurement(id: number, input: GrowthInput): Promise<void> {
  const db = await getDb();
  await db.runAsync(
    `UPDATE growth_measurements SET
       measured_at = ?, weight_g = ?, length_cm = ?, head_circumference_cm = ?, notes = ?, updated_at = ?
     WHERE id = ?`,
    [
      input.measured_at,
      input.weight_g ?? null,
      input.length_cm ?? null,
      input.head_circumference_cm ?? null,
      input.notes ?? null,
      nowUtc(),
      id,
    ]
  );
}

export async function deleteGrowthMeasurement(id: number): Promise<void> {
  const db = await getDb();
  await db.runAsync('DELETE FROM growth_measurements WHERE id = ?', [id]);
}

/** All measurements for a baby, oldest first (for plotting over age). */
export async function getGrowthMeasurements(babyId: number): Promise<GrowthMeasurement[]> {
  const db = await getDb();
  return db.getAllAsync<GrowthMeasurement>(
    'SELECT * FROM growth_measurements WHERE baby_id = ? ORDER BY measured_at ASC',
    [babyId]
  );
}

// --- Sleep events -----------------------------------------------------------

/** The in-progress sleep (end_time NULL), if any. */
export async function getOpenSleep(babyId: number): Promise<SleepEvent | null> {
  const db = await getDb();
  return (
    (await db.getFirstAsync<SleepEvent>(
      `SELECT * FROM sleep_events WHERE baby_id = ? AND end_time IS NULL
       ORDER BY start_time DESC LIMIT 1`,
      [babyId]
    )) ?? null
  );
}

/** Most recent completed sleep (for the wake window). */
export async function getLastEndedSleep(babyId: number): Promise<SleepEvent | null> {
  const db = await getDb();
  return (
    (await db.getFirstAsync<SleepEvent>(
      `SELECT * FROM sleep_events WHERE baby_id = ? AND end_time IS NOT NULL
       ORDER BY end_time DESC LIMIT 1`,
      [babyId]
    )) ?? null
  );
}

/** Start a sleep now. Auto-closes any open session first (one-open invariant). */
export async function startSleep(
  babyId: number,
  startIso: string,
  kind: SleepKind
): Promise<number> {
  const db = await getDb();
  const ts = nowUtc();
  let id = 0;
  await db.withTransactionAsync(async () => {
    await db.runAsync(
      `UPDATE sleep_events SET end_time = ?, updated_at = ? WHERE baby_id = ? AND end_time IS NULL`,
      [startIso, ts, babyId]
    );
    const res = await db.runAsync(
      `INSERT INTO sleep_events (baby_id, start_time, end_time, kind, created_at, updated_at)
       VALUES (?, ?, NULL, ?, ?, ?)`,
      [babyId, startIso, kind, ts, ts]
    );
    id = res.lastInsertRowId;
  });
  return id;
}

export async function endSleep(id: number, endIso: string): Promise<void> {
  const db = await getDb();
  await db.runAsync('UPDATE sleep_events SET end_time = ?, updated_at = ? WHERE id = ?', [
    endIso,
    nowUtc(),
    id,
  ]);
}

/** Close any other in-progress sleep, keeping the one-open-session invariant. */
export async function closeOtherOpenSleeps(babyId: number, exceptId: number, endIso: string): Promise<void> {
  const db = await getDb();
  await db.runAsync(
    `UPDATE sleep_events SET end_time = ?, updated_at = ? WHERE baby_id = ? AND end_time IS NULL AND id != ?`,
    [endIso, nowUtc(), babyId, exceptId]
  );
}

export async function createSleepEvent(babyId: number, input: SleepInput): Promise<number> {
  const db = await getDb();
  const ts = nowUtc();
  const res = await db.runAsync(
    `INSERT INTO sleep_events (baby_id, start_time, end_time, kind, location, how, notes, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      babyId,
      input.start_time,
      input.end_time ?? null,
      input.kind,
      input.location ?? null,
      input.how ?? null,
      input.notes ?? null,
      ts,
      ts,
    ]
  );
  return res.lastInsertRowId;
}

export async function getSleepEvent(id: number): Promise<SleepEvent | null> {
  const db = await getDb();
  return (await db.getFirstAsync<SleepEvent>('SELECT * FROM sleep_events WHERE id = ?', [id])) ?? null;
}

export async function updateSleepEvent(id: number, input: SleepInput): Promise<void> {
  const db = await getDb();
  await db.runAsync(
    `UPDATE sleep_events SET start_time = ?, end_time = ?, kind = ?, location = ?, how = ?, notes = ?, updated_at = ?
     WHERE id = ?`,
    [
      input.start_time,
      input.end_time ?? null,
      input.kind,
      input.location ?? null,
      input.how ?? null,
      input.notes ?? null,
      nowUtc(),
      id,
    ]
  );
}

export async function deleteSleepEvent(id: number): Promise<void> {
  const db = await getDb();
  await db.runAsync('DELETE FROM sleep_events WHERE id = ?', [id]);
}

/** Sleeps that STARTED in [startIso, endIso) — attribution by start day. */
export async function getSleepEventsBetween(
  babyId: number,
  startIso: string,
  endIso: string
): Promise<SleepEvent[]> {
  const db = await getDb();
  return db.getAllAsync<SleepEvent>(
    `SELECT * FROM sleep_events
     WHERE baby_id = ? AND start_time >= ? AND start_time < ?
     ORDER BY start_time DESC`,
    [babyId, startIso, endIso]
  );
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
