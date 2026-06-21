// Lull — the single point of all database access (per CLAUDE.md conventions).
// Screens and state never touch expo-sqlite directly; they call these functions.
// The DB is opened + migrated lazily, once, and memoised.
import * as SQLite from 'expo-sqlite';

import { openDatabase } from './migrations';
import type { Baby, BabyInput, Settings } from './types';

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
