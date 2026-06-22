import { toIsoDate, validateBabyDraft } from '@/src/logic/onboarding';

const now = new Date(2026, 5, 21); // 21 Jun 2026, local

describe('validateBabyDraft', () => {
  it('accepts a valid draft, trimming the name and formatting the dob', () => {
    const r = validateBabyDraft({ name: '  Aarav ', sex: 'male', dob: new Date(2026, 3, 14) }, now);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.value.name).toBe('Aarav');
      expect(r.value.date_of_birth).toBe('2026-04-14');
      expect(r.value.sex).toBe('male');
    }
  });

  it('rejects a blank name', () => {
    const r = validateBabyDraft({ name: '   ', sex: 'male', dob: new Date(2026, 3, 14) }, now);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors.name).toBeDefined();
  });

  it('rejects a missing sex', () => {
    const r = validateBabyDraft({ name: 'A', sex: null, dob: new Date(2026, 3, 14) }, now);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors.sex).toBeDefined();
  });

  it('rejects a missing dob', () => {
    const r = validateBabyDraft({ name: 'A', sex: 'female', dob: null }, now);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors.dob).toBeDefined();
  });

  it('rejects a future dob', () => {
    const r = validateBabyDraft({ name: 'A', sex: 'female', dob: new Date(2026, 5, 22) }, now);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors.dob).toBeDefined();
  });

  it('allows a baby born today', () => {
    const r = validateBabyDraft({ name: 'A', sex: 'female', dob: new Date(2026, 5, 21) }, now);
    expect(r.ok).toBe(true);
  });
});

describe('toIsoDate', () => {
  it('formats local date as yyyy-MM-dd', () => {
    expect(toIsoDate(new Date(2026, 0, 5))).toBe('2026-01-05');
  });
});
