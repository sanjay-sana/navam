import { localDayBoundsIso, localDayEnd, localDayStart } from '@/src/logic/day';

describe('local day bounds', () => {
  const now = new Date(2026, 5, 21, 14, 30, 0);

  it('starts at local midnight of the given day', () => {
    const s = localDayStart(now);
    expect(s.getHours()).toBe(0);
    expect(s.getMinutes()).toBe(0);
    expect(s.getDate()).toBe(21);
  });

  it('ends at local midnight of the next day', () => {
    expect(localDayEnd(now).getDate()).toBe(22);
  });

  it('spans exactly 24h as ISO bounds (non-DST day)', () => {
    const { startIso, endIso } = localDayBoundsIso(now);
    expect(new Date(endIso).getTime() - new Date(startIso).getTime()).toBe(86_400_000);
  });

  it('buckets events on the right side of the local-midnight boundary', () => {
    const { startIso, endIso } = localDayBoundsIso(new Date(2026, 5, 21, 12, 0));
    const lateOn21 = new Date(2026, 5, 21, 23, 59, 59).toISOString();
    const earlyOn22 = new Date(2026, 5, 22, 0, 0, 0).toISOString();
    const noonOn20 = new Date(2026, 5, 20, 12, 0, 0).toISOString();
    // within [start, end)
    expect(lateOn21 >= startIso && lateOn21 < endIso).toBe(true);
    // the next day's first instant is excluded (it's the exclusive upper bound)
    expect(earlyOn22).toBe(endIso);
    expect(earlyOn22 < endIso).toBe(false);
    // the previous day is below the lower bound
    expect(noonOn20 < startIso).toBe(true);
  });
});
