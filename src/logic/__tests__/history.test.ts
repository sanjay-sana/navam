import type { DiaperEvent, FeedEvent, GrowthMeasurement, SleepEvent } from '@/src/db/types';
import { buildTimeline, daySummary, diaperEntry, feedEntry, growthEntry, sleepEntry } from '@/src/logic/history';

const units = { volume: 'ml', mass: 'g', length: 'cm' } as const;

function sleepEv(p: Partial<SleepEvent>): SleepEvent {
  return {
    id: 1, baby_id: 1, start_time: '2026-06-20T13:00:00.000Z', end_time: '2026-06-20T14:00:00.000Z',
    kind: 'nap', location: null, how: null, notes: null, created_at: '', updated_at: '', ...p,
  };
}

function feed(p: Partial<FeedEvent>): FeedEvent {
  return {
    id: 1, baby_id: 1, type: 'breast', start_time: '2026-06-20T04:24:00.000Z', end_time: null,
    side: null, duration_left_s: null, duration_right_s: null, volume_ml: null, contents: null,
    notes: null, created_at: '', updated_at: '', ...p,
  };
}
function diaper(p: Partial<DiaperEvent>): DiaperEvent {
  return { id: 1, baby_id: 1, time: '2026-06-20T01:15:00.000Z', type: 'both', color: null, consistency: null, notes: null, created_at: '', updated_at: '', ...p };
}
function growth(p: Partial<GrowthMeasurement>): GrowthMeasurement {
  return { id: 1, baby_id: 1, measured_at: '2026-06-20', weight_g: null, length_cm: null, head_circumference_cm: null, notes: null, created_at: '', updated_at: '', ...p };
}

describe('feedEntry', () => {
  it('formats a breast feed with side and minutes from per-side duration', () => {
    const e = feedEntry(feed({ type: 'breast', side: 'left', duration_left_s: 720 }), 'ml');
    expect(e.title).toBe('Breast feed');
    expect(e.subtitle).toBe('Left · 12 min');
  });
  it('derives "both" duration from end-start', () => {
    const e = feedEntry(
      feed({ type: 'breast', side: 'both', start_time: '2026-06-20T04:00:00.000Z', end_time: '2026-06-20T04:10:00.000Z' }),
      'ml'
    );
    expect(e.subtitle).toBe('Both · 10 min');
  });
  it('formats bottle and pump', () => {
    expect(feedEntry(feed({ type: 'bottle', volume_ml: 90, contents: 'formula' }), 'ml').subtitle).toBe('90 ml · formula');
    expect(feedEntry(feed({ type: 'pump', volume_ml: 110 }), 'ml').subtitle).toBe('110 ml expressed');
  });
});

describe('diaperEntry', () => {
  it('labels "both" as Mixed', () => {
    const e = diaperEntry(diaper({ type: 'both' }));
    expect(e.title).toBe('Diaper');
    expect(e.subtitle).toBe('Mixed');
  });
});

describe('growthEntry', () => {
  it('summarises measurements and has no clock, anchored at midday', () => {
    const e = growthEntry(growth({ weight_g: 5900, length_cm: 58.4 }), units);
    expect(e.subtitle).toBe('5.9 kg · 58.4 cm');
    expect(e.hasClock).toBe(false);
    expect(e.time).toBe('2026-06-20T12:00:00.000Z');
  });
});

describe('sleepEntry', () => {
  it('formats nap/night with duration; ongoing when no end', () => {
    expect(sleepEntry(sleepEv({ kind: 'nap' })).title).toBe('Nap');
    expect(sleepEntry(sleepEv({ kind: 'nap' })).subtitle).toBe('1h 0m');
    expect(sleepEntry(sleepEv({ kind: 'night' })).title).toBe('Night sleep');
    expect(sleepEntry(sleepEv({ end_time: null })).subtitle).toBe('ongoing');
  });
});

describe('buildTimeline', () => {
  it('merges newest-first with growth at midday and sleep by start', () => {
    const tl = buildTimeline(
      [feed({ id: 1, start_time: '2026-06-20T04:00:00.000Z' }), feed({ id: 2, start_time: '2026-06-20T20:00:00.000Z' })],
      [],
      [growth({ id: 9, weight_g: 5900 })],
      [sleepEv({ id: 5, start_time: '2026-06-20T13:00:00.000Z', end_time: '2026-06-20T14:00:00.000Z' })],
      units
    );
    expect(tl.map((e) => e.key)).toEqual(['feed-2', 'sleep-5', 'growth-9', 'feed-1']);
  });
});

describe('daySummary', () => {
  it('counts feeds excluding pump, bottle-only volume, weigh-ins, and total sleep', () => {
    const s = daySummary(
      [feed({ type: 'breast' }), feed({ type: 'bottle', volume_ml: 90 }), feed({ type: 'pump', volume_ml: 110 })],
      [diaper({}), diaper({ id: 2 })],
      [growth({}), growth({ id: 2 })],
      [sleepEv({ start_time: '2026-06-20T13:00:00.000Z', end_time: '2026-06-20T15:30:00.000Z' })],
      'ml'
    );
    expect(s.feeds).toBe(2);
    expect(s.diapers).toBe(2);
    expect(s.volume).toBe('90 ml');
    expect(s.weighIns).toBe(2);
    expect(s.sleep).toBe('2h 30m');
  });
  it('reports null volume/sleep when none', () => {
    const s = daySummary([feed({ type: 'breast' })], [], [], [], 'ml');
    expect(s.volume).toBeNull();
    expect(s.sleep).toBeNull();
  });
});
