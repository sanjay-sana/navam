import { toIsoDate, validateBabyDraft, type BabyDraft } from '@/src/logic/onboarding';

const now = new Date(2026, 5, 21); // 21 Jun 2026, local
const base: Omit<BabyDraft, 'firstName'> = {
  middleName: '',
  lastName: '',
  sex: 'male',
  dob: new Date(2026, 3, 14),
};

describe('validateBabyDraft', () => {
  it('accepts a valid draft and trims the name parts', () => {
    const r = validateBabyDraft(
      { ...base, firstName: '  Aarav ', middleName: ' Kumar ', lastName: ' Sana ' },
      now
    );
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.value.first_name).toBe('Aarav');
      expect(r.value.middle_name).toBe('Kumar');
      expect(r.value.last_name).toBe('Sana');
      expect(r.value.date_of_birth).toBe('2026-04-14');
      expect(r.value.sex).toBe('male');
    }
  });

  it('treats blank middle/last as null', () => {
    const r = validateBabyDraft({ ...base, firstName: 'Aarav' }, now);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.value.middle_name).toBeNull();
      expect(r.value.last_name).toBeNull();
    }
  });

  it('requires a first name', () => {
    const r = validateBabyDraft({ ...base, firstName: '   ' }, now);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors.firstName).toBeDefined();
  });

  it('rejects a missing sex', () => {
    const r = validateBabyDraft({ ...base, firstName: 'A', sex: null }, now);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors.sex).toBeDefined();
  });

  it('rejects a missing dob', () => {
    const r = validateBabyDraft({ ...base, firstName: 'A', dob: null }, now);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors.dob).toBeDefined();
  });

  it('rejects a future dob', () => {
    const r = validateBabyDraft({ ...base, firstName: 'A', dob: new Date(2026, 5, 22) }, now);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors.dob).toBeDefined();
  });

  it('allows a baby born today', () => {
    const r = validateBabyDraft({ ...base, firstName: 'A', dob: new Date(2026, 5, 21) }, now);
    expect(r.ok).toBe(true);
  });
});

describe('toIsoDate', () => {
  it('formats local date as yyyy-MM-dd', () => {
    expect(toIsoDate(new Date(2026, 0, 5))).toBe('2026-01-05');
  });
});
