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

  it('spans exactly 24h as ISO bounds', () => {
    const { startIso, endIso } = localDayBoundsIso(now);
    expect(new Date(endIso).getTime() - new Date(startIso).getTime()).toBe(86_400_000);
  });
});
