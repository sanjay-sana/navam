import { buildSampleData } from '@/src/logic/sampleData';

const NOW = new Date('2026-08-14T15:00:00.000Z');
const DOB = '2026-06-20'; // ~8 weeks old

describe('buildSampleData', () => {
  it('is deterministic for a given dob', () => {
    const a = buildSampleData({ dob: DOB, now: NOW });
    const b = buildSampleData({ dob: DOB, now: NOW });
    expect(b).toEqual(a);
  });

  it('produces a full, non-empty dataset', () => {
    const d = buildSampleData({ dob: DOB, now: NOW });
    expect(d.feeds.length).toBeGreaterThan(50);
    expect(d.diapers.length).toBeGreaterThan(40);
    expect(d.sleeps.length).toBeGreaterThan(30);
    expect(d.growth.length).toBeGreaterThan(3);
  });

  it('never places an event in the future or before birth', () => {
    const d = buildSampleData({ dob: DOB, now: NOW });
    const dobMs = new Date(`${DOB}T00:00:00`).getTime();
    const times = [
      ...d.feeds.map((f) => f.start_time),
      ...d.diapers.map((x) => x.time),
      ...d.sleeps.map((s) => s.start_time),
    ];
    for (const t of times) {
      const ms = new Date(t).getTime();
      expect(ms).toBeLessThanOrEqual(NOW.getTime());
      expect(ms).toBeGreaterThanOrEqual(dobMs);
    }
    // sleeps must end after they start and not run past now
    for (const s of d.sleeps) {
      expect(new Date(s.end_time!).getTime()).toBeGreaterThan(new Date(s.start_time).getTime());
      expect(new Date(s.end_time!).getTime()).toBeLessThanOrEqual(NOW.getTime());
    }
  });

  it('gives breast feeds a side consistent with per-side durations', () => {
    const d = buildSampleData({ dob: DOB, now: NOW });
    const breasts = d.feeds.filter((f) => f.type === 'breast');
    expect(breasts.length).toBeGreaterThan(0);
    for (const f of breasts) {
      const l = f.duration_left_s ?? 0;
      const r = f.duration_right_s ?? 0;
      const expected = l > 0 && r > 0 ? 'both' : r > 0 ? 'right' : 'left';
      expect(f.side).toBe(expected);
      expect(l + r).toBeGreaterThan(0);
    }
  });

  it('growth rises over time and stays within birth..now', () => {
    const d = buildSampleData({ dob: DOB, now: NOW });
    const dobMs = new Date(`${DOB}T00:00:00`).getTime();
    for (const g of d.growth) {
      const ms = new Date(`${g.measured_at}T00:00:00`).getTime();
      expect(ms).toBeGreaterThanOrEqual(dobMs);
      expect(ms).toBeLessThanOrEqual(NOW.getTime());
    }
    const weights = d.growth.map((g) => g.weight_g ?? 0);
    expect(weights[weights.length - 1]).toBeGreaterThan(weights[0]);
  });

  it('flags a couple of items so the Flagged list has content', () => {
    const d = buildSampleData({ dob: DOB, now: NOW });
    expect(d.diapers.filter((x) => x.flagged === 1).length).toBeGreaterThanOrEqual(1);
    expect(d.sleeps.filter((s) => s.flagged === 1).length).toBeGreaterThanOrEqual(1);
  });
});
