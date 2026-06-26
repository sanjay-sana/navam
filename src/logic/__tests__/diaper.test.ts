import { validateDiaperDraft } from '@/src/logic/diaper';

const now = new Date('2026-06-21T12:00:00');

describe('validateDiaperDraft', () => {
  it('accepts a typed diaper in the past', () => {
    const r = validateDiaperDraft({ type: 'wet', time: new Date('2026-06-21T11:00:00') }, now);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value.type).toBe('wet');
  });

  it('requires a type', () => {
    const r = validateDiaperDraft({ type: null, time: new Date('2026-06-21T11:00:00') }, now);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors.type).toBeDefined();
  });

  it('blocks future times', () => {
    const r = validateDiaperDraft({ type: 'wet', time: new Date('2026-06-21T13:00:00') }, now);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors.time).toBeDefined();
  });

  it('serialises time as UTC ISO', () => {
    const t = new Date('2026-06-21T11:00:00');
    const r = validateDiaperDraft({ type: 'both', time: t }, now);
    if (r.ok) expect(r.value.time).toBe(t.toISOString());
  });

  it('keeps colour/consistency for stool, trims notes', () => {
    const t = new Date('2026-06-21T11:00:00');
    const r = validateDiaperDraft(
      { type: 'dirty', time: t, color: 'green', consistency: 'soft', notes: '  leak ' },
      now
    );
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.value.color).toBe('green');
      expect(r.value.consistency).toBe('soft');
      expect(r.value.notes).toBe('leak');
    }
  });

  it('drops colour/consistency for a wet diaper', () => {
    const t = new Date('2026-06-21T11:00:00');
    const r = validateDiaperDraft(
      { type: 'wet', time: t, color: 'green', consistency: 'soft', notes: '' },
      now
    );
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.value.color).toBeNull();
      expect(r.value.consistency).toBeNull();
      expect(r.value.notes).toBeNull();
    }
  });
});
