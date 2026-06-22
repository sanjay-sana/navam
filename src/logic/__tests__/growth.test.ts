import { validateGrowthDraft } from '@/src/logic/growth';

const now = new Date(2026, 5, 21);
const base = {
  measuredAt: new Date(2026, 5, 21),
  weightText: '',
  lengthText: '',
  headText: '',
  unitMass: 'g' as const,
  unitLength: 'cm' as const,
};

describe('validateGrowthDraft', () => {
  it('accepts a single measurement and converts to canonical units', () => {
    const r = validateGrowthDraft({ ...base, weightText: '5.9', lengthText: '58' }, now);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.value.weight_g).toBe(5900);
      expect(r.value.length_cm).toBe(58);
      expect(r.value.head_circumference_cm).toBeNull();
      expect(r.value.measured_at).toBe('2026-06-21');
    }
  });

  it('requires at least one measurement', () => {
    const r = validateGrowthDraft({ ...base }, now);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors.general).toBeDefined();
  });

  it('rejects a non-numeric field', () => {
    const r = validateGrowthDraft({ ...base, weightText: 'abc' }, now);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors.weight).toBeDefined();
  });

  it('blocks future dates', () => {
    const r = validateGrowthDraft({ ...base, measuredAt: new Date(2026, 5, 22), weightText: '5' }, now);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors.date).toBeDefined();
  });

  it('converts imperial inputs (lb / in) to canonical g / cm', () => {
    const r = validateGrowthDraft(
      { ...base, weightText: '13', headText: '15', unitMass: 'lb_oz', unitLength: 'in' },
      now
    );
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.value.weight_g).toBeCloseTo(13 * 453.592, 3);
      expect(r.value.head_circumference_cm).toBeCloseTo(15 * 2.54, 6);
    }
  });
});
