// DST edge tests. Pin a DST-observing zone so the 23h/25h calendar days are
// actually exercised (ageInDays rounds whole days; day bounds aren't always 24h).
// Set TZ before importing the date logic. No other suite asserts UTC-/DST-
// specific values, so the pinned zone is safe even if the worker is reused.
process.env.TZ = 'America/New_York';

import { ageInDays } from '@/src/logic/age';
import { localDayBoundsIso } from '@/src/logic/day';

const hours = (startIso: string, endIso: string) =>
  (new Date(endIso).getTime() - new Date(startIso).getTime()) / 3_600_000;

describe('DST edges (America/New_York)', () => {
  // US 2026: spring-forward Sun Mar 8, fall-back Sun Nov 1.

  it('counts whole days across spring-forward (a 23h day)', () => {
    expect(ageInDays('2026-03-07', new Date(2026, 2, 8, 12, 0))).toBe(1);
    expect(ageInDays('2026-03-07', new Date(2026, 2, 9, 12, 0))).toBe(2);
  });

  it('counts whole days across fall-back (a 25h day)', () => {
    expect(ageInDays('2026-10-31', new Date(2026, 10, 1, 12, 0))).toBe(1);
    expect(ageInDays('2026-10-31', new Date(2026, 10, 2, 12, 0))).toBe(2);
  });

  it('local day bounds are 23h on the spring-forward day, 25h on fall-back', () => {
    expect(hours(...Object.values(localDayBoundsIso(new Date(2026, 2, 8, 12, 0))) as [string, string])).toBe(23);
    expect(hours(...Object.values(localDayBoundsIso(new Date(2026, 10, 1, 12, 0))) as [string, string])).toBe(25);
  });
});
