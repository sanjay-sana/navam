import type { DiaperEvent, FeedEvent, SleepEvent } from '@/src/db/types';
import { buildSleepDays, buildTrendDays, sleepTrendSummary, trendSummary } from '@/src/logic/trends';

const now = new Date(2026, 5, 21, 12, 0, 0);

function feed(partial: Partial<FeedEvent>): FeedEvent {
  return {
    id: 1,
    baby_id: 1,
    type: 'bottle',
    start_time: now.toISOString(),
    end_time: null,
    side: null,
    duration_left_s: null,
    duration_right_s: null,
    volume_ml: null,
    contents: null,
    notes: null,
    created_at: '',
    updated_at: '',
    ...partial,
  };
}

function diaper(partial: Partial<DiaperEvent>): DiaperEvent {
  return {
    id: 1,
    baby_id: 1,
    time: now.toISOString(),
    type: 'wet',
    color: null,
    consistency: null,
    notes: null,
    created_at: '',
    updated_at: '',
    ...partial,
  };
}

describe('buildTrendDays', () => {
  const feeds = [
    feed({ type: 'bottle', volume_ml: 90 }),
    feed({ type: 'breast' }),
    feed({ type: 'pump', volume_ml: 110 }),
  ];
  const diapers = [diaper({ type: 'both' }), diaper({ type: 'wet' })];
  const days = buildTrendDays(feeds, diapers, 7, now);

  it('creates one bucket per day in range', () => {
    expect(days).toHaveLength(7);
  });

  it('counts feeds excluding pump, on the right day', () => {
    expect(days[6].feedCount).toBe(2);
  });

  it('attributes bottle volume and pump output separately', () => {
    expect(days[6].bottleMl).toBe(90);
    expect(days[6].pumpMl).toBe(110);
  });

  it('counts a "both" diaper toward both wet and dirty, but once for diaperCount', () => {
    expect(days[6].wet).toBe(2); // both + wet
    expect(days[6].dirty).toBe(1); // both
    expect(days[6].diaperCount).toBe(2);
  });

  it('keeps empty days as zero', () => {
    expect(days[0]).toMatchObject({ feedCount: 0, bottleMl: 0, diaperCount: 0 });
  });

  it('labels 7-day range with weekday names and 30-day with day numbers', () => {
    expect(days[6].label).toMatch(/^[A-Z][a-z]{2}$/);
    expect(buildTrendDays([], [], 30, now)[0].label).toMatch(/^\d+$/);
  });
});

describe('trendSummary', () => {
  it('averages bottle intake / diapers / pump per day and flags bottles', () => {
    const days = buildTrendDays(
      [feed({ type: 'bottle', volume_ml: 90 }), feed({ type: 'pump', volume_ml: 110 })],
      [diaper({ type: 'both' }), diaper({ type: 'wet' })],
      7,
      now
    );
    const s = trendSummary(days);
    expect(s.avgIntakeMl).toBe(Math.round(90 / 7));
    expect(s.avgDiapers).toBe(Math.round((2 / 7) * 10) / 10);
    expect(s.avgPumpMl).toBe(Math.round(110 / 7));
    expect(s.hasBottle).toBe(true);
  });

  it('reports hasBottle=false when there are no bottle feeds', () => {
    const days = buildTrendDays([feed({ type: 'breast' })], [], 7, now);
    expect(trendSummary(days).hasBottle).toBe(false);
  });
});

function sleepEv(p: Partial<SleepEvent>): SleepEvent {
  return {
    id: 1, baby_id: 1, start_time: now.toISOString(), end_time: now.toISOString(),
    kind: 'nap', location: null, how: null, notes: null, created_at: '', updated_at: '', ...p,
  };
}

describe('buildSleepDays', () => {
  it('buckets by start day, splits night/nap, counts naps + longest', () => {
    const sessions = [
      sleepEv({ kind: 'nap', start_time: new Date(2026, 5, 21, 9, 0).toISOString(), end_time: new Date(2026, 5, 21, 10, 0).toISOString() }), // 60m nap
      sleepEv({ kind: 'nap', start_time: new Date(2026, 5, 21, 13, 0).toISOString(), end_time: new Date(2026, 5, 21, 13, 30).toISOString() }), // 30m nap
      sleepEv({ kind: 'night', start_time: new Date(2026, 5, 21, 21, 0).toISOString(), end_time: new Date(2026, 5, 21, 23, 0).toISOString() }), // 120m night
    ];
    const days = buildSleepDays(sessions, 7, now);
    const today = days[6];
    expect(today.naps).toBe(2);
    expect(today.dayMin).toBe(90);
    expect(today.nightMin).toBe(120);
    expect(today.longestMin).toBe(120);
    expect(days[0].naps).toBe(0); // empty day
  });

  it('summary averages total + naps and reports hasSleep', () => {
    const days = buildSleepDays(
      [sleepEv({ kind: 'nap', start_time: new Date(2026, 5, 21, 9, 0).toISOString(), end_time: new Date(2026, 5, 21, 10, 0).toISOString() })],
      7,
      now
    );
    const s = sleepTrendSummary(days);
    expect(s.avgTotalMin).toBe(Math.round(60 / 7));
    expect(s.hasSleep).toBe(true);
    expect(sleepTrendSummary(buildSleepDays([], 7, now)).hasSleep).toBe(false);
  });
});
