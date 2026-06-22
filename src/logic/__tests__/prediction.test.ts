import { computeFeedRing, formatElapsed, formatOverdue } from '@/src/logic/prediction';

const now = new Date('2026-06-21T04:32:00');

describe('computeFeedRing', () => {
  it('is cold when there is no last feed', () => {
    expect(computeFeedRing({ lastFeedStart: null, intervalMinutes: 180, now }).kind).toBe('cold');
  });

  it('counts up with correct progress while within the interval', () => {
    const last = new Date(now.getTime() - (2 * 60 + 14) * 60_000); // 2h14m ago
    const r = computeFeedRing({ lastFeedStart: last, intervalMinutes: 180, now });
    expect(r.kind).toBe('counting');
    if (r.kind === 'counting') {
      expect(r.progress).toBeCloseTo(134 / 180, 6);
      expect(r.nextFeedAt.getTime()).toBe(last.getTime() + 180 * 60_000);
    }
  });

  it('goes overdue past the interval and never negative', () => {
    const last = new Date(now.getTime() - 210 * 60_000); // 3h30m ago
    const r = computeFeedRing({ lastFeedStart: last, intervalMinutes: 180, now });
    expect(r.kind).toBe('overdue');
    if (r.kind === 'overdue') expect(formatOverdue(r.overdueMs)).toBe('30m');
  });

  it('treats exactly-due as counting at full progress', () => {
    const last = new Date(now.getTime() - 180 * 60_000);
    const r = computeFeedRing({ lastFeedStart: last, intervalMinutes: 180, now });
    expect(r.kind).toBe('counting');
    if (r.kind === 'counting') expect(r.progress).toBe(1);
  });
});

describe('formatElapsed', () => {
  it('formats H:MM', () => {
    expect(formatElapsed((2 * 60 + 14) * 60_000)).toBe('2:14');
    expect(formatElapsed(210 * 60_000)).toBe('3:30');
  });
});

describe('formatOverdue', () => {
  it('formats minutes and hours', () => {
    expect(formatOverdue(30 * 60_000)).toBe('30m');
    expect(formatOverdue(65 * 60_000)).toBe('1h 5m');
  });
});
