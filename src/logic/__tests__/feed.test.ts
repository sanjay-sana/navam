import type { FeedDraft } from '@/src/logic/feed';
import { validateFeedDraft } from '@/src/logic/feed';

const now = new Date('2026-06-21T12:00:00');
const start = new Date('2026-06-21T11:00:00');

const base: Omit<FeedDraft, 'type'> = {
  startTime: start,
  side: null,
  durationSeconds: null,
  volumeText: '',
  contents: null,
  unitVolume: 'ml',
};

describe('breast feeds', () => {
  it('stores a per-side duration for a single known side and sets end_time', () => {
    const r = validateFeedDraft({ ...base, type: 'breast', side: 'left', durationSeconds: 720 }, now);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.value.duration_left_s).toBe(720);
      expect(r.value.duration_right_s).toBeNull();
      expect(r.value.end_time).toBe(new Date(start.getTime() + 720_000).toISOString());
    }
  });

  it('leaves per-side null for "both" (total recoverable from end-start)', () => {
    const r = validateFeedDraft({ ...base, type: 'breast', side: 'both', durationSeconds: 600 }, now);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.value.duration_left_s).toBeNull();
      expect(r.value.duration_right_s).toBeNull();
    }
  });

  it('requires a side', () => {
    const r = validateFeedDraft({ ...base, type: 'breast', side: null, durationSeconds: 600 }, now);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors.side).toBeDefined();
  });

  it('allows no duration (just logging that a feed happened)', () => {
    const r = validateFeedDraft({ ...base, type: 'breast', side: 'right', durationSeconds: null }, now);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.value.end_time).toBeNull();
      expect(r.value.duration_right_s).toBeNull();
    }
  });
});

describe('bottle feeds', () => {
  it('accepts volume + contents', () => {
    const r = validateFeedDraft({ ...base, type: 'bottle', volumeText: '90', contents: 'formula' }, now);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.value.volume_ml).toBe(90);
      expect(r.value.contents).toBe('formula');
    }
  });

  it('converts oz input to canonical ml', () => {
    const r = validateFeedDraft(
      { ...base, type: 'bottle', volumeText: '3', contents: 'formula', unitVolume: 'oz' },
      now
    );
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value.volume_ml).toBeCloseTo(3 * 29.5735, 6);
  });

  it('requires contents', () => {
    const r = validateFeedDraft({ ...base, type: 'bottle', volumeText: '90', contents: null }, now);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors.contents).toBeDefined();
  });

  it('rejects non-positive volume', () => {
    const r = validateFeedDraft({ ...base, type: 'bottle', volumeText: '0', contents: 'formula' }, now);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors.volume).toBeDefined();
  });
});

describe('pump feeds', () => {
  it('accepts volume with optional side', () => {
    const withSide = validateFeedDraft({ ...base, type: 'pump', volumeText: '110', side: 'left' }, now);
    expect(withSide.ok).toBe(true);
    if (withSide.ok) expect(withSide.value.side).toBe('left');

    const noSide = validateFeedDraft({ ...base, type: 'pump', volumeText: '110', side: null }, now);
    expect(noSide.ok).toBe(true);
    if (noSide.ok) expect(noSide.value.side).toBeNull();
  });

  it('requires a volume', () => {
    const r = validateFeedDraft({ ...base, type: 'pump', volumeText: '', side: null }, now);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors.volume).toBeDefined();
  });
});

describe('future times', () => {
  it('are blocked for any type', () => {
    const r = validateFeedDraft(
      { ...base, type: 'bottle', startTime: new Date(now.getTime() + 60_000), volumeText: '90', contents: 'formula' },
      now
    );
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors.time).toBeDefined();
  });
});
