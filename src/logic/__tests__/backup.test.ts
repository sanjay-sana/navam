import type { Baby, DiaperEvent, FeedEvent, GrowthMeasurement, SleepEvent } from '@/src/db/types';
import { BACKUP_FORMAT, BACKUP_VERSION, backupCounts, buildBackupJson, parseBackup } from '../backup';

const baby: Baby = {
  id: 1,
  name: 'Aarav Kumar',
  first_name: 'Aarav',
  middle_name: null,
  last_name: 'Kumar',
  sex: 'male',
  date_of_birth: '2026-07-01',
  created_at: '2026-07-01T00:00:00.000Z',
  updated_at: '2026-07-01T00:00:00.000Z',
};

const feeds: FeedEvent[] = [
  {
    id: 1, baby_id: 1, type: 'breast', start_time: '2026-08-01T10:00:00.000Z', end_time: null,
    side: 'left', duration_left_s: 600, duration_right_s: 0, volume_ml: null, contents: null,
    notes: null, created_at: 'x', updated_at: 'x',
  },
  {
    id: 2, baby_id: 1, type: 'pump', start_time: '2026-08-01T12:00:00.000Z', end_time: '2026-08-01T12:20:00.000Z',
    side: null, duration_left_s: null, duration_right_s: null, volume_ml: 120, contents: null,
    notes: 'good session', created_at: 'x', updated_at: 'x',
  },
];
const diapers: DiaperEvent[] = [
  { id: 1, baby_id: 1, time: '2026-08-01T11:00:00.000Z', type: 'both', color: 'yellow', consistency: 'seedy', notes: null, flagged: 1, created_at: 'x', updated_at: 'x' },
];
const sleeps: SleepEvent[] = [
  { id: 1, baby_id: 1, start_time: '2026-08-01T13:00:00.000Z', end_time: '2026-08-01T14:30:00.000Z', kind: 'nap', location: 'crib', how: 'rocked', notes: null, flagged: 0, created_at: 'x', updated_at: 'x' },
];
const growth: GrowthMeasurement[] = [
  { id: 1, baby_id: 1, measured_at: '2026-08-01', weight_g: 4200, length_cm: 54, head_circumference_cm: 37, notes: null, created_at: 'x', updated_at: 'x' },
];

describe('backup round-trip', () => {
  it('serialises to a tagged, versioned envelope', () => {
    const obj = JSON.parse(buildBackupJson({ baby, feeds, diapers, sleeps, growth }, '1.0.1'));
    expect(obj.format).toBe(BACKUP_FORMAT);
    expect(obj.version).toBe(BACKUP_VERSION);
    expect(obj.app_version).toBe('1.0.1');
    expect(typeof obj.exported_at).toBe('string');
  });

  it('parses back losslessly, including pump duration and sleep', () => {
    const json = buildBackupJson({ baby, feeds, diapers, sleeps, growth }, null);
    const res = parseBackup(json);
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    const v = res.value;
    // pump end_time survives (the CSV drops this)
    const pump = v.feeds.find((f) => f.type === 'pump');
    expect(pump?.end_time).toBe('2026-08-01T12:20:00.000Z');
    expect(pump?.volume_ml).toBe(120);
    // breast side + per-side seconds
    expect(v.feeds[0].side).toBe('left');
    expect(v.feeds[0].duration_left_s).toBe(600);
    // sleep survives entirely (the CSV omits sleep)
    expect(v.sleeps).toHaveLength(1);
    expect(v.sleeps[0].kind).toBe('nap');
    // diaper flag + growth head circ
    expect(v.diapers[0].flagged).toBe(1);
    expect(v.growth[0].head_circumference_cm).toBe(37);
    // baby profile
    expect(v.baby.first_name).toBe('Aarav');
    expect(v.baby.date_of_birth).toBe('2026-07-01');
  });
});

describe('parseBackup validation', () => {
  it('rejects non-JSON', () => {
    expect(parseBackup('not json {').ok).toBe(false);
  });
  it('rejects a file without our format tag', () => {
    expect(parseBackup(JSON.stringify({ version: 1, baby })).ok).toBe(false);
  });
  it('rejects a newer backup version', () => {
    const r = parseBackup(JSON.stringify({ format: BACKUP_FORMAT, version: BACKUP_VERSION + 1, baby }));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/newer version/i);
  });
  it('rejects a missing baby profile', () => {
    expect(parseBackup(JSON.stringify({ format: BACKUP_FORMAT, version: 1 })).ok).toBe(false);
  });
  it('tolerates missing event arrays (defaults to empty)', () => {
    const r = parseBackup(JSON.stringify({ format: BACKUP_FORMAT, version: 1, baby: { sex: 'female', date_of_birth: '2026-01-01' } }));
    expect(r.ok).toBe(true);
    if (r.ok) expect(backupCounts(r.value).total).toBe(0);
  });
});

describe('backupCounts', () => {
  it('sums all event types', () => {
    const json = buildBackupJson({ baby, feeds, diapers, sleeps, growth }, null);
    const r = parseBackup(json);
    if (!r.ok) throw new Error('parse failed');
    expect(backupCounts(r.value)).toEqual({ feeds: 2, diapers: 1, sleeps: 1, growth: 1, total: 5 });
  });
});
