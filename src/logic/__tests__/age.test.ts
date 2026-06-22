import { ageInDays, ageInMonths, ageInWeeks, formatAge } from '@/src/logic/age';

describe('age helpers', () => {
  const at = new Date(2026, 5, 21); // 21 Jun 2026

  it('computes whole days, clamped at zero', () => {
    expect(ageInDays('2026-06-16', at)).toBe(5);
    expect(ageInDays('2026-06-25', at)).toBe(0); // future dob -> 0
  });

  it('computes weeks and months', () => {
    expect(ageInWeeks('2026-04-26', at)).toBe(8);
    expect(ageInMonths('2026-04-21', at)).toBeCloseTo(61 / 30.4375, 2);
  });

  it('formats age as days / weeks / months', () => {
    expect(formatAge('2026-06-16', at)).toBe('5 days');
    expect(formatAge('2026-06-20', at)).toBe('1 day');
    expect(formatAge('2026-04-26', at)).toBe('8 weeks');
    // completed 30.44-day months (≈402 days → 13)
    expect(formatAge('2025-05-15', at)).toBe('13 months');
  });
});
