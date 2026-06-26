import type { SleepEvent } from '@/src/db/types';
import { classifyKind, formatDuration, sleepDayStats, sleepState } from '@/src/logic/sleep';

function sleep(p: Partial<SleepEvent>): SleepEvent {
  return {
    id: 1,
    baby_id: 1,
    start_time: '2026-06-26T13:00:00.000Z',
    end_time: '2026-06-26T13:45:00.000Z',
    kind: 'nap',
    location: null,
    how: null,
    notes: null,
    created_at: '',
    updated_at: '',
    ...p,
  };
}

describe('classifyKind', () => {
  it('night between 8pm and 6am, nap otherwise', () => {
    expect(classifyKind(new Date(2026, 5, 26, 21, 0))).toBe('night'); // 9pm
    expect(classifyKind(new Date(2026, 5, 26, 23, 30))).toBe('night');
    expect(classifyKind(new Date(2026, 5, 26, 4, 0))).toBe('night'); // 4am
    expect(classifyKind(new Date(2026, 5, 26, 6, 0))).toBe('nap'); // 6am
    expect(classifyKind(new Date(2026, 5, 26, 13, 0))).toBe('nap'); // 1pm
    expect(classifyKind(new Date(2026, 5, 26, 19, 59))).toBe('nap');
    expect(classifyKind(new Date(2026, 5, 26, 20, 0))).toBe('night'); // 8pm boundary
  });
});

describe('sleepState', () => {
  const now = new Date('2026-06-26T14:00:00.000Z');

  it('asleep with time-asleep when there is an open sleep', () => {
    const open = sleep({ start_time: '2026-06-26T13:00:00.000Z', end_time: null });
    const s = sleepState({ openSleep: open, lastEndedSleep: null, now });
    expect(s.kind).toBe('asleep');
    expect(s.sinceMs).toBe(60 * 60 * 1000);
  });

  it('awake with wake window from the last ended sleep', () => {
    const last = sleep({ end_time: '2026-06-26T13:30:00.000Z' });
    const s = sleepState({ openSleep: null, lastEndedSleep: last, now });
    expect(s.kind).toBe('awake');
    expect(s.sinceMs).toBe(30 * 60 * 1000);
  });

  it('awake with null window when no prior sleep', () => {
    const s = sleepState({ openSleep: null, lastEndedSleep: null, now });
    expect(s).toEqual({ kind: 'awake', sinceMs: null });
  });
});

describe('sleepDayStats', () => {
  const now = new Date('2026-06-26T15:00:00.000Z');

  it('counts naps and sums durations (open session counts to now)', () => {
    const sessions = [
      sleep({ id: 1, kind: 'nap', start_time: '2026-06-26T09:00:00.000Z', end_time: '2026-06-26T10:00:00.000Z' }), // 60m
      sleep({ id: 2, kind: 'nap', start_time: '2026-06-26T13:00:00.000Z', end_time: '2026-06-26T13:30:00.000Z' }), // 30m
      sleep({ id: 3, kind: 'night', start_time: '2026-06-26T14:30:00.000Z', end_time: null }), // open: 30m to now
    ];
    const s = sleepDayStats(sessions, now);
    expect(s.naps).toBe(2);
    expect(s.totalMin).toBe(120);
  });
});

describe('formatDuration', () => {
  it('formats h/m', () => {
    expect(formatDuration(7 * 3600_000 + 20 * 60_000)).toBe('7h 20m');
    expect(formatDuration(45 * 60_000)).toBe('45m');
    expect(formatDuration(0)).toBe('0m');
  });
});
